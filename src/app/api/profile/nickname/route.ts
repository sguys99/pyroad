import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { validateNickname } from '@/lib/profile/nickname';
import {
  NICKNAME_RATE_LIMITED_MESSAGE,
  NICKNAME_TAKEN_MESSAGE,
  ONBOARDING_SERVER_ERROR_MESSAGE,
  type NicknameAvailability,
} from '@/lib/onboarding/api';
import {
  consumeProfileQuota,
  findFreeSuggestion,
  isNicknameTaken,
} from '@/lib/onboarding/server';

/**
 * 닉네임 확인 (P3-11 온보딩 입력 중): 글자 규칙 + 금칙어 + 중복. `GET /api/profile/nickname?name=<입력>`
 *
 * - 저장은 하지 않는다. 저장할 때 `/api/onboarding`이 같은 검사를 다시 하고 DB 유일 인덱스가 마지막으로 막는다
 * - 중복은 service_role 전용 `is_nickname_taken`(00023, lower() 비교·본인 행 제외)으로만 본다 → 다른 아이의 닉네임 목록을 읽을 길이 없음
 * - 사용자별 요청 한도(`profile:nickname`, 분당 30·하루 300). 넘으면 429 — 화면은 "잠깐 쉬었다가"를 보이고 저장은 막지 않음
 * - 어떤 금칙어에 걸렸는지는 알려 주지 않는다(우회 방법을 가르치지 않게)
 * - 응답은 늘 `NicknameAvailability` 모양. DB 오류 메시지는 넣지 않는다(reportServerError)
 */

function json(body: NicknameAvailability, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get('name') ?? '';
  // 입력칸 최대 길이보다 훨씬 긴 값은 검사할 필요 없이 길이 규칙으로
  const checked = validateNickname(raw.slice(0, 64));
  if (!checked.ok) {
    return json({
      ok: false,
      reason: checked.reason,
      message: checked.message,
      ...(checked.char ? { char: checked.char } : {}),
    });
  }

  const admin = createAdminClient();
  const quota = await consumeProfileQuota(admin, user.id, 'profile:nickname');
  if (!quota.allowed) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'rate_limited',
        message: NICKNAME_RATE_LIMITED_MESSAGE,
      } satisfies NicknameAvailability,
      {
        status: 429,
        headers: {
          'Retry-After': String(quota.retryAfter),
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  try {
    if (await isNicknameTaken(admin, checked.nickname, user.id)) {
      const suggestion = await findFreeSuggestion(
        admin,
        user.id,
        checked.nickname,
      );
      return json({
        ok: false,
        reason: 'taken',
        message: NICKNAME_TAKEN_MESSAGE,
        ...(suggestion ? { suggestion } : {}),
      });
    }
  } catch (error) {
    reportServerError(error, { area: 'onboarding', op: 'nickname check' });
    return json(
      {
        ok: false,
        reason: 'error',
        message: ONBOARDING_SERVER_ERROR_MESSAGE,
      },
      500,
    );
  }

  return json({ ok: true, nickname: checked.nickname });
}
