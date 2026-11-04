// 보고서용 압축 표: node bench/report-tables.mjs results/raw/measure.json [scene]
import { readFileSync } from 'node:fs';
const [, , IN] = process.argv;
const { rows } = JSON.parse(readFileSync(IN, 'utf8'));
const med = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const f = (a, d = 0) => (a.length > 1 ? `${med(a).toFixed(d)} [${Math.min(...a).toFixed(d)}–${Math.max(...a).toFixed(d)}]` : a.length ? med(a).toFixed(d) : '-');
const fps = (r) => (r.deltas.length * 1000) / r.deltas.reduce((x, y) => x + y, 0);
const p95 = (r) => [...r.deltas].sort((a, b) => a - b)[Math.floor(r.deltas.length * 0.95)];
const LABEL = {
  none: '기준선 (애니메이션 없음)', rig: '**SVG 리그** (A, 소품 끔)', 'rig-full': 'SVG 리그 (A, 소품+모자+망토)', 'rig-b': 'SVG 리그 (B, 필터·12fps)', 'rig-lite': 'SVG 리그 lite (30fps 상한)',
  'lottie-svg': 'lottie-web SVG (같은 춤)', 'lottie-canvas': 'lottie-web canvas (같은 춤)', dotlottie: 'dotLottie (같은 춤)', 'rive-avatar': 'Rive avatars.riv (얼굴만, 다른 캐릭터)', 'rive-birb': 'Rive birb.riv (래스터 메시, 다른 캐릭터)',
};
const rates = [...new Set(rows.map((r) => r.rate))].sort((a, b) => a - b);
const cands = [...new Set(rows.map((r) => r.c))];
for (const scene of [...new Set(rows.map((r) => r.scene))]) {
  const hi = rates[rates.length - 1];
  const mid = rates.length > 1 ? rates[rates.length - 2] : hi;
  console.log(`\n**${scene === 'single' ? '캐릭터 1개 (240px)' : '바쁜 장면: 캐릭터 3개 + confetti'}**\n`);
  console.log(`| 후보 | ${rates.map((x) => `${x}× fps`).join(' | ')} | ${hi}× p95 프레임(ms) | ${mid}× 메인 스레드 % | ${hi}× 긴 작업(5초) | 첫 프레임 1× (ms) |`);
  console.log(`|---|${rates.map(() => '---:').join('|')}|---:|---:|---:|---:|`);
  for (const c of cands) {
    const g = (rate) => rows.filter((r) => r.scene === scene && r.rate === rate && r.c === c);
    if (!g(hi).length) continue;
    const first = g(rates[0]).map((r) => r.marks.allFirst);
    console.log(`| ${LABEL[c] ?? c} | ${rates.map((x) => f(g(x).map(fps), 1)).join(' | ')} | ${f(g(hi).map(p95), 0)} | ${f(g(mid).map((r) => r.cpu.task * 100))} | ${f(g(hi).map((r) => r.longtasks.length))} | ${rates[0] === 1 ? f(first) : '-'} |`);
  }
}
const loads = rows.map((r) => r.load1);
console.log(`\n실행 ${rows.length}회, 측정 중 load(1분) 중앙값 ${med(loads).toFixed(1)} [${Math.min(...loads).toFixed(1)}–${Math.max(...loads).toFixed(1)}]`);
