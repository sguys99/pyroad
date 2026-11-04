/**
 * 실험: Route Handler에서 react-dom/server(renderToStaticMarkup)로 캐릭터 SVG 문자열 만들기.
 * 결과는 보고서 4.4 참조. app/ 밖에 두어 기본 빌드에 포함하지 않습니다.
 * 확인 방법: cp experiments/rds-route.tsx <앱>/app/api/og-rds/route.tsx 후 GET /api/og-rds
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { PybaemSvg } from '@/vendor/characters/PybaemSvg';

export const runtime = 'nodejs';

export async function GET() {
  const svg = renderToStaticMarkup(<PybaemSvg expression="happy" size={128} />);
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
}
