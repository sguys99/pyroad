import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { captureServerError, captureServerMessage } from '@/lib/observability/server';
import { parseRateLimitEnv, type RateLimit } from './rateLimit';
import type { LLMProviderType } from './providers/types';

/**
 * 서버 키 전역 예산 (P1-22, P1-19 제안).
 *
 * 서버 무료 티어 키(Gemini)의 한도는 사용자별이 아니라 **Google 프로젝트 전체**에 걸린다. 사용자별 한도(rateLimit.ts, 하루 최대 약
 * 420회)만으로는 사용자가 많아지면 지켜지지 않으므로, 서버 키로 provider 를 부르기 직전에 전체 합계를 한 번 더 센다
 * (`consume_global_rate_limit`, 00017, 버킷 `tutor:<provider>:global`). 넘으면 그 provider 를 건너뛰고 저장된 답변을 보낸다.
 * 본인 키 호출과 캐시 적중은 세지 않는다(우리 키를 쓰지 않음).
 *
 * 기본값은 무료 티어에 맞춘 값이다: 무료 티어를 넘는 요청은 어차피 Google 이 429 로 거절하므로(재시도 1초까지 기다린 뒤 저장된 답변)
 * 무료 티어에서는 잃는 것이 없고, 결제를 켠 프로젝트에서는 비용 상한이 된다. 실제 한도는 AI Studio 의 프로젝트 rate limit 화면에서
 * 확인해 env `TUTOR_GLOBAL_LIMIT_GEMINI=분당/하루`로 맞춘다(docs/release/v0.4-runbook.md "튜터 한도·남용 기록").
 * 하루 창은 KST 자정 기준이고 Google 무료 티어는 태평양 시간 자정에 초기화되므로 경계 근처는 몇 시간 어긋날 수 있다.
 */
export const SERVER_KEY_BUDGETS: Partial<
  Record<LLMProviderType, RateLimit & { env: string }>
> = {
  // 공개 문서에 무료 티어 수치가 없음(2026-11-04, 프로젝트마다 AI Studio 에 표시). 알려진 flash-lite 무료 티어 수준으로 잡음
  gemini: { env: 'TUTOR_GLOBAL_LIMIT_GEMINI', perMinute: 10, perDay: 500 },
};

const warnedEnv = new Set<string>();

/** 이 provider 의 서버 키 전역 예산. 정하지 않은 provider 는 null (세지 않음) */
export function getServerKeyBudget(
  provider: LLMProviderType,
  env: Record<string, string | undefined> = process.env,
): RateLimit | null {
  const def = SERVER_KEY_BUDGETS[provider];
  if (!def) return null;
  const raw = env[def.env];
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = parseRateLimitEnv(raw);
    if (parsed) return parsed;
    if (!warnedEnv.has(def.env)) {
      warnedEnv.add(def.env);
      console.warn(
        `[tutor] ${def.env} 형식이 잘못됨 ("분당/하루", 예: 10/500) → 기본값 사용`,
      );
    }
  }
  return { perMinute: def.perMinute, perDay: def.perDay };
}

/**
 * 서버 키로 이 provider 를 1번 불러도 되는지 (예산 1 차감). false 면 건너뛴다.
 * DB 호출이 실패하면 **통과**시킨다(fail-open, rateLimit.ts 와 같은 이유). 실패는 로그·Sentry.
 * 예산을 넘으면 분 창마다 처음 한 번만 로그를 남기고(하루 예산을 다 쓰면 요청마다 쌓이지 않게) Sentry 경고를 보낸다(10분 3회 제한).
 */
export async function consumeServerKeyBudget(
  admin: SupabaseClient<Database>,
  provider: LLMProviderType,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  const limit = getServerKeyBudget(provider, env);
  if (!limit) return true;
  try {
    const { data, error } = await admin.rpc('consume_global_rate_limit', {
      p_bucket: `tutor:${provider}:global`,
      p_per_minute: limit.perMinute,
      p_per_day: limit.perDay,
    });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    const row = data as Record<string, unknown> | null;
    if (!row || typeof row.allowed !== 'boolean') {
      throw new Error('consume_global_rate_limit: 알 수 없는 응답');
    }
    if (row.allowed) return true;

    const scope = row.scope === 'day' ? 'day' : 'minute';
    if (Number(row.denied_minute) === 1) {
      console.warn(
        `[tutor] 서버 ${provider} 키 전역 예산 초과 (${scope}, ${limit.perMinute}/${limit.perDay}, 오늘 거부 ${Number(row.denied_today) || 0}) → 저장된 답변`,
      );
    }
    captureServerMessage('tutor server key budget exhausted', 'warning', {
      tags: { area: 'tutor', op: 'server_key_budget', provider, scope },
      fingerprint: ['tutor-server-key-budget', provider, scope],
    });
    return false;
  } catch (error) {
    console.error(
      '[tutor] consume_global_rate_limit 실패:',
      error instanceof Error ? error.message : error,
    );
    captureServerError(error, {
      tags: { area: 'tutor', op: 'server_key_budget' },
    });
    return true;
  }
}
