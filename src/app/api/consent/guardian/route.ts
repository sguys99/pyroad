import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import {
  GUARDIAN_AGREEMENTS_REQUIRED_MESSAGE,
  NICKNAME_RATE_LIMITED_MESSAGE,
  ONBOARDING_SERVER_ERROR_MESSAGE,
  type GuardianConsentResponse,
} from '@/lib/onboarding/api';
import {
  consumeProfileQuota,
  guardianConsentSchema,
  guardianRecords,
  recordGuardianConsent,
} from '@/lib/onboarding/server';

/**
 * 나중에 보호자 동의 (P3-15, §12-Q35). `POST /api/consent/guardian { agreements, relation }`
 * 제한 모드(만 14세 미만 + 동의 전) 아이가 `/onboarding/guardian`에서 보호자와 함께 동의한다.
 * 보호자 항목을 모두 지금 버전으로 받았는지 서버가 다시 보고 service_role RPC `record_guardian_consent`(00024)로 기록
 * (method `guardian_in_person`, 기한 해제). 만 14세 미만이 아니면 409. 보호자 이름·연락처는 받지 않는다.
 */
function reply(body: GuardianConsentResponse, status: number) {
  return NextResponse.json(body, { status });
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

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = guardianConsentSchema.safeParse(body);
  if (!parsed.success) {
    return reply(
      {
        ok: false,
        error: 'invalid_body',
        message: ONBOARDING_SERVER_ERROR_MESSAGE,
      },
      400,
    );
  }
  const records = guardianRecords(parsed.data.agreements);
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

  const admin = createAdminClient();
  const quota = await consumeProfileQuota(admin, user.id, 'profile:guardian');
  if (!quota.allowed) {
    return reply(
      {
        ok: false,
        error: 'rate_limited',
        message: NICKNAME_RATE_LIMITED_MESSAGE,
      },
      429,
    );
  }

  const result = await recordGuardianConsent(
    admin,
    user.id,
    records,
    parsed.data.relation,
  );
  if (!result.ok) {
    if (result.reason === 'not_under14') {
      return reply(
        {
          ok: false,
          error: 'not_under14',
          message: '이 계정은 보호자 동의가 필요하지 않아요.',
        },
        409,
      );
    }
    reportServerError(result.error, {
      area: 'consent',
      op: 'record_guardian_consent',
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
  return reply({ ok: true }, 200);
}
