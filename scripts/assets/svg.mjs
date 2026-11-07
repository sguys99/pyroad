// public/ 아래 SVG(배경·일러스트·아이콘)를 SVGO로 최적화 (P2-16). 설정은 루트 svgo.config.mjs.
//
//   npm run assets:svg              # 최적화해서 덮어씀 (이미 최적화된 파일은 그대로 = 멱등)
//   npm run assets:svg -- --check   # 최적화가 안 됐거나 규칙을 어긴 파일이 있으면 exit 1 (CI)
//
// 마스코트 리그는 SVG 파일이 아니라 코드(geometry 상수)라 대상이 아니다 (docs/design/rig.md).
// 규칙 (공유 카드 직렬화기·resvg 제약, P0-10): <text>·<foreignObject>·래스터 <image> 금지(글자는 경로로), 파일당 크기 예산.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, optimize } from 'svgo';
import { ROOT, isMain, kb, listFiles, rel } from './lib/fsutil.mjs';

/** SVG 파일 하나 크기 예산. 넘으면 그림을 단순하게 하거나 래스터(WebP)로 */
export const SVG_MAX_BYTES = 40 * 1024;

/** public/ 중 대상이 아닌 곳 (Pyodide 복사본) */
const SKIP = ['public/pyodide/'];

/** 최적화와 별개로 지켜야 하는 규칙. 어긴 내용 목록을 돌려준다 */
export function svgRuleProblems(svg) {
  const problems = [];
  if (/<text[\s>]/i.test(svg))
    problems.push('<text> 금지 (글자는 경로로, P0-10)');
  if (/<foreignObject[\s>]/i.test(svg)) problems.push('<foreignObject> 금지');
  if (/<image[\s>]/i.test(svg))
    problems.push('래스터 <image> 금지 (래스터는 raster 파이프라인으로)');
  if (/<(animate|animateTransform|animateMotion|set)[\s>]/i.test(svg)) {
    problems.push(
      'SMIL 애니메이션 금지 (§2.10: 반복 연출은 CSS transform·opacity)',
    );
  }
  return problems;
}

export function svgTargets(root = ROOT) {
  return listFiles(join(root, 'public'), (p) => p.endsWith('.svg')).filter(
    (p) => !SKIP.some((s) => rel(p).startsWith(s)),
  );
}

/**
 * @param {{ check?: boolean, files?: string[] }} opts
 * @returns {Promise<boolean>} 통과 여부
 */
export async function runSvg({ check = false, files = svgTargets() } = {}) {
  const config = await loadConfig(join(ROOT, 'svgo.config.mjs'));
  let ok = true;
  let saved = 0;
  for (const file of files) {
    const input = readFileSync(file, 'utf8');
    const { data } = optimize(input, { ...config, path: file });
    const problems = svgRuleProblems(data);
    const bytes = Buffer.byteLength(data);
    if (bytes > SVG_MAX_BYTES) {
      problems.push(
        `${kb(bytes)} > 예산 ${kb(SVG_MAX_BYTES)} (단순하게 하거나 WebP로)`,
      );
    }
    if (data !== input) {
      if (check) problems.push('최적화가 안 됐어요 (npm run assets:svg)');
      else {
        writeFileSync(file, data);
        saved += Buffer.byteLength(input) - bytes;
        console.log(
          `  ~ ${rel(file)} ${kb(Buffer.byteLength(input))} → ${kb(bytes)}`,
        );
      }
    }
    if (problems.length) {
      ok = false;
      problems.forEach((p) => console.error(`  ✗ ${rel(file)}: ${p}`));
    }
  }
  console.log(
    `  SVG ${files.length}개${!check && saved ? `, ${kb(saved)} 줄임` : ''}`,
  );
  return ok;
}

if (isMain(import.meta.url)) {
  const check = process.argv.includes('--check');
  console.log(`SVG 최적화${check ? ' 확인' : ''} (public/**/*.svg)`);
  runSvg({ check }).then((ok) => {
    if (!ok) process.exit(1);
  });
}
