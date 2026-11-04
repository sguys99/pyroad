// 정적 렌더 검증: PybaemStatic → (P0-10 직렬화기 | renderToStaticMarkup) → SVG 문자열 → resvg PNG
// 공유 카드(next/og: satori + resvg)와 같은 경로로 그려지는지 확인
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { Resvg } from '@resvg/resvg-js';
import { PybaemStatic } from '../src/rig/RigSvg';
import { serializeSvg } from '../../p0-10-og-share-card/lib/svg';
import type { RigState, RigStyle } from '../src/rig/params';
import type { Costume } from '../src/rig/costumes';

const OUT = process.env.OUT_DIR ?? '/tmp/claude-1000/-home-sguys99-project-pyroad/82568201-fb29-4b3f-a687-90ce910c2b13/scratchpad/P0-07/static';
mkdirSync(OUT, { recursive: true });
const cases: { id: string; state: RigState; style: RigStyle; costume: Costume; reduced?: boolean }[] = [
  { id: 'a-happy', state: 'happy', style: 'A', costume: { hat: 'party', glasses: 'round', cape: '#E53935' } },
  { id: 'a-think', state: 'think', style: 'A', costume: { hat: 'explorer' } },
  { id: 'a-sad', state: 'sad', style: 'A', costume: { hat: 'crown', bg: 'island' } },
  { id: 'b-cheer', state: 'cheer', style: 'B', costume: { hat: 'wizard', bg: 'paper' } },
  { id: 'b-dance', state: 'dance', style: 'B', costume: { glasses: 'sun', cape: '#5C6BC0' } },
  { id: 'reduced-happy', state: 'happy', style: 'A', costume: {}, reduced: true },
];
const report: unknown[] = [];
for (const c of cases) {
  const el = <PybaemStatic state={c.state} style={c.style} costume={c.costume} size={256} framing="stage" reduced={c.reduced} idPrefix={`s${c.id.replace(/-/g, '')}`} />;
  const t0 = performance.now();
  const viaP010 = serializeSvg(el);
  const t1 = performance.now();
  const viaReact = renderToStaticMarkup(el);
  const t2 = performance.now();
  const svg = viaP010.startsWith('<svg') && !viaP010.includes('xmlns=') ? viaP010.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"') : viaP010;
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: 256 }, font: { loadSystemFonts: false } });
  const png = r.render().asPng();
  const t3 = performance.now();
  writeFileSync(`${OUT}/${c.id}.svg`, svg);
  writeFileSync(`${OUT}/${c.id}.react.svg`, viaReact);
  writeFileSync(`${OUT}/${c.id}.resvg.png`, png);
  report.push({ id: c.id, svgBytes: svg.length, serializeMs: +(t1 - t0).toFixed(2), reactMs: +(t2 - t1).toFixed(2), resvgMs: +(t3 - t2).toFixed(1), hasFunctionLeak: /function|=>/.test(svg) });
}
console.table(report);
writeFileSync(new URL('../results/static-svg.json', import.meta.url).pathname, JSON.stringify(report, null, 1));
