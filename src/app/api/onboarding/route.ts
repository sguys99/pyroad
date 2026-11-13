import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withShareCardPurge } from '@/lib/share-card/purge';
import { reportServerError } from '@/lib/api/serverError';
import { trackServerEvent } from '@/lib/analytics/server';
import { ageBand } from '@/lib/consent/age';
import { validateNickname } from '@/lib/profile/nickname';
import {
  AGREEMENTS_REQUIRED_MESSAGE,
  GUARDIAN_AGREEMENTS_REQUIRED_MESSAGE,
  NICKNAME_RATE_LIMITED_MESSAGE,
  NICKNAME_TAKEN_MESSAGE,
  ONBOARDING_SERVER_ERROR_MESSAGE,
  type OnboardingResponse,
} from '@/lib/onboarding/api';
import {
  agreedRecords,
  completeOnboarding,
  consumeProfileQuota,
  findFreeSuggestion,
  guardianRecords,
  parseOnboardingRequest,
  type CompleteOnboardingInput,
  wasReturningUser,
} from '@/lib/onboarding/server';

/**
 * 첫 로그인 온보딩 저장 (P3-11·P3-15). `POST /api/onboarding { nickname, skin, grade, agreements, age, guardian }`
 *
 * 나이(P3-15): `age`(태어난 해·달·생일 지남)를 서버가 KST 오늘로 다시 계산해 결과(under14·14plus)만 저장한다. 답은 저장·로그하지 않는다.
 * 만 14세 미만이고 `guardian`(보호자 항목 전부 + 관계 선택)이 오면 보호자 동의까지 마침, 없으면 제한 모드 + 30일 기한.
 *
 * 클라이언트가 보낸 값을 믿지 않고 모두 다시 검사한 뒤(닉네임 규칙·금칙어 `validateNickname`, 스킨 id, 학년 1~6,
 * 필수 동의·지금 문서 버전) service_role RPC `complete_onboarding`(00023) 한 번으로 닉네임·스킨(avatar_config 에 합침)·
 * 학년·완료 시각·동의 기록을 한 트랜잭션에 쓴다. users 의 클라이언트 UPDATE 권한은 열지 않는다(③ 00008 그대로).
 *
 * 응답: 200 `{ ok: true, first }` · 400 invalid_body·invalid_nickname·agreements_required · 401 · 409 nickname_taken(+ 추천)
 *       · 429 rate_limited · 500 server_error. 오류 문구는 아이용 일반 문구 (DB 메시지는 reportServerError 로 로그·Sentry 만)
 */

function reply(
  body: OnboardingResponse,
  status: number,
  headers?: HeadersInit,
) {
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return reply(
      { ok: false, error: 'unauthorized', message: 'Unauthorized' },
      401,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const input = parseOnboardingRequest(body);
  if (!input) {
    return reply(
      {
        ok: false,
        error: 'invalid_body',
        message: ONBOARDING_SERVER_ERROR_MESSAGE,
      },
      400,
    );
  }

  const nickname = validateNickname(input.nickname);
  if (!nickname.ok) {
    if ('moderation' in nickname) {
      // 어떤 규칙에 걸렸는지만 서버 로그에 (닉네임 원문은 남기지 않음)
      console.info(
        `[onboarding] 금칙어 닉네임 거부: ${nickname.moderation.category}/${nickname.moderation.ruleId}`,
      );
    }
    return reply(
      {
        ok: false,
        error: 'invalid_nickname',
        reason: nickname.reason,
        message: nickname.message,
      },
      400,
    );
  }

  const agreements = agreedRecords(input.agreements);
  if (!agreements) {
    return reply(
      {
        ok: false,
        error: 'agreements_required',
        message: AGREEMENTS_REQUIRED_MESSAGE,
      },
      400,
    );
  }

  // 나이 확인 (P3-15): 답을 KST 오늘로 다시 계산해 결과만 넘긴다. 더 물어야 하는 상태(날짜 경계 등)·모름 = 만 14세 미만
  const age = ageBand(input.age);
  const band = 'band' in age ? age.band : 'under14';
  let guardian: CompleteOnboardingInput['guardian'] = null;
  if (band === 'under14' && input.guardian) {
    const records = guardianRecords(input.guardian.agreements);
    if (!records) {
      return reply(
        {
          ok: false,
          error: 'guardian_agreements_required',
          message: GUARDIAN_AGREEMENTS_REQUIRED_MESSAGE,
        },
        400,
      );
    }
    guardian = { agreements: records, relation: input.guardian.relation };
  }

  const admin = createAdminClient();
  const quota = await consumeProfileQuota(admin, user.id, 'profile:onboarding');
  if (!quota.allowed) {
    return reply(
      {
        ok: false,
        error: 'rate_limited',
        message: NICKNAME_RATE_LIMITED_MESSAGE,
      },
      429,
      { 'Retry-After': String(quota.retryAfter) },
    );
  }

  // 다시 온보딩으로 닉네임·스킨을 바꾸면 내 자랑 카드도 새 그림 + CDN 사본 지우기 (P9-11, 00045 트리거)
  const result = await withShareCardPurge(admin, user.id, () =>
    completeOnboarding(admin, user.id, {
      nickname: nickname.nickname,
      skin: input.skin,
      grade: input.grade,
      agreements,
      ageBand: band,
      guardian,
    }),
  );

  if (!result.ok) {
    if (result.reason === 'taken') {
      const suggestion = await findFreeSuggestion(
        admin,
        user.id,
        nickname.nickname,
      );
      return reply(
        {
          ok: false,
          error: 'nickname_taken',
          message: NICKNAME_TAKEN_MESSAGE,
          ...(suggestion ? { suggestion } : {}),
        },
        409,
      );
    }
    reportServerError(result.error, {
      area: 'onboarding',
      op: 'complete_onboarding',
    });
    return reply(
      {
        ok: false,
        error: 'server_error',
        message: ONBOARDING_SERVER_ERROR_MESSAGE,
      },
      500,
    );
  }

  if (result.first) {
    const returning = await wasReturningUser(admin, user.id);
    trackServerEvent({
      headers: request.headers,
      userId: user.id,
      name: 'onboarding_complete',
      props: {
        skin: input.skin,
        grade_given: input.grade !== null,
        returning,
      },
      path: '/onboarding',
      dedupeKey: 'onboarding_complete',
    });
  }

  return reply(
    { ok: true, first: result.first, restricted: result.restricted },
    200,
  );
}
