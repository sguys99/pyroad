/**
 * 카드 PNG 스냅샷 비교 (P9-07, P0-10 §7): 운영과 같은 `next/og`(satori + resvg)로 샘플을 그려 커밋한 샘플 PNG
 * (`docs/design/img/share-card/<id>.png`)와 픽셀을 비교한다. Next·satori·resvg·폰트·리그가 바뀌어 카드 모양이 달라지면 실패.
 * 의도한 변경이면 `npm run share-card:render`로 샘플을 다시 그리고 PNG 를 같은 커밋에.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ImageResponse } from 'next/og';
import { renderShareCard } from '../cards';
import { loadShareCardFonts } from '../fonts';
import { SHARE_CARD_SAMPLES } from '../samples';
import { CARD, SAFE } from '../tokens';

const DIR = join(process.cwd(), 'docs/design/img/share-card');

async function raw(png: Buffer) {
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** 채널 차이가 24를 넘는 픽셀 비율 (안티에일리어싱 흔들림은 무시) */
function diffRatio(a: Buffer, b: Buffer): number {
  let bad = 0;
  for (let i = 0; i < a.length; i += 3) {
    if (
      Math.abs(a[i] - b[i]) > 24 ||
      Math.abs(a[i + 1] - b[i + 1]) > 24 ||
      Math.abs(a[i + 2] - b[i + 2]) > 24
    )
      bad++;
  }
  return bad / (a.length / 3);
}

describe('카드 PNG 스냅샷 (P9-07)', () => {
  it.each(SHARE_CARD_SAMPLES.map((s) => [s.id, s] as const))(
    '%s: 커밋한 샘플과 같은 그림',
    async (id, sample) => {
      const res = new ImageResponse(renderShareCard(sample.data), {
        ...CARD,
        fonts: await loadShareCardFonts(),
      });
      const now = await raw(Buffer.from(await res.arrayBuffer()));
      const saved = await raw(readFileSync(join(DIR, `${id}.png`)));
      expect([now.width, now.height]).toEqual([CARD.width, CARD.height]);
      expect([saved.width, saved.height]).toEqual([CARD.width, CARD.height]);
      expect(diffRatio(now.data, saved.data)).toBeLessThan(0.002);
      // 카카오 2:1 스마트 크롭(P9-09): 위아래 SAFE(20px) 줄은 바탕색뿐 — 잘려도 핵심 요소가 남는다
      const bg = now.data.subarray(0, 3);
      const rows = [
        ...Array.from({ length: SAFE.top }, (_, y) => y),
        ...Array.from({ length: SAFE.bottom }, (_, y) => CARD.height - 1 - y),
      ];
      for (const y of rows)
        for (let x = 0; x < CARD.width; x++) {
          const i = (y * CARD.width + x) * 3;
          expect([now.data[i], now.data[i + 1], now.data[i + 2]]).toEqual([
            ...bg,
          ]);
        }
    },
    20_000,
  );
});
