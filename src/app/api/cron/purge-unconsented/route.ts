import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { deleteUserAccount } from '@/lib/account/deleteUserAccount';
import { CONSENT_SELECT } from '@/lib/consent/server';
import { isAdminUser } from '@/lib/admin';

/**
 * 미동의 만 14세 미만 계정 + 온보딩·나이 확인 미완료 계정 파기 (P3-15 §12-Q36, B118 §12-Q81).
 * Vercel Cron 이 하루 한 번 부른다 (`vercel.json`, 03:00 KST 무렵).
 *
 * - **CRON_SECRET 이 없으면 꺼짐(503)**: 운영에서는 런북 ② 확인 뒤에 env 를 넣어 켠다. Vercel 은 이 값을
 *   `Authorization: Bearer <CRON_SECRET>`으로 보내므로 다른 호출은 401
 * - 대상: `list_expired_unconsented`(00024) = 만 14세 미만 + 보호자 동의 없음 + 기한(나이 확인 + 30일)이 지남. 한 번에 최대 50명
 *   기존 사용자의 기한은 가입일이 아니라 나이를 확인한 날부터라 배포 날 오래된 계정이 지워지지 않는다
 * - 대상 2 (B118): `list_expired_incomplete`(00061) = 온보딩·나이 확인 미완료 + 활동 기록 없음 + max(가입일, 00061 적용 시각) + 30일.
 *   대상 1 을 먼저 채우고 남은 자리만큼(합쳐서 한 번에 최대 50명). 함수가 없으면(00061 전) 오류만 보고하고 대상 1 만.
 *   지우기 직전 같은 함수에 id 를 넣어 다시 확인하고, 관리자(`app_metadata.role`)는 건너뜀
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
  const toIds = (v: unknown) =>
    (Array.isArray(v) ? v : []).filter(
      (x): x is string => typeof x === 'string',
    );
  const unconsented = toIds(data);
  let incomplete: string[] = [];
  if (unconsented.length < BATCH) {
    const more = await admin.rpc('list_expired_incomplete', {
      p_limit: BATCH - unconsented.length,
    });
    if (more.error)
      reportServerError(more.error, { area: 'consent', op: 'purge list 2' });
    else
      incomplete = toIds(more.data).filter((id) => !unconsented.includes(id));
  }
  const ids = [...unconsented, ...incomplete];

  let deleted = 0;
  let skipped = 0;
  let failed = 0;
  const now = Date.now();
  for (const id of ids) {
    // 다시 확인: 그사이 보호자가 동의했거나 온보딩을 마쳤거나 기한이 바뀌었으면 지우지 않음
    const expired = unconsented.includes(id)
      ? await stillUnconsented(admin, id, now)
      : await stillIncomplete(admin, id);
    if (!expired) {
      skipped++;
      continue;
    }
    // 관리자 계정은 지우지 않음 (온보딩 없이 공지만 쓰는 운영 계정 보호)
    const { data: auth } = await admin.auth.admin.getUserById(id);
    if (!auth?.user || isAdminUser(auth.user)) {
      skipped++;
      continue;
    }
    if (dry) continue;
    const result = await deleteUserAccount(admin, id, auth.user.identities);
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
    incomplete: incomplete.length,
    deleted,
    skipped,
    failed,
    more: ids.length === BATCH,
  };
  console.info(
    `[consent] 미동의·미완료 계정 파기${dry ? '(dry)' : ''}: 대상 ${ids.length}(미완료 ${incomplete.length}) · 지움 ${deleted} · 건너뜀 ${skipped} · 실패 ${failed}`,
  );
  return NextResponse.json(summary);
}

type Admin = ReturnType<typeof createAdminClient>;

async function stillUnconsented(admin: Admin, id: string, now: number) {
  const { data: row, error } = await admin
    .from('users')
    .select(CONSENT_SELECT)
    .eq('id', id)
    .maybeSingle();
  return (
    !error &&
    row?.age_band === 'under14' &&
    !row.guardian_consented_at &&
    !!row.consent_deadline &&
    Date.parse(row.consent_deadline) < now
  );
}

async function stillIncomplete(admin: Admin, id: string) {
  const { data, error } = await admin.rpc('list_expired_incomplete', {
    p_limit: 1,
    p_user_id: id,
  });
  return !error && Array.isArray(data) && data.includes(id);
}
