// 디자인 토큰 하드코딩 검사 (P2-09, docs/design/tokens.md §5). CI lint-typecheck job에서 돈다.
//
//   npm run tokens:check                       # 위반이 있으면 종료 코드 1
//   npm run tokens:check -- --update-baseline  # 14px 미만 글자(레거시) 기준표를 지금 개수로 낮춘다
//
// src/의 컴포넌트·라이브러리에서 다음을 찾는다 (TypeScript AST의 문자열·JSX 텍스트·속성만 본다, 주석은 안 봄):
//   color   색 리터럴(hex·rgb()·hsl()·oklch() …)과 Tailwind 고정 팔레트 클래스(text-green-600, bg-amber-100, bg-white …)
//   misuse  장식 전용 토큰을 글자색으로: text-primary → text-primary-text, text-accent → text-accent-text (AA 미달)
//   font    font-family 직접 지정(fontFamily 속성·font-[…] 임의값·"font-family:")
//   motion  Framer duration·delay·stiffness·damping 숫자, ease: '문자열', Tailwind duration-300·delay-200·ease-[…]
//           (src/components·src/app만. 토큰: sec('base')·EASE.out·framerSpring('body')·duration-(--dur-fast))
//   size    14px 미만 글자(text-xs·text-[11px] …)는 레거시 기준표(tokens-baseline.json)보다 늘면 실패 (Phase 4~6에서 줄인다)
// CSS(src/**/*.css, src/fonts 제외)는 사용자 정의 속성(--x: …) 밖의 색 리터럴과 font-family를 찾는다 (토큰 정의는 globals.css :root만).
//
// 예외: 아래 ALLOW 표(경로 + 규칙 + 이유), 또는 그 줄이나 바로 윗줄의 `tokens-allow: <이유>` 주석 (브랜드 로고 색 등).

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE = join(ROOT, 'scripts/design/tokens-baseline.json');

/** 경로 접두사 → 허용하는 규칙과 이유 */
export const ALLOW = [
  {
    path: 'src/lib/design/tokens.ts',
    rules: ['color', 'font'],
    why: '토큰 원본',
  },
  {
    path: 'src/components/characters/',
    rules: ['color', 'size'],
    why: '캐릭터 고유색·그림 글자 (리그 팔레트·레거시 캐릭터 SVG, docs/design/rig.md). 리그 B 그림자만 토큰과 같은 값',
  },
  {
    path: 'src/lib/avatar/skins.ts',
    rules: ['color'],
    why: '파이뱀 스킨 팔레트 = 캐릭터 고유색 (공개 아바타, P3-13·§12-Q34). 리그 팔레트와 같은 성격',
  },
  {
    path: 'src/lib/motion/',
    rules: ['motion'],
    why: '모션 토큰 원본·연출 단계표',
  },
  {
    path: 'src/lib/celebration/',
    rules: ['motion'],
    why: '축하 시퀀서·컨페티 박자표 (ms 타임라인)',
  },
];

const SRC_EXT = /\.(ts|tsx)$/;
const SKIP = /(__tests__|\.test\.|\.d\.ts$)/;

// ── 문자열 규칙

