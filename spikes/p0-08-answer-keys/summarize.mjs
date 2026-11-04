#!/usr/bin/env node
// results.jsonl → 시나리오별 마크다운 표
import { readFileSync } from 'node:fs';

const rows = readFileSync(process.argv[2], 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const esc = (s) =>
  String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
const kindLabel = { security: '보안', 'known-gap': '현재 취약', info: '참고' };

const out = [
  '# P0-08 접근 점검 결과',
  '',
  `생성: ${new Date().toISOString()}`,
  '',
];
const scenarios = [...new Set(rows.map((r) => r.scenario))];
for (const s of scenarios) {
  const rs = rows.filter((r) => r.scenario === s);
  out.push(`## ${s} (${rs.filter((r) => r.pass).length}/${rs.length})`, '');
  out.push(
    '| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const r of rs) {
    out.push(
      `| ${r.id} | ${esc(r.role)} | ${esc(r.op)} | ${esc(r.expected)} | ${esc(r.actual)} | ${r.pass ? 'PASS' : '**FAIL**'} | ${kindLabel[r.kind] ?? r.kind} | ${esc(r.detail).slice(0, 140)} |`,
    );
  }
  out.push('');
}
const pass = rows.filter((r) => r.pass).length;
out.push(`합계: ${pass}/${rows.length} PASS, FAIL ${rows.length - pass}`);
console.log(out.join('\n'));
