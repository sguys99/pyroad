import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateAchievements } from '@/lib/quest/rewardRpc';
import { reportServerError } from '@/lib/api/serverError';
import {
  checkCreationTexts,
  codeTooLong,
  creationMetaSchema,
  isThumbnailPng,
  parseCommandsGz,
  toBytea,
} from '@/lib/creations/server';
import { CREATIONS_PER_USER } from '@/lib/creations/limits';

/**
 * 내 작품 (P11-06). 사용자는 `auth.getUser()`로 확인한 id 만, 읽기·쓰기는 본인 세션(RLS 00054 — 본인 행·비공개 저장만)
 *
 * - `GET` 내 작품 목록 (그림 바이트 없이. 썸네일은 `/api/creations/{id}/thumbnail`)
 * - `POST` multipart: `meta`(JSON — kind·title·questId·code·transcript) + `commands`(turtle 명령 JSON gzip, 그림만) + `thumbnail`(PNG, 선택).
 *   명령은 서버가 풀어서 검사하고 다시 압축해 넣는다(100KB). 저장은 늘 비공개 → 보호자 동의 게이트 없음(공개는 PATCH)
 * - 요청 한도 `creations:save` 분당 6 · 하루 60, 한 사람 60개(DB 트리거)
 */

const SAVE_FAILED = '작품을 저장하지 못했어요. 잠시 뒤에 다시 해 줘요.';

function bad(message: string, status = 400, code = 'invalid') {
  return NextResponse.json({ error: message, code }, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('creations')
    .select(
      'id, kind, title, quest_id, visibility, show_code, hidden_at, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    reportServerError(error, { area: 'creations', op: 'list' });
    return bad('작품을 불러오지 못했어요.', 500, 'server');
  }
  return NextResponse.json({ creations: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  let metaJson: unknown = null;
  try {
    metaJson = JSON.parse(String(form?.get('meta') ?? ''));
  } catch {
    // 아래 zod 가 400
  }
  const parsed = creationMetaSchema.safeParse(metaJson);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === 'title');
    return bad(issue?.message ?? '작품 정보가 이상해요. 다시 해 줘요.');
  }
  const meta = parsed.data;
  if (codeTooLong(meta.code))
    return bad('코드가 너무 길어서 저장할 수 없어요.');

  const commandsFile = form?.get('commands');
  const thumbFile = form?.get('thumbnail');
  let commands: Buffer | null = null;
  let texts: string[] = [];
  if (meta.kind === 'drawing') {
    if (!(commandsFile instanceof Blob)) return bad('저장할 그림이 없어요.');
    const r = parseCommandsGz(new Uint8Array(await commandsFile.arrayBuffer()));
    if (!r.ok) return bad(r.message);
    commands = r.gz;
    texts = r.texts;
  }
  let thumbnail: Uint8Array | null = null;
  if (meta.kind === 'drawing' && thumbFile instanceof Blob) {
    thumbnail = new Uint8Array(await thumbFile.arrayBuffer());
    if (!isThumbnailPng(thumbnail))
      return bad('그림 미리보기를 읽지 못했어요.');
  }

  const checked = checkCreationTexts(
    {
      title: [meta.title],
      transcript: meta.transcript?.map((r) => r.text),
      drawing: texts,
    },
    { publish: false },
  );
  if (!checked.ok) return bad(checked.message, 422, 'moderation');

  // 요청 한도 (실패하면 막지 않음 — 저장은 개수 상한·DB CHECK 가 지킴)
  const { data: quota, error: quotaError } = await createAdminClient().rpc(
    'consume_rate_limit',
    {
      p_user_id: user.id,
      p_bucket: 'creations:save',
      p_per_minute: 6,
      p_per_day: 60,
    },
  );
  if (quotaError)
    reportServerError(quotaError, { area: 'creations', op: 'rate_limit' });
  else if ((quota as { allowed?: boolean } | null)?.allowed === false)
    return bad(
      '너무 빨리 저장하고 있어요. 잠깐 쉬었다가 해 줘요.',
      429,
      'rate_limited',
    );

  const { data, error } = await supabase
    .from('creations')
    .insert({
      user_id: user.id,
      quest_id: meta.questId,
      kind: meta.kind,
      title: meta.title,
      code: meta.code,
      commands_gz: commands ? toBytea(commands) : null,
      transcript: meta.transcript ?? null,
      thumbnail: thumbnail ? toBytea(thumbnail) : null,
    })
    .select('id')
    .single();
  if (error) {
    if (error.message?.includes('creations_limit'))
      return bad(
        `작품함이 가득 찼어요 (${CREATIONS_PER_USER}개). 내 작품함에서 안 쓰는 작품을 지우고 다시 저장해 줘요.`,
        409,
        'limit',
      );
    // 없는 퀘스트 id (23503)
    if (error.code === '23503')
      return bad('어느 퀘스트의 작품인지 모르겠어요.');
    reportServerError(error, { area: 'creations', op: 'insert' });
    return bad(SAVE_FAILED, 500, 'server');
  }
  // 업적 "첫 작품"(00057): 저장 행을 보고 판정. 실패해도 다음 판정·도감 열기 때 잡힘
  await evaluateAchievements(createAdminClient(), user.id);
  return NextResponse.json({ id: data.id }, { status: 201 });
}
