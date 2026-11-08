// 공유 카드 샘플 렌더 (P2-19, docs/design/share-card.md). 실제 운영과 같은 엔진(next/og = satori + resvg-wasm)으로 그린다.
//
//   npm run share-card:render                       # 샘플 PNG → docs/design/img/share-card/ + 렌더 시간 표
//   npm run share-card:render -- --only=weekly      # id에 이 글자가 든 샘플만
//   npm run share-card:render -- --only=site-og     # 사이트 공유 미리보기 그림만 (P4-10, src/app/opengraph-image.tsx와 같은 그림)
//   npm run share-card:render -- --lab=<폴더>       # backgroundRepeat 실험 이미지 (커밋하지 않음)
//
// JSX를 react-jsx로 돌리려고 `scripts/share-card/tsconfig.json`을 쓴다 (루트는 Next용 `jsx: preserve`).
//
// - <id>.png: 운영 카드 그대로 (1200×630)
// - guide/<kind>.png: 카카오 2:1 크롭(위아래 15px 잘림)과 안전 영역(위아래 20px) 가이드를 겹친 확인용
// - 렌더 시간: 첫 장(cold: wasm·폰트 파싱 포함)과 장마다 3회 반복(warm) 중앙값. 장비 부하에 따라 달라지니 상대 비교로 본다

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { ImageResponse } from 'next/og';
import { COLOR } from '@/lib/design/tokens';
import { renderShareCard } from '@/lib/share-card/cards';
import { loadShareCardFonts } from '@/lib/share-card/fonts';
import { SHARE_CARD_SAMPLES } from '@/lib/share-card/samples';
import { SiteOgCard } from '@/lib/share-card/site';
import { CARD, SAFE } from '@/lib/share-card/tokens';

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs/design/img/share-card');
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function png(
  element: ReactElement,
): Promise<{ buf: Buffer; ms: number }> {
  const fonts = await loadShareCardFonts();
  const t0 = performance.now();
  const res = new ImageResponse(element, { ...CARD, fonts });
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, ms: performance.now() - t0 };
}

/** 카카오 크롭·안전 영역 가이드 (DOM 순서로 카드 위에 겹침) */
function withGuide(card: ReactElement): ReactElement {
  const crop = (CARD.height - CARD.width / 2) / 2; // 15px
  const band = (style: object) => (
    <div style={{ position: 'absolute', left: 0, right: 0, ...style }} />
  );
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: CARD.width,
        height: CARD.height,
      }}
    >
      {card}
      {band({
        top: 0,
        height: crop,
        backgroundColor: COLOR.error,
        opacity: 0.45,
      })}
      {band({
        bottom: 0,
        height: crop,
        backgroundColor: COLOR.error,
        opacity: 0.45,
      })}
      {band({ top: SAFE.top, height: 2, backgroundColor: COLOR.error })}
      {band({ bottom: SAFE.bottom, height: 2, backgroundColor: COLOR.error })}
      <div
        style={{
          position: 'absolute',
          right: 24,
          top: 26,
          display: 'flex',
          padding: '4px 12px',
          borderRadius: 8,
          backgroundColor: COLOR.error,
          color: COLOR.onError,
          fontSize: 20,
        }}
      >
        카카오 2:1 크롭(빨간 띠) · 안전 영역 20px(선)
      </div>
    </div>
  );
}

async function lab(dir: string) {
  mkdirSync(dir, { recursive: true });
  const tile = readFileSync(join(ROOT, 'public/textures/paper-grain.v1.png'));
  const uri = `data:image/png;base64,${tile.toString('base64')}`;
  const cases: [string, object][] = [
    ['repeat', { backgroundRepeat: 'repeat', backgroundSize: '128px 128px' }],
    [
      'no-repeat',
      { backgroundRepeat: 'no-repeat', backgroundSize: '128px 128px' },
    ],
    [
      'repeat-x',
      { backgroundRepeat: 'repeat-x', backgroundSize: '128px 128px' },
    ],
    ['default', { backgroundSize: '128px 128px' }],
  ];
  for (const [name, style] of cases) {
    const el = (
      <div
        style={{
          width: CARD.width,
          height: CARD.height,
          display: 'flex',
          backgroundColor: COLOR.bg,
          backgroundImage: `url(${uri})`,
          ...style,
        }}
      />
    );
    const { buf, ms } = await png(el);
    writeFileSync(join(dir, `bg-${name}.png`), buf);
    console.log(
      `lab bg-${name}: ${(buf.length / 1024).toFixed(0)}KB, ${ms.toFixed(0)}ms`,
    );
  }
}

async function main() {
  const labDir = arg('lab');
  if (labDir) return lab(labDir);
  const only = arg('only');
  mkdirSync(join(OUT, 'guide'), { recursive: true });
  const samples = SHARE_CARD_SAMPLES.filter(
    (s) => !only || s.id.includes(only),
  );
  const rows: string[] = [];
  let first = true;
  const guided = new Set<string>();
  for (const s of samples) {
    const el = renderShareCard(s.data);
    const cold = await png(el);
    const warm: number[] = [];
    for (let i = 0; i < 3; i++) warm.push((await png(el)).ms);
    warm.sort((a, b) => a - b);
    writeFileSync(join(OUT, `${s.id}.png`), cold.buf);
    rows.push(
      `| \`${s.id}\` | ${s.note} | ${(cold.buf.length / 1024).toFixed(0)}KB | ${first ? `${cold.ms.toFixed(0)} (cold)` : cold.ms.toFixed(0)} | ${warm[1].toFixed(0)} |`,
    );
    first = false;
    if (!guided.has(s.data.kind)) {
      guided.add(s.data.kind);
      const g = await png(withGuide(el));
      writeFileSync(join(OUT, 'guide', `${s.data.kind}.png`), g.buf);
    }
    console.log(
      `${s.id}: ${(cold.buf.length / 1024).toFixed(0)}KB, ${cold.ms.toFixed(0)}ms, warm ${warm[1].toFixed(0)}ms`,
    );
  }
  // 사이트 공유 미리보기 (P4-10). 운영은 빌드 때 한 번 정적으로 만든다
  if (!only || 'site-og'.includes(only)) {
    const el = <SiteOgCard />;
    const { buf, ms } = await png(el);
    writeFileSync(join(OUT, 'site-og.png'), buf);
    writeFileSync(
      join(OUT, 'guide', 'site-og.png'),
      (await png(withGuide(el))).buf,
    );
    rows.push(
      `| \`site-og\` | 사이트 OG (P4-10) | ${(buf.length / 1024).toFixed(0)}KB | ${ms.toFixed(0)} | - |`,
    );
    console.log(
      `site-og: ${(buf.length / 1024).toFixed(0)}KB, ${ms.toFixed(0)}ms`,
    );
  }
  console.log(
    '\n| 샘플 | 상태 | PNG | 첫 렌더 ms | warm 중앙값 ms |\n|---|---|---|---|---|',
  );
  console.log(rows.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