const COLOR_FN = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/i;
const HEX = /(?:^|[\s'"`(\[,:=_])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/;
const PALETTE =
  /(?:^|[\s'"`:!])(?:bg|text|border|from|to|via|ring|ring-offset|fill|stroke|outline|shadow|divide|decoration|placeholder|accent|caret)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}(?:\/\d+)?(?=$|[\s'"`])|(?:^|[\s'"`:!])(?:bg|text|border|from|to|via|ring|fill|stroke|outline|shadow|divide|decoration|placeholder|caret)-(?:white|black)(?:\/\d+)?(?=$|[\s'"`])/;
const MISUSE = /(?:^|[\s'"`:!])text-(primary|accent)(?:\/\d+)?(?=$|[\s'"`])/;
const FONT_CLASS = /(?:^|[\s'"`:!])font-\[|font-family\s*:/;
const TW_MOTION =
  /(?:^|[\s'"`:!])(?:duration|delay)-(?:\d+|\[[^\]]*\])(?=$|[\s'"`])|(?:^|[\s'"`:!])ease-\[/;
const SMALL_TEXT = /(?:^|[\s'"`:!])text-(?:xs|\[(\d+(?:\.\d+)?)(px|rem)\])(?=$|[\s'"`/])/g;

const MOTION_KEYS = new Set([
  'duration',
  'delay',
  'stiffness',
  'damping',
  'mass',
  'bounce',
]);
const CSS_TIME_KEYS = new Set([
  'transitionDuration',
  'animationDuration',
  'transitionDelay',
  'animationDelay',
]);

const MESSAGES = {
  color: '색 리터럴·고정 팔레트 클래스 → 토큰 (bg-surface-2, text-primary-text, var(--accent), COLOR.x)',
  misuse: '장식 전용 토큰을 글자색으로 씀 → text-primary-text / text-accent-text',
  font: 'font-family 직접 지정 → font-display / font-sans / font-mono (TS는 FONT_FAMILY)',
  motion: '모션 값 직접 지정 → sec(\'base\') · EASE.out · framerSpring(\'body\') · duration-(--dur-fast)',
};

function allowed(rel, rule) {
  return ALLOW.some((a) => rel.startsWith(a.path) && a.rules.includes(rule));
}

function smallTextCount(text) {
  let n = 0;
  for (const m of text.matchAll(SMALL_TEXT)) {
    if (!m[1]) n++;
    else {
      const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
      if (px < 14) n++;
    }
  }
  return n;
}

/** 초기화식 안의 0이 아닌 숫자 리터럴이 있나 (duration: 0.45 * k 도 잡는다) */
function hasNonZeroNumber(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isNumericLiteral(n) && Number(n.text) !== 0) found = true;
    else ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

const propName = (name) =>
  name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : null;

/**
 * 한 파일 검사. 반환: { violations: [{ line, rule, text }], smallText }
 * @param {string} rel 저장소 기준 경로 (규칙 범위·예외 판단)
 */
export function checkSource(rel, text) {
  const violations = [];
  let smallText = 0;
  const lines = text.split('\n');
  const isTsx = rel.endsWith('.tsx');
  const motionScope = rel.startsWith('src/components/') || rel.startsWith('src/app/');
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
  const inlineAllowed = (line) =>
    /tokens-allow:/.test(lines[line] ?? '') || /tokens-allow:/.test(lines[line - 1] ?? '');
  const report = (node, rule, snippet) => {
    if (allowed(rel, rule)) return;
    const line = lineOf(node);
    if (inlineAllowed(line)) return;
    violations.push({ line: line + 1, rule, text: snippet.trim().slice(0, 120) });
  };

  const visitString = (node, value) => {
    if (COLOR_FN.test(value) || HEX.test(value) || PALETTE.test(value)) report(node, 'color', value);
    if (MISUSE.test(value)) report(node, 'misuse', value);
    if (FONT_CLASS.test(value)) report(node, 'font', value);
    if (motionScope && TW_MOTION.test(value)) report(node, 'motion', value);
    const small = smallTextCount(value);
    if (small && !allowed(rel, 'size')) smallText += small;
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      visitString(node, node.text);
    } else if (ts.isJsxText(node)) {
      // 화면 글자는 검사하지 않는다 (예: "색 #1 고르기")
    } else if (ts.isPropertyAssignment(node) || ts.isJsxAttribute(node)) {
      const key = propName(node.name);
      const init = ts.isPropertyAssignment(node)
        ? node.initializer
        : node.initializer && ts.isJsxExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
      if (key && init) {
        const isText = ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init);
        // var(--font-mono)처럼 글꼴 토큰 변수를 가리키는 것은 허용 (CodeMirror 테마)
        if (key === 'fontFamily' && (ts.isTemplateExpression(init) || (isText && !/^var\(--font-[\w-]+\)$/.test(init.text)))) {
          report(node, 'font', node.getText(sf));
        }
        if (motionScope && MOTION_KEYS.has(key) && hasNonZeroNumber(init)) {
          report(node, 'motion', node.getText(sf));
        }
        if (motionScope && key === 'ease' && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))) {
          report(node, 'motion', node.getText(sf));
        }
        if (motionScope && CSS_TIME_KEYS.has(key) && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init) || ts.isNumericLiteral(init))) {
          report(node, 'motion', node.getText(sf));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { violations, smallText };
}

/** CSS: 사용자 정의 속성 밖의 색 리터럴, font-family */
export function checkCss(rel, text) {
  const violations = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const re = /([\w-]+)\s*:\s*([^;{}]+);/g;
  for (const m of clean.matchAll(re)) {
    const [, prop, value] = m;
    if (prop.startsWith('--')) continue;
    const line = clean.slice(0, m.index).split('\n').length;
    if (COLOR_FN.test(value) || HEX.test(' ' + value)) {
      violations.push({ line, rule: 'color', text: `${prop}: ${value.trim()}` });
    }
    if (prop === 'font-family') violations.push({ line, rule: 'font', text: `${prop}: ${value.trim()}` });
  }
  return { violations, smallText: 0 };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function scan() {
  const files = walk(join(ROOT, 'src'));
  const results = [];
  for (const abs of files) {
    const rel = relative(ROOT, abs).split('\\').join('/');
    if (SKIP.test(rel)) continue;
    let r;
    if (SRC_EXT.test(rel)) r = checkSource(rel, readFileSync(abs, 'utf8'));
    else if (rel.endsWith('.css') && !rel.startsWith('src/fonts/')) r = checkCss(rel, readFileSync(abs, 'utf8'));
    else continue;
    results.push({ rel, ...r });
  }
  return results;
}

function main() {
  const results = scan();
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const update = process.argv.includes('--update-baseline');
  let fails = 0;

  for (const { rel, violations } of results) {
    for (const v of violations) {
      fails++;
      console.error(`${rel}:${v.line}  [${v.rule}] ${MESSAGES[v.rule]}\n    ${v.text}`);
    }
  }

  const small = Object.fromEntries(
    results.filter((r) => r.smallText > 0).map((r) => [r.rel, r.smallText]),
  );
  const lowered = [];
  for (const [rel, n] of Object.entries(small)) {
    const base = baseline.smallText[rel] ?? 0;
    if (n > base) {
      fails++;
      console.error(
        `${rel}  [size] 14px 미만 글자(text-xs·text-[11px] …)가 ${base} → ${n}개로 늘었다. text-caption(14px) 이상을 쓴다`,
      );
    } else if (n < base) lowered.push(rel);
  }
  for (const rel of Object.keys(baseline.smallText)) {
    if (!(rel in small)) lowered.push(rel);
  }

  if (update) {
    baseline.smallText = Object.fromEntries(
      Object.entries(small)
        .filter(([rel, n]) => n <= (baseline.smallText[rel] ?? 0))
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
    console.log('tokens-baseline.json 갱신');
  } else if (lowered.length) {
    console.log(
      `14px 미만 글자가 줄었다 (${lowered.join(', ')}). npm run tokens:check -- --update-baseline 으로 기준표를 낮춘다`,
    );
  }

  const total = Object.values(small).reduce((a, b) => a + b, 0);
  if (fails) {
    console.error(`\n토큰 검사 실패 ${fails}건 (docs/design/tokens.md §5, 예외는 tokens-allow: <이유> 주석)`);
    process.exit(1);
  }
  console.log(`토큰 검사 통과: ${results.length}개 파일, 하드코딩 0건, 레거시 14px 미만 글자 ${total}개(기준표 이하)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
