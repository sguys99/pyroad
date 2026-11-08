import { ImageResponse } from 'next/og';
import { PwaIcon } from '@/lib/pwa/iconArt';
import { PWA_MANIFEST_ICONS } from '@/lib/pwa/manifest';

/**
 * manifest 아이콘 `/pwa/icon-192.v1.png` 등 (P4-11). 파비콘·apple-icon과 같은 그림(`src/lib/pwa/iconArt.tsx`).
 * 파일 규칙 `icon`으로 두면 512·maskable까지 모든 페이지 `<head>`에 `<link rel="icon">`이 붙으므로 manifest 전용 라우트로 따로 둔다.
 * 목록 밖 이름은 404, 빌드 때 모두 정적으로 만든다(요청 값을 읽지 않음). 글자가 없어 폰트를 싣지 않는다
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PWA_MANIFEST_ICONS).map((file) => ({ file }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const spec = PWA_MANIFEST_ICONS[file];
  if (!spec) return new Response(null, { status: 404 });
  return new ImageResponse(<PwaIcon kind={spec.kind} size={spec.size} />, {
    width: spec.size,
    height: spec.size,
  });
}
