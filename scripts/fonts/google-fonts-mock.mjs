// CI 빌드용: next/font/google 이 받을 Google Fonts CSS 를 미리 받아 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` 파일로 만든다.
// CI `build` job 에서만 쓴다. 로컬·Vercel 빌드(`npm run build`)는 지금처럼 Next 가 직접 받는다.
//
// 왜: Google Fonts 는 같은 요청에도 글꼴 주소를 가끔 확장자 없는 `https://fonts.gstatic.com/l/font?kit=…&skey=…&v=v40`
// 모양으로 준다 (GitHub 러너에서는 Noto Sans KR 이 매번 이 모양이었음). Next 15.5 의 Turbopack 은 글꼴 옵션 JSON 을
// 쿼리 문자열로 다시 파싱해서 주소 안의 `&`에서 잘라 `next/font/google queries have exactly one entry`로 빌드가 깨진다
// (웹팩 로더도 확장자가 없으면 깨짐). vercel/next.js#99114, 수정은 #100158 → 16.4.3 이후에만 있고 15.5.x 에는 없다.
//
// 어떻게: CSS 는 Next 와 같은 주소·User-Agent 로 지금 받은 그대로 쓰고, 확장자 없는 글꼴 주소만 Turbopack 15.5 가
// 원래 주소로 되돌려 받도록 감싼다 (protectFontUrl 참고). 글꼴 파일은 빌드 때 Turbopack 이 gstatic 에서 그대로 받는다.
// Next 를 16.4.3 이상으로 올리면 이 스크립트와 ci.yml 의 단계를 지운다 (15.x 가 아니면 아무것도 하지 않고 알림만 남김).
//
//   node scripts/fonts/google-fonts-mock.mjs [--out <파일>]
//   → 파일을 쓰고, GitHub Actions 면 $GITHUB_ENV 에 NEXT_FONT_GOOGLE_MOCKED_RESPONSES 를 넣는다 (뒤 단계의 빌드가 씀)

import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(ROOT, 'package.json'));
const GOOGLE = 'next/dist/compiled/@next/font/dist/google/';

/** Next(웹팩 로더·Turbopack 공통)가 Google Fonts 에 보내는 User-Agent. 이 값에 따라 woff2 가 온다 */
const NEXT_FONT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/104.0.0.0 Safari/537.36';

const FONT_EXT_RE = /\.(woff|woff2|eot|ttf|otf)$/;
const FORMAT_EXT = {
  woff2: 'woff2',
  woff: 'woff',
  truetype: 'ttf',
  opentype: 'otf',
  'embedded-opentype': 'eot',
};

/**
 * 확장자 없는 글꼴 주소를 Turbopack 15.5 가 다룰 수 있게 감싼다. 확장자가 있으면 그대로 둔다.
 *
 * Turbopack 15.5 는 CSS 의 주소 U 를 `{"url":U,…}` JSON 에 넣고 qstring 으로 파싱 → 인코딩 → (요청 때) 다시 파싱한다.
 * 파싱은 날 `&`·`=`에서 자르고 각 조각을 퍼센트 디코딩, 인코딩은 `&`·`=`·`?`·`"`는 이스케이프하지만 `%`·`#`는 그대로 둔다.
 * 그래서 `&`→`%26`, `=`→`%3D`로 바꿔 두면 첫 파싱에서 원래 주소로 풀리고, 이후로는 이스케이프되어 한 조각으로 살아남는다.
 * 또 Turbopack 15.5 는 주소 끝의 확장자로 파일 종류를 정하므로 `&_=.<ext>`를 붙인다 (gstatic 은 모르는 파라미터를 무시).
 */
