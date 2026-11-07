import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { deleteUserAccount } from '@/lib/account/deleteUserAccount';
import { CONSENT_SELECT } from '@/lib/consent/server';

/**
 * 미동의 만 14세 미만 계정 파기 (P3-15, §12-Q36). Vercel Cron 이 하루 한 번 부른다 (`vercel.json`, 03:00 KST 무렵).
 *
 * - **CRON_SECRET 이 없으면 꺼짐(503)**: 운영에서는 런북 ② 확인 뒤에 env 를 넣어 켠다. Vercel 은 이 값을
 *   `Authorization: Bearer <CRON_SECRET>`으로 보내므로 다른 호출은 401
 * - 대상: `list_expired_unconsented`(00024) = 만 14세 미만 + 보호자 동의 없음 + 기한(나이 확인 + 30일)이 지남. 한 번에 최대 50명
 *   기존 사용자의 기한은 가입일이 아니라 나이를 확인한 날부터라 배포 날 오래된 계정이 지워지지 않는다
 * - 지우기 직전에 한 명씩 다시 확인하고(그사이 동의했을 수 있음) 탈퇴와 같은 경로(`deleteUserAccount`: Kakao 연결 끊기 →
 *   Auth 삭제 = 모든 행 CASCADE → 분석 이벤트)로 지운다. Naver 는 토큰이 없어 provider 쪽 연결은 끊지 못함(런북)
 * - 로그·응답에는 **수만** 남긴다(사용자 id·닉네임 없음). `?dry=1`이면 지우지 않고 수만 센다
 */
export const dynamic = 'force-dynamic';

const BATCH = 50;

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header ?? '');
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'disabled' }, { status: 503 });
  }
  if (!authorized(request.headers.get('authorization'), secret)) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    );
  }
  const dry = new URL(request.url).searchParams.get('dry') === '1';

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('list_expired_unconsented', {
    p_limit: BATCH,
  });
  if (error) {
    reportServerError(error, { area: 'consent', op: 'purge list' });
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
  const ids = (Array.isArray(data) ? data : []).filter(
    (v): v is string => typeof v === 'string',
  );

  let deleted = 0;
  let skipped = 0;
  let failed = 0;
  const now = Date.now();
  for (const id of ids) {
    // 다시 확인: 그사이 보호자가 동의했거나 기한이 바뀌었으면 지우지 않음
    const { data: row, error: rowError } = await admin
      .from('users')
      .select(CONSENT_SELECT)
      .eq('id', id)
      .maybeSingle();
    const expired =
      !rowError &&
      row?.age_band === 'under14' &&
      !row.guardian_consented_at &&
      !!row.consent_deadline &&
      Date.parse(row.consent_deadline) < now;
    if (!expired) {
      skipped++;
      continue;
    }
    if (dry) continue;
    const result = await deleteUserAccount(admin, id);
    if (result.ok) deleted++;
    else {
      failed++;
      reportServerError(new Error(result.error), {
        area: 'consent',
        op: 'purge delete',
      });
    }
  }

  const summary = {
    ok: true,
    dry,
    candidates: ids.length,
    deleted,
    skipped,
    failed,
    more: ids.length === BATCH,
  };
  console.info(
    `[consent] 미동의 계정 파기${dry ? '(dry)' : ''}: 대상 ${ids.length} · 지움 ${deleted} · 건너뜀 ${skipped} · 실패 ${failed}`,
  );
  return NextResponse.json(summary);
}
