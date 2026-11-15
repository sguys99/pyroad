import { createClient } from '@/lib/supabase/server';
import { isUuid, reportServerError } from '@/lib/api/serverError';
import { fromBytea } from '@/lib/creations/server';

/**
 * 작품 썸네일 PNG (P11-06). 지금은 본인 작품만(RLS 00054). 친구 공개 작품은 갤러리(P11-07)가 넓힌다.
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
  const { data, error } = await supabase
    .from('creations')
    .select('thumbnail')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    reportServerError(error, { area: 'creations', op: 'thumbnail' });
    return new Response(null, { status: 500 });
  }
  if (!data?.thumbnail) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(fromBytea(data.thumbnail)), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=86400, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
