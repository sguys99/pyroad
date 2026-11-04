// 검사기(checker.js) 단위 테스트. 명령 스트림은 shim을 CPython으로 돌려 만든 fixture 사용.
//   python3 -I test/crosscheck.py --fixtures test/out/fixtures && node test/checker.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyze, findShape, findCircles, matchDrawing, runRules, colorsUsed } from '../checker.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'out/fixtures');
if (!fs.existsSync(path.join(FIX, 'square.json'))) {
  execFileSync('python3', ['-I', path.join(HERE, 'crosscheck.py'), '--fixtures', FIX], { stdio: 'inherit' });
}
const load = (n) => analyze(JSON.parse(fs.readFileSync(path.join(FIX, n + '.json'), 'utf8')));
const samples = JSON.parse(fs.readFileSync(path.join(HERE, '../samples/index.json'), 'utf8'));

let pass = 0, fail = 0;
const rows = [];
function expect(name, cond, detail = '') {
  if (cond) pass++; else fail++;
  rows.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// 1) 예제마다 index.json 규칙이 통과해야 함
for (const s of samples) {
  if (!s.rules.length || !fs.existsSync(path.join(FIX, s.id + '.json'))) continue;
  const r = runRules(load(s.id), s.rules);
  expect(`sample:${s.id} rules`, r.ok, r.results.map((x) => (x.ok ? 'ok' : x.reasons.join(' '))).join(' | '));
}

// 2) 정사각형 판정: 양성 / 음성
const sq = { shape: 'regular', n: 4, side: 150 };
for (const n of ['pos_square_split', 'pos_square_cw_offset', 'pos_square_midstart']) {
  const r = findShape(load(n), sq);
  expect(`square ok: ${n}`, r.ok, r.reasons.join(' '));
}
for (const n of ['neg_rectangle', 'neg_open3', 'neg_bad_angle']) {
  const r = findShape(load(n), sq);
  expect(`square rejects: ${n}`, !r.ok, r.reasons.join(' '));
}

// 3) 별: 채우기 필요
expect('star filled ok', findShape(load('star'), { shape: 'regular', n: 5, k: 2, filled: true }).ok);
{
  const r = findShape(load('neg_star_unfilled'), { shape: 'regular', n: 5, k: 2, filled: true });
  expect('star unfilled rejected', !r.ok, r.reasons.join(' '));
  expect('star (no fill rule) ok', findShape(load('neg_star_unfilled'), { shape: 'regular', n: 5, k: 2 }).ok);
}

// 4) 원 찾기: circle()과 직접 만든 원 모두
{
  const c = findCircles(load('pos_circle_r50'));
  expect('circle() x2 found', c.length === 2 && c.every((x) => Math.abs(x.r - 50) < 0.3 && x.extent > 350), JSON.stringify(c.map((x) => [x.r.toFixed(2), x.cx.toFixed(1), x.cy.toFixed(1), x.dir, x.extent.toFixed(0)])));
  const h = findCircles(load('pos_handmade_circle'));
  const r = 10 / (2 * Math.sin((5 * Math.PI) / 180));
  expect('hand-made circle found', h.length === 1 && Math.abs(h[0].r - r) < 0.3, JSON.stringify(h.map((x) => [x.r.toFixed(2), x.steps, x.extent.toFixed(0)])));
  const f = findCircles(load('flower')).filter((x) => x.extent > 350 && Math.abs(x.r - 70) < 1);
  expect('flower: 12 circles r=70', f.length === 12, `found ${f.length}`);
}

// 5) 정답 그림 비교 (순서·방향 무관, 빠진 선/남는 선)
{
  const ref = load('house_ref');
  const m1 = matchDrawing(load('house_other_order'), ref, { tol: 1 });
  expect('house: other order matches', m1.ok, `score ${m1.score.toFixed(2)} ${m1.reasons.join(' ')}`);
  const m2 = matchDrawing(load('house_missing_roof'), ref, { tol: 1 });
  expect('house: missing roof detected', !m2.ok && m2.missing.length === 2, `missing ${m2.missing.length}, score ${m2.score.toFixed(2)}`);
  const m3 = matchDrawing(load('pos_square_split'), load('square'), { tol: 1 });
  expect('square split into halves == square', m3.ok, m3.reasons.join(' '));
  const m4 = matchDrawing(load('pos_square_cw_offset'), load('square'), { tol: 1, normalize: 'translate' });
  expect('square elsewhere (translate) == square', m4.ok, m4.reasons.join(' '));
  const m5 = matchDrawing(load('pos_square_cw_offset'), load('square'), { tol: 1 });
  expect('square elsewhere (no normalize) != square', !m5.ok);
}

// 6) 기타
expect('spiral colors >= 6', colorsUsed(load('spiral')).length >= 6);
expect('hangul text', load('hangul').texts.some((t) => t.text.includes('안녕')));

console.log(rows.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
