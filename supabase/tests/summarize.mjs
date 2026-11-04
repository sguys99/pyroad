#!/usr/bin/env node
// results.jsonl → 터미널 요약 + 마크다운 보고서
// 사용: node summarize.mjs <results.jsonl> [<results.md>]
import { readFileSync, writeFileSync } from 'node:fs';

const [, , src, mdOut] = process.argv;
const rows = readFileSync(src, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const STATUSES = ['PASS', 'GAP', 'PENDING', 'INFO', 'FAIL'];
const scenarios = [...new Set(rows.map((r) => r.scenario))];
const count = (rs, s) => rs.filter((r) => r.status === s).length;
const esc = (s) =>
  String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
// 터미널 표 정렬용 폭 (한글은 2칸)
const width = (s) =>
  [...String(s)].reduce((n, c) => n + (/[\u1100-\uffdc]/.test(c) ? 2 : 1), 0);
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - width(s)));

// ── 터미널 ──
const out = [];
const head = ['시나리오', ...STATUSES, '합계'];
const body = scenarios.map((s) => {
  const rs = rows.filter((r) => r.scenario === s);
  return [s, ...STATUSES.map((st) => count(rs, st)), rs.length];
});
body.push(['전체', ...STATUSES.map((st) => count(rows, st)), rows.length]);
const w = head.map((h, i) =>
  Math.max(width(h), ...body.map((b) => width(b[i]))),
);
const line = (cells) =>
  '| ' + cells.map((c, i) => pad(c, w[i])).join(' | ') + ' |';
out.push(line(head), '|' + w.map((n) => '-'.repeat(n + 2)).join('|') + '|');
for (const b of body) out.push(line(b));

const uniq = (rs) => [...new Map(rs.map((r) => [r.id, r])).values()];
const gaps = uniq(rows.filter((r) => r.status === 'GAP'));
if (gaps.length) {
  out.push(
    '',
    'known-gap (지금 열려 있음, 해당 작업에서 expectations.mjs 의 expect 를 deny 로):',
  );
  const byTask = {};
  for (const r of gaps) (byTask[r.flipIn ?? '?'] ??= []).push(r.id);
  for (const [t, ids] of Object.entries(byTask).sort())
    out.push(`  ${pad(t, 6)} ${ids.join(', ')}`);
}
const pending = uniq(rows.filter((r) => r.status === 'PENDING'));
if (pending.length) {
  out.push('', 'PENDING (대상 객체가 생기면 자동 활성화):');
  const byTask = {};
  for (const r of pending) (byTask[r.activateIn ?? '?'] ??= []).push(r.id);
  for (const [t, ids] of Object.entries(byTask).sort())
    out.push(`  ${pad(t, 6)} ${ids.join(', ')}`);
}
const fails = rows.filter((r) => r.status === 'FAIL');
if (fails.length) {
  out.push('', 'FAIL:');
  for (const r of fails)
    out.push(
      `  [${r.scenario}] ${r.id} ${r.role} :: ${r.op}\n      기대 ${r.expect}, 실제 ${r.actual} — ${r.detail}`,
    );
}
console.log(out.join('\n'));

// ── 마크다운 ──
if (mdOut) {
  const md = [
    '# RLS·권한 회귀 테스트 결과',
    '',
    `생성: ${new Date().toISOString()}`,
    '',
  ];
  md.push(
    `| 시나리오 | ${STATUSES.join(' | ')} | 합계 |`,
    `|---|${STATUSES.map(() => '---').join('|')}|---|`,
  );
  for (const b of body) md.push(`| ${b.join(' | ')} |`);
  for (const s of scenarios) {
    const rs = rows.filter((r) => r.scenario === s);
    md.push('', `## ${s}`, '');
    md.push(
      '| 결과 | ID | 그룹 | 역할 | 동작 | 기대 | 실제 | 뒤집을 작업 | 근거 |',
      '|---|---|---|---|---|---|---|---|---|',
    );
    for (const r of rs)
      md.push(
        `| ${r.status === 'FAIL' ? '**FAIL**' : r.status} | ${r.id} | ${r.group} | ${esc(r.role)} | ${esc(r.op)} | ${r.expect} | ${esc(r.actual)} | ${r.flipIn ?? r.activateIn ?? ''} | ${esc(r.detail).slice(0, 160)} |`,
      );
  }
  writeFileSync(mdOut, md.join('\n') + '\n');
}
process.exit(fails.length ? 1 : 0);
