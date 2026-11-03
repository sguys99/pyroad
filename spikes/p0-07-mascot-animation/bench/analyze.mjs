// measure.mjs 결과 → 마크다운 표 (반복의 중앙값, [최소–최대])
// 사용: node bench/analyze.mjs results/raw/measure.json [results/measure-summary.md]
import { readFileSync, writeFileSync } from 'node:fs';
const [, , IN, OUT] = process.argv;
const { rows, at, minutes } = JSON.parse(readFileSync(IN, 'utf8'));
const med = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
};
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
const fmt = (vals, d = 1) => {
  const m = med(vals);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return vals.length > 1 ? `${m.toFixed(d)} [${lo.toFixed(d)}–${hi.toFixed(d)}]` : m.toFixed(d);
};
const per = (r) => {
  const d = r.deltas ?? [];
  const span = d.reduce((a, b) => a + b, 0);
  return {
    fps: (d.length * 1000) / span,
    p95: q(d, 0.95),
    drop: Math.max(0, 1 - d.length / (span / (1000 / 60))) * 100,
    task: r.cpu.task * 100,
    script: r.cpu.script * 100,
    lt: (r.longtasks ?? []).length,
    ltMs: (r.longtasks ?? []).reduce((a, b) => a + b, 0),
    loaf: (r.loafs ?? []).length,
    heap: (r.heapUsed ?? 0) / 1048576,
    first: r.marks?.allFirst ?? NaN,
    load: r.load1,
  };
};
const groups = new Map();
for (const r of rows) {
  if (r.error || r.errors?.length) console.error('ERR', r.c, r.scene, r.rate, r.error ?? r.errors);
  const k = `${r.scene}|${r.rate}|${r.c}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(per(r));
}
const cands = [...new Set(rows.map((r) => r.c))];
const scenes = [...new Set(rows.map((r) => r.scene))];
const rates = [...new Set(rows.map((r) => r.rate))];
let md = `측정 ${at}, ${minutes?.toFixed(1)}분, 실행 ${rows.length}회, load(1분) 중앙값 ${med(rows.map((r) => r.load1)).toFixed(1)} [${Math.min(...rows.map((r) => r.load1)).toFixed(1)}–${Math.max(...rows.map((r) => r.load1)).toFixed(1)}]\n`;
for (const scene of scenes) {
  md += `\n#### ${scene === 'single' ? '캐릭터 1개 (240px)' : '바쁜 장면 (캐릭터 3개 + confetti)'}\n\n| 후보 | ${rates.map((x) => `${x}× fps`).join(' | ')} | ${rates.map((x) => `${x}× p95(ms)`).join(' | ')} | ${rates.map((x) => `${x}× 메인스레드%`).join(' | ')} | 6× 긴 작업 | 힙 MB |\n|---|${rates.map(() => '---:').join('|')}|${rates.map(() => '---:').join('|')}|${rates.map(() => '---:').join('|')}|---:|---:|\n`;
  for (const c of cands) {
    const g = (rate) => groups.get(`${scene}|${rate}|${c}`) ?? [];
    md += `| ${c} | ${rates.map((x) => fmt(g(x).map((v) => v.fps))).join(' | ')} | ${rates.map((x) => fmt(g(x).map((v) => v.p95))).join(' | ')} | ${rates.map((x) => fmt(g(x).map((v) => v.task), 0)).join(' | ')} | ${fmt(g(rates[rates.length - 1]).map((v) => v.lt), 0)} | ${fmt(g(1).map((v) => v.heap))} |\n`;
  }
}
md += `\n#### 첫 프레임까지 (ms, 내비게이션 시작 기준, 로컬 서버)\n\n| 후보 | ${scenes.flatMap((s) => rates.map((x) => `${s} ${x}×`)).join(' | ')} |\n|---|${scenes.flatMap(() => rates.map(() => '---:')).join('|')}|\n`;
for (const c of cands) md += `| ${c} | ${scenes.flatMap((s) => rates.map((x) => fmt((groups.get(`${s}|${x}|${c}`) ?? []).map((v) => v.first), 0))).join(' | ')} |\n`;
console.log(md);
if (OUT) writeFileSync(OUT, md);
