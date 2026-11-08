// 빌드 뒤 랜딩 바이트 예산 검사 (P4-12, §2.10 "CI에서 바이트 예산은 차단"). postbuild에서 돌아 Vercel 빌드에서도 실행된다.
//
//   node scripts/perf/check-landing-budget.mjs   # .next/가 있어야 함 (npm run build 뒤)
//
// 실패 (빌드를 멈춤)
// - 랜딩 첫 JS(HTML의 <script src>, noModule 폴리필 제외) gzip 합계 > 250KB
// - 렌더 차단 CSS(HTML의 <link rel="stylesheet">) gzip 합계 > 15KB
// - 첫 화면 글자를 opacity 0으로 서버 렌더링 (인라인 style에 opacity:0이 걸린 요소 안에 글자가 있음, §2.10 규칙)
// 경고만
// - 예산의 95%를 넘음 (여유가 거의 없음)
//
// 크기는 gzip -9 기준(파일마다 따로 압축한 합). 운영(Vercel brotli)은 이보다 조금 작다.
// 아래쪽 섹션 CSS·로그인 시트·미니 해석기처럼 동적 import로 늦게 오는 것은 첫 로드 예산에 넣지 않는다.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// 다른 빌드 폴더를 볼 때만 바꾼다 (격리 worktree의 빌드 결과 확인 등)
const NEXT = process.env.BUDGET_CHECK_NEXT_DIR ?? join(ROOT, '.next');

export const LANDING_JS_BUDGET = 250 * 1024;
export const LANDING_CSS_BUDGET = 15 * 1024;
/** 이 비율을 넘으면 경고 (실패는 아님) */
export const WARN_RATIO = 0.95;

const attr = (tag, name) =>
  tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1] ?? null;

/** 첫 로드에 받는 스크립트 주소 (`noModule` 폴리필은 요즘 브라우저가 받지 않으므로 뺀다) */
export function firstLoadScripts(html) {
  return [...html.matchAll(/<script\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => attr(tag, 'src') && !/\snomodule\b/i.test(tag))
    .map((tag) => attr(tag, 'src'));
}

/** 렌더 차단 스타일시트 주소 (`media="print"` 같은 비차단 링크는 뺀다) */
export function blockingStylesheets(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter(
      (tag) =>
        /\srel="stylesheet"/i.test(tag) &&
        !/\sdisabled\b/i.test(tag) &&
        !['print', 'none'].includes(attr(tag, 'media') ?? ''),
    )
    .map((tag) => attr(tag, 'href'));
}

/**
 * 인라인 style에 opacity:0이 걸린 요소 중 안에 글자가 있는 것 (서버 HTML에서 글자가 안 보이는 상태로 그려짐).
 * 장식(글자 없는 요소)은 괜찮다. @returns 걸린 요소의 앞부분 (최대 5개)
 */
export function hiddenTextByInlineOpacity(html) {
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const out = [];
  const re =
    /<([a-z][\w-]*)\b[^>]*\sstyle="[^"]*\bopacity:\s*0(?:\.0*)?(?:[;"\s])[^>]*>/gi;
  for (let m = re.exec(body); m && out.length < 5; m = re.exec(body)) {
    const tag = m[1].toLowerCase();
    // 닫는 태그까지 (같은 이름 중첩은 대충 무시: 짧게 본다)
    const end = body.indexOf(`</${tag}>`, m.index);
    const inner = end > 0 ? body.slice(m.index + m[0].length, end) : '';
    const text = inner.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ');
    if (text.trim()) out.push(m[0].slice(0, 120));
  }
  return out;
}

/** `/_next/...` 주소 → `.next/...` 파일 (Skew Protection `?dpl=` 쿼리는 뗌) */
export function staticFile(urlPath, nextDir = NEXT) {
  return join(
    nextDir,
    urlPath.replace(/[?#].*$/, '').replace(/^\/_next\//, ''),
  );
}

export function gzipSize(buf) {
  return gzipSync(buf, { level: 9 }).length;
}

/** 예산 판정 */
export function judge(label, bytes, budget) {
  const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
  const line = `${label} ${kb(bytes)} / ${kb(budget)}`;
  if (bytes > budget) return { level: 'error', line };
  if (bytes > budget * WARN_RATIO)
    return {
      level: 'warn',
      line: `${line} (예산의 ${Math.round((bytes / budget) * 100)}%)`,
    };
  return { level: 'ok', line };
}

function main() {
  const htmlPath = join(NEXT, 'server/app/index.html');
  if (!existsSync(htmlPath)) {
    console.error(
      '[perf:budget] .next/server/app/index.html이 없어요 (npm run build 뒤에, 랜딩이 정적 HTML이어야 함).',
    );
    process.exit(1);
  }
  const html = readFileSync(htmlPath, 'utf8');
  const sum = (urls) => {
    let total = 0;
    const missing = [];
    for (const u of urls) {
      const p = staticFile(u);
      if (existsSync(p)) total += gzipSize(readFileSync(p));
      else missing.push(u);
    }
    return { total, missing };
  };
  const scripts = firstLoadScripts(html);
  const sheets = blockingStylesheets(html);
  const js = sum(scripts);
  const css = sum(sheets);
  const results = [
    judge(`첫 JS(gzip, ${scripts.length}개)`, js.total, LANDING_JS_BUDGET),
    judge(
      `렌더 차단 CSS(gzip, ${sheets.length}개)`,
      css.total,
      LANDING_CSS_BUDGET,
    ),
  ];
  const errors = results
    .filter((r) => r.level === 'error')
    .map((r) => `${r.line} 초과`);
  const warnings = results.filter((r) => r.level === 'warn').map((r) => r.line);
  for (const u of [...js.missing, ...css.missing])
    errors.push(`HTML이 가리키는 파일이 .next에 없음: ${u}`);
  const hidden = hiddenTextByInlineOpacity(html);
  if (hidden.length)
    errors.push(
      `글자가 든 요소가 opacity 0으로 서버 렌더됨 (첫 화면 글자는 보이는 상태로, 등장은 transform만 — §2.10):\n    ${hidden.join('\n    ')}`,
    );

  console.log(`[perf:budget] 랜딩 ${results.map((r) => r.line).join(' · ')}`);
  for (const w of warnings)
    console.warn(`[perf:budget] 경고: 여유가 거의 없음 — ${w}`);
  if (errors.length) {
    console.error(
      `[perf:budget] 실패 ${errors.length}건 (docs/perf/P4-12-landing.md "예산을 넘으면")\n- ${errors.join('\n- ')}`,
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
