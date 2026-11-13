import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { guardianWriteGate } from '@/lib/consent/server';
import { trackServerEvent } from '@/lib/analytics/server';
import { guardianReportPath } from '@/lib/guardian-report/report';

/**
 * 보호자 주간 리포트 링크 (P9-15). 사용자는 `auth.getUser()`로 확인한 id 만
 *
 * - `GET` 상태 `{active, createdAt}` (토큰 원문은 DB 에 없어 다시 보여 줄 수 없음)
 * - `POST` 만들기·다시 만들기 `{active, createdAt, path}` — 새 토큰으로 바꿔 써서 옛 링크는 바로 404.
 *   학습 기록을 다른 사람에게 보여 주는 쓰기라 보호자 동의 게이트(P3-15, 공유 카드와 같음)
 * - `DELETE` 끄기 (늘 허용)
 * 모두 service_role RPC `guardian_report_link`(00050)
 */
type Action = 'status' | 'create' | 'off';

async function run(request: Request, action: Action) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (action === 'create') {
    const blocked = await guardianWriteGate(user.id, admin);
    if (blocked) return blocked;
  }

  const { data, error } = await admin.rpc('guardian_report_link', {
    p_user_id: user.id,
    p_action: action,
  });
  if (error || !data) {
    reportServerError(error ?? new Error('empty'), {
      area: 'guardian-report',
      op: action,
    });
    return NextResponse.json(
      { error: '앗, 잠깐 문제가 생겼어요. 잠시 후 다시 해 볼까요?' },
      { status: 500 },
    );
  }
  const row = data as {
    active: boolean;
    created_at: string | null;
    token?: string;
  };

  if (action !== 'status')
    trackServerEvent({
      headers: request.headers,
      userId: user.id,
      name: 'guardian_report_link',
      props: { action },
      path: '/settings',
    });

  return NextResponse.json(
    {
      active: row.active,
      createdAt: row.created_at,
      ...(row.token ? { path: guardianReportPath(row.token) } : {}),
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}

export const GET = (request: Request) => run(request, 'status');
export const POST = (request: Request) => run(request, 'create');
export const DELETE = (request: Request) => run(request, 'off');
