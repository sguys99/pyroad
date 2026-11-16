import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/api/serverError';
import { readCreationBytes } from '@/lib/gallery/server';

/**
 * 작품의 turtle 명령 gzip (P11-07). 갤러리 다시 그리기는 이 명령을 재생할 뿐 남의 코드를 실행하지 않는다(Q74 ①).
 * 내 작품 · 갤러리 공개 작품 · (운영자) 숨긴 작품. 브라우저가 DecompressionStream 으로 푼다. 저장 뒤 바뀌지 않아 private 캐시
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, { status: 404 });
  const bytes = await readCreationBytes(id, user, 'commands_gz');
  if (bytes === 'error') return new Response(null, { status: 500 });
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/gzip',
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