export function protectFontUrl(url, format) {
  if (FONT_EXT_RE.test(url)) return url;
  // `%`는 두 번 디코딩되고 `#`은 CSS 요청의 fragment 로 잘려서 이 방법으로는 지킬 수 없다
  if (/[%#()\s]/.test(url)) {
    throw new Error(`이 방법으로 감쌀 수 없는 글꼴 주소: ${url}`);
  }
  const ext = FORMAT_EXT[format] ?? 'woff2';
  return `${url}${url.includes('?') ? '&' : '?'}_=.${ext}`
    .replaceAll('&', '%26')
    .replaceAll('=', '%3D');
}

/** CSS 의 `src: url(…) format('…')` 중 확장자 없는 주소만 감싼다. Turbopack 의 추출 정규식(`src: url\((.+?)\)`)과 맞춘다 */
export function protectStylesheet(css) {
  let protectedCount = 0;
  const out = css.replace(
    /src: url\((.+?)\)(\s*format\(['"](.+?)['"]\))?/g,
    (match, url, formatPart = '', format) => {
      const next = protectFontUrl(url, format);
      if (next === url) return match;
      protectedCount += 1;
      return `src: url(${next})${formatPart}`;
    },
  );
  return { css: out, protectedCount };
}

function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files.push(...sourceFiles(path));
    } else if (
      /\.(tsx?|jsx?|mjs)$/.test(entry.name) &&
      !/\.d\.ts$/.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
}

/** next/font 는 리터럴 인자만 받으므로 리터럴만 계산한다 */
function literal(ts, node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node))
    return node.elements.map((el) => literal(ts, el));
  if (ts.isObjectLiteralExpression(node)) {
    const obj = {};
    for (const prop of node.properties) {
      if (
        !ts.isPropertyAssignment(prop) ||
        !(ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
      ) {
        throw new Error(
          `next/font/google 인자를 읽을 수 없음: ${prop.getText()}`,
        );
      }
      obj[prop.name.text] = literal(ts, prop.initializer);
    }
    return obj;
  }
  throw new Error(`next/font/google 인자를 읽을 수 없음: ${node.getText()}`);
}

/** src/ 에서 next/font/google 호출을 찾아 [함수 이름, 옵션] 목록으로 */
function findFontCalls() {
  const ts = require('typescript');
  const calls = [];
  for (const file of sourceFiles(join(ROOT, 'src'))) {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('next/font/google')) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const imported = new Map(); // 지역 이름 → 글꼴 함수 이름
    for (const stmt of sf.statements) {
      if (
        ts.isImportDeclaration(stmt) &&
        ts.isStringLiteral(stmt.moduleSpecifier) &&
        stmt.moduleSpecifier.text === 'next/font/google'
      ) {
        const named = stmt.importClause?.namedBindings;
        if (named && ts.isNamedImports(named)) {
          for (const el of named.elements)
            imported.set(el.name.text, (el.propertyName ?? el.name).text);
        }
      }
    }
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        imported.has(node.expression.text)
      ) {
        const options = node.arguments[0] ? literal(ts, node.arguments[0]) : {};
        calls.push({
          file,
          functionName: imported.get(node.expression.text),
          options,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return calls;
}

/** Next 의 웹팩 로더와 같은 함수로 CSS 주소를 만든다 (Turbopack 도 같은 주소를 만든다 — Next 의 목업 테스트가 두 번들러에 공용) */
function stylesheetUrl({ functionName, options }) {
  const { validateGoogleFontFunctionCall } = require(
    `${GOOGLE}validate-google-font-function-call`,
  );
  const { getFontAxes } = require(`${GOOGLE}get-font-axes`);
  const { getGoogleFontsUrl } = require(`${GOOGLE}get-google-fonts-url`);
  const { fontFamily, weights, styles, display, selectedVariableAxes } =
    validateGoogleFontFunctionCall(functionName, options);
  return getGoogleFontsUrl(
    fontFamily,
    getFontAxes(fontFamily, weights, styles, selectedVariableAxes),
    display,
  );
}

async function fetchStylesheet(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': NEXT_FONT_USER_AGENT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error(`Google Fonts CSS 를 받지 못함: ${url} (${lastError})`);
}

async function main() {
  const outArg = process.argv.indexOf('--out');
  const out = resolve(
    outArg > -1
      ? process.argv[outArg + 1]
      : join(
          process.env.RUNNER_TEMP ?? tmpdir(),
          'next-font-google-mock/responses.js',
        ),
  );

  const nextVersion = require('next/package.json').version;
  if (!nextVersion.startsWith('15.')) {
    console.log(
      `::warning::Next ${nextVersion}: Google Fonts /l/font 우회(scripts/fonts/google-fonts-mock.mjs)는 Next 15 전용. ` +
        '16.4.3 이상이면 ci.yml 의 단계와 이 스크립트를 지울 것. 이번 빌드는 Next 가 직접 받음',
    );
    return;
  }

  const calls = findFontCalls();
  if (calls.length === 0) {
    console.log('next/font/google 호출 없음: 목업을 만들지 않음');
    return;
  }

  const responses = {};
  for (const call of calls) {
    const url = stylesheetUrl(call);
    if (url in responses) continue;
    const { css, protectedCount } = protectStylesheet(
      await fetchStylesheet(url),
    );
    responses[url] = css;
    const total = css.match(/src: url\(/g)?.length ?? 0;
    console.log(
      `${call.functionName}: 글꼴 주소 ${total}개 중 확장자 없는 /l/font 주소 ${protectedCount}개 감쌈 ← ${url}`,
    );
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `module.exports = ${JSON.stringify(responses, null, 2)};\n`,
  );
  console.log(`→ ${out}`);
  if (process.env.GITHUB_ENV) {
    appendFileSync(
      process.env.GITHUB_ENV,
      `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=${out}\n`,
    );
  } else {
    console.log(`빌드: NEXT_FONT_GOOGLE_MOCKED_RESPONSES=${out} npm run build`);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
