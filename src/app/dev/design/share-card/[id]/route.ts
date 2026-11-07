import { ImageResponse } from 'next/og';
import { connection } from 'next/server';
import { isTestPagesEnabled } from '@/lib/env/testPages';
import { renderShareCard } from '@/lib/share-card/cards';
import { loadShareCardFonts } from '@/lib/share-card/fonts';
import { SHARE_CARD_SAMPLES } from '@/lib/share-card/samples';
import { CARD } from '@/lib/share-card/tokens';

/**
 * 공유 카드 샘플 PNG (P2-12 카탈로그, 개발·e2e 전용). 샘플 데이터(`SHARE_CARD_SAMPLES`)를 운영과 같은 엔진
 * (next/og = satori + resvg)으로 요청 때 그린다 → `docs/design/img/share-card/`의 PNG와 달리 템플릿을 고치면 바로 보인다.
 * 운영 빌드에서는 404 (`isTestPagesEnabled`). 공유 링크·캐시·비공개 처리는 P9-07~P9-11
 */
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection(); // 요청 때 env를 읽는다 (빌드에 굳지 않음)
  if (!isTestPagesEnabled()) return new Response('Not Found', { status: 404 });
  const { id } = await params;
  const sample = SHARE_CARD_SAMPLES.find((s) => s.id === id);
  if (!sample) return new Response('Not Found', { status: 404 });
  const fonts = await loadShareCardFonts();
  return new ImageResponse(renderShareCard(sample.data), {
    ...CARD,
    fonts,
    headers: { 'Cache-Control': 'no-store' },
  });
}
