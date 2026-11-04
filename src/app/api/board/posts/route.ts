import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BOARD_MESSAGES,
  boardError,
  boardServerError,
  checkPostInput,
  readJsonObject,
} from '@/lib/board/server';

// 글쓰기: 길이·빈 값·금칙어 검사 후 service_role 로 저장 (P1-18, B19).
// 사용자 클라이언트로 쓰지 않음: ③ 00015 이후 board_posts 쓰기 권한은 service_role 에만 있음
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return boardError(401, BOARD_MESSAGES.unauthorized);
  }

  const body = await readJsonObject(request);
  if (!body) {
    return boardError(400, BOARD_MESSAGES.badRequest, { code: 'validation' });
  }

  const checked = checkPostInput(body);
  if (!checked.ok) return checked.response;
  const { title, content } = checked.value;

  const { data, error } = await createAdminClient()
    .from('board_posts')
    .insert({ user_id: user.id, title: title!, content: content! })
    .select('id')
    .single();

  if (error || !data) {
    return boardServerError(
      error ?? new Error('insert 결과 없음'),
      'post_create',
    );
  }

  return NextResponse.json({ ok: true, post: { id: data.id } });
}
