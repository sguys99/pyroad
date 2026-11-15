import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid, reportServerError } from '@/lib/api/serverError';
import { guardianWriteGate } from '@/lib/consent/server';
import {
  checkCreationTexts,
  creationPatchSchema,
  fromBytea,
  parseCommandsGz,
  publishableQuests,
} from '@/lib/creations/server';

/**
 * 내 작품 고치기·공개·지우기 (P11-06). 사용자는 `auth.getUser()`로 확인한 id 만
 *
 * - `PATCH {title?, showCode?, visibility?}`
 *   - 비공개로 두거나 비공개로 바꾸기: 본인 세션(RLS — 고친 행은 늘 비공개). 제목은 금칙어 검사
 *   - 공개(출품, world3.md §7): 다른 학생에게 보이는 쓰기라 ① 보호자 동의 게이트 ② 운영자가 숨긴 작품이 아님
 *     ③ 3월드 프로젝트를 끝낸 작품만(Q75 ⑧) ④ 제목·대화 기록·그림 글씨(+ 코드 보기를 켰으면 코드)의 금칙어 + 개인정보
 *     지킴이(Q75 ⑨, 제안 J) → 통과하면 service_role 로 공개. 공개 중인 작품을 고쳐도 같은 검사를 다시 한다
 * - `DELETE` 본인 세션(RLS)
 */

const FAILED = '지금은 바꾸지 못했어요. 잠시 뒤에 다시 해 줘요.';

function bad(message: string, status = 400, code = 'invalid') {
  return NextResponse.json({ error: message, code }, { status });
}

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await signedIn();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return bad('작품을 찾지 못했어요.', 404, 'not_found');
  const parsed = creationPatchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === 'title');
    return bad(issue?.message ?? '바꿀 내용이 이상해요.');
  }
  const patch = parsed.data;

  const { data: row, error } = await supabase
    .from('creations')
    .select(
      'id, quest_id, title, code, transcript, commands_gz, visibility, show_code, hidden_at, published_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    reportServerError(error, { area: 'creations', op: 'read' });
    return bad(FAILED, 500, 'server');
  }
  if (!row) return bad('작품을 찾지 못했어요.', 404, 'not_found');

  const title = patch.title ?? row.title;
  const showCode = patch.showCode ?? row.show_code;
  const publish = (patch.visibility ?? row.visibility) === 'public';

  if (!publish) {
    const checked = checkCreationTexts({ title: [title] }, { publish: false });
    if (!checked.ok) return bad(checked.message, 422, 'moderation');
    const { error: upd } = await supabase
      .from('creations')
      .update({ title, show_code: showCode, visibility: 'private' })
      .eq('id', id);
    if (upd) {
      reportServerError(upd, { area: 'creations', op: 'update' });
      return bad(FAILED, 500, 'server');
    }
    return NextResponse.json({ id, title, showCode, visibility: 'private' });
  }

  const admin = createAdminClient();
  const blocked = await guardianWriteGate(user.id, admin);
  if (blocked) return blocked;
  if (row.hidden_at)
    return bad('운영자가 숨긴 작품이라 다시 올릴 수 없어요.', 409, 'hidden');
  if (
    !row.quest_id ||
    !(await publishableQuests(supabase, user.id, [row.quest_id])).size
  )
    return bad(
      '갤러리에는 메이커 시티 프로젝트를 끝낸 작품만 올릴 수 있어요. 이 작품은 내 작품함에 간직해 둘게요.',
      409,
      'not_eligible',
    );

  const drawing = row.commands_gz
    ? parseCommandsGz(fromBytea(row.commands_gz))
    : null;
  const checked = checkCreationTexts(
    {
      title: [title],
      transcript: (row.transcript as { text: string }[] | null)?.map(
        (r) => r.text,
      ),
      drawing: drawing?.ok ? drawing.texts : [],
      code: showCode ? [row.code] : [],
    },
    { publish: true },
  );
  if (!checked.ok) return bad(checked.message, 422, 'moderation');

  const { error: pub } = await admin
    .from('creations')
    .update({
      title,
      show_code: showCode,
      visibility: 'public',
      // 처음 공개한 시각을 지킨다: 내렸다 다시 올려도 갤러리 맨 앞으로 오지 않고, 신고 수(00055 report_creation)도 이어서 센다.
      // 운영자가 숨김을 풀 때만 새로 (그 뒤 신고만 셈)
      published_at: row.published_at ?? new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);
  if (pub) {
    reportServerError(pub, { area: 'creations', op: 'publish' });
    return bad(FAILED, 500, 'server');
  }
  return NextResponse.json({ id, title, showCode, visibility: 'public' });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await signedIn();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return bad('작품을 찾지 못했어요.', 404, 'not_found');
  const { data, error } = await supabase
    .from('creations')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) {
    reportServerError(error, { area: 'creations', op: 'delete' });
    return bad(FAILED, 500, 'server');
  }
  if (!data?.length) return bad('작품을 찾지 못했어요.', 404, 'not_found');
  return NextResponse.json({ id, deleted: true });
}
