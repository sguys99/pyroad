// 교차 출처 이미지 흉내 (127.0.0.1:3105 로 접근). plain: 헤더 없음 / corp: CORP cross-origin / cors: ACAO *
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==',
  'base64',
);

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const headers: Record<string, string> = { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' };
  if (name === 'corp.png') headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
  if (name === 'cors.png') headers['Access-Control-Allow-Origin'] = '*';
  return new Response(PNG, { headers });
}
