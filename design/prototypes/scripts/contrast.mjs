// 시안별 대비 표 (마크다운) — src/shared/tokens.ts의 PALETTES·PAIRS로 계산
//   node scripts/contrast.mjs            # 표 출력
//   node scripts/contrast.mjs --check    # 미달이 있으면 종료 코드 1
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export async function loadTokens() {
  const r = await build({
    stdin: {
      contents: "export * from './src/shared/tokens.ts'; export * from './src/shared/contrast.ts';",
      resolveDir: ROOT,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = r.outputFiles[0].text;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

const t = await loadTokens();
let fails = 0;
const lines = [];
for (const c of t.CONCEPTS) {
  const p = t.PALETTES[c];
  lines.push(`\n#### ${c} ${t.CONCEPT_NAME[c]}\n`);
  lines.push('| 쓰임 | 글자·전경 | 배경 | 대비 | 기준 | 판정 |');
  lines.push('|---|---|---|---:|---:|---|');
  for (const pr of t.PAIRS) {
    const r = t.contrast(p[pr.fg], p[pr.bg]);
    const ok = t.passes(r, pr.kind);
    if (!ok) fails++;
    lines.push(
      `| ${pr.use} | \`${pr.fg}\` ${p[pr.fg]} | \`${pr.bg}\` ${p[pr.bg]} | ${t.fmtRatio(r)} | ${t.THRESHOLD[pr.kind]} | ${ok ? '통과' : '**미달**'} |`,
    );
  }
}
lines.push('\n#### 브랜드 초록 비교\n');
lines.push('| | 초록 | 흰 글자 (버튼) | 시안 배경 위 글자 | 시안 표면 위 글자 |');
lines.push('|---|---|---:|---:|---:|');
const legacyBgs = ['#f8f5ee', '#fdfcf8'];
lines.push(
  `| 지금 앱 | ${t.LEGACY_GREEN} | ${t.fmtRatio(t.contrast('#ffffff', t.LEGACY_GREEN))} | ${legacyBgs.map((b) => t.fmtRatio(t.contrast(t.LEGACY_GREEN, b))).join(' / ')} (앱 배경) | — |`,
);
for (const c of t.CONCEPTS) {
  const p = t.PALETTES[c];
  lines.push(
    `| ${c} 주 버튼 \`primary\` | ${p.primary} | ${t.fmtRatio(t.contrast(p.onPrimary, p.primary))} (${p.onPrimary}) | ${t.fmtRatio(t.contrast(p.primary, p.bg))} | ${t.fmtRatio(t.contrast(p.primary, p.surface))} |`,
  );
  lines.push(
    `| ${c} 초록 글자 \`primaryText\` | ${p.primaryText} | — | ${t.fmtRatio(t.contrast(p.primaryText, p.bg))} | ${t.fmtRatio(t.contrast(p.primaryText, p.surface))} |`,
  );
}
console.log(lines.join('\n'));
console.log(`\n미달 ${fails}개`);
if (process.argv.includes('--check') && fails) process.exit(1);
