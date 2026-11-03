// validate.mjs 결과 → 정답 단계(기준선) 대비 감지 정확도·정착 시간
// 사용: node bench/analyze.mjs results/raw/validate.json [results/validate-summary.md]
import { readFileSync, writeFileSync } from 'node:fs';
const [, , IN, OUT] = process.argv;
const d = JSON.parse(readFileSync(IN, 'utf8'));
const TIERS = ['full', 'lite', 'minimal'];
const idx = (t) => TIERS.indexOf(t);
const lower = (a, b) => (idx(a) >= idx(b) ? a : b);
const med = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
};
const OK_DROP = 0.25; // 감지기의 '나쁜 창' 기준과 같음
let md = `측정 ${d.at}\n\n#### ① 기준선: 단계를 고정했을 때 장면 성능 (중앙값, 놓친 프레임 %)\n\n| 장면 | 스로틀 | full fps / 놓침 | lite fps / 놓침 | minimal fps / 놓침 | 정답 단계 |\n|---|---|---:|---:|---:|---|\n`;
const oracle = {};
const scenes = [...new Set(d.oracle.map((o) => o.scene))];
const rates = [...new Set(d.oracle.map((o) => o.rate))];
for (const scene of scenes)
  for (const rate of rates) {
    const cell = {};
    for (const t of TIERS) {
      const rs = d.oracle.filter((o) => o.scene === scene && o.rate === rate && o.tier === t);
      cell[t] = { fps: med(rs.map((r) => r.fps)), drop: med(rs.map((r) => r.drop)), n: rs.length };
    }
    const ans = TIERS.find((t) => cell[t].drop <= OK_DROP) ?? 'minimal';
    oracle[`${scene}|${rate}`] = ans;
    md += `| ${scene} | ${rate}× | ${TIERS.map((t) => `${cell[t].fps.toFixed(0)} / ${(cell[t].drop * 100).toFixed(0)}%`).join(' | ')} | **${ans}** |\n`;
  }
const staticCap = { pc: 'full', chromebook: 'lite', weak: 'lite', ipad: 'full' };
md += `\n#### ② 자동 감지 (각 ${Math.max(...d.detect.map((x) => x.rep)) + 1}회 반복)\n\n| 장면 | 프로필 | 스로틀 | 기대 단계 | 결과 (반복별) | 정착 시간 ms (중앙값) | 일치 |\n|---|---|---|---|---|---:|---|\n`;
let ok = 0;
let total = 0;
let under = 0;
let over = 0;
let upgrades = 0;
const settle = [];
const keys = [...new Set(d.detect.map((x) => `${x.scene}|${x.profile}|${x.rate}`))];
for (const k of keys) {
  const [scene, profile, rate] = k.split('|');
  const rs = d.detect.filter((x) => `${x.scene}|${x.profile}|${x.rate}` === k);
  const expect = lower(oracle[`${scene}|${rate}`] ?? 'full', staticCap[profile]);
  const finals = rs.map((r) => r.log[r.log.length - 1].tier);
  const st = rs.map((r) => (r.log.length > 1 ? r.log[r.log.length - 1].t : 0));
  for (const r of rs) {
    for (let i = 1; i < r.log.length; i++) if (idx(r.log[i].tier) < idx(r.log[i - 1].tier)) upgrades++;
  }
  finals.forEach((f, i) => {
    total++;
    if (f === expect) ok++;
    else if (idx(f) > idx(expect)) under++;
    else over++;
    if (rs[i].log.length > 1) settle.push(st[i]);
  });
  md += `| ${scene} | ${profile} | ${rate}× | ${expect} | ${finals.join(', ')} | ${med(st).toFixed(0)} | ${finals.filter((f) => f === expect).length}/${finals.length} |\n`;
}
const smooth = d.detect.filter((r) => r.after.drop <= OK_DROP).length;
const smoothByRate = [...new Set(d.detect.map((r) => r.rate))].map((rate) => {
  const rs = d.detect.filter((r) => r.rate === rate);
  return `${rate}× ${rs.filter((r) => r.after.drop <= OK_DROP).length}/${rs.length}`;
});
md += `\n**정착 후 실제로 매끄러웠나** (감지가 끝난 뒤 3초 동안 놓친 프레임 ≤ 25%): ${smooth}/${d.detect.length} (${((smooth / d.detect.length) * 100).toFixed(0)}%) — ${smoothByRate.join(', ')}\n`;
md += `\n일치 ${ok}/${total} (${((ok / total) * 100).toFixed(0)}%), 기대보다 낮게 ${under}, 높게 ${over}, 세션 중 상향 ${upgrades}회. 단계가 바뀐 실행의 정착 시간 중앙값 ${med(settle).toFixed(0)}ms [${Math.min(...settle)}–${Math.max(...settle)}]\n`;
md += `\n#### ③ 긴 작업 주입 (1×, light 장면: 3초에 400ms + 6·7·8초에 150ms)\n\n| 긴 작업 | 결과 (반복별) |\n|---|---|\n`;
for (const j of [0, 1]) md += `| ${j ? '있음' : '없음'} | ${d.jank.filter((x) => x.jank === j).map((x) => x.log.map((e) => e.tier).join('→')).join(' / ')} |\n`;
md += `\n#### ④ 정적 신호\n\n| 조건 | 단계 기록 | html data-* |\n|---|---|---|\n`;
for (const s of d.signals) md += `| ${s.name} | ${s.log.map((e) => e.tier).join('→')} | motion=${s.html.motion}, reduced=${s.html.reduced} |\n`;
console.log(md);
if (OUT) writeFileSync(OUT, md);
