import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/api/serverError';
import { readCreationBytes } from '@/lib/gallery/server';

/**
 * 작품 썸네일 PNG (P11-06). 내 작품 · 갤러리 공개 작품(P11-07, 로그인한 학생만 — Q74 ③) · (운영자) 숨긴 작품.
 * 썸네일은 저장 뒤 바뀌지 않아 브라우저에만 오래 캐시(private — CDN 에는 두지 않음)
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
  const png = await readCreationBytes(id, user, 'thumbnail');
  if (png === 'error') return new Response(null, { status: 500 });
  if (!png) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
