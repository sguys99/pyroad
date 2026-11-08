// 랜딩 화면 문구에 쓰인 글자를 모은다 (P2-10, P4-12). 랜딩 텍스트 서브셋을 만들 때(build-fonts.mjs)와
// "서브셋에 랜딩 글자가 다 있는지" 검사할 때(check.mjs) 같은 함수를 쓴다.
//
// 어떻게: 랜딩 페이지(`src/app/page.tsx`)에서 시작해 `@/`·상대 경로 import(동적 import 포함)를 따라가며 닿는
// 모든 TS/TSX 모듈의 문자열 리터럴·템플릿 글자·JSX 텍스트를 TypeScript AST로 모은다. 주석·타입 전용 import는 보지 않는다.
//
// 글자는 두 묶음으로 나눈다 (P4-12, docs/design/fonts.md §3):
// - 본문(pyRoad Sans) = 모은 글자 전부. 어떤 문구가 나중에 보일지 코드만으로 확실히 가를 수 없으므로 넓게 모은다.
//   다만 화면에 글자로 그려지지 않는 자리(`aria-label`·`alt`·`console`·`new Error` 인자·`metadata`)는 뺀다.
// - 제목(Jua) = **제목 글꼴이 걸리는 자리**에 들어가는 문구만 (`collectDisplayText`). 제목 글꼴은 `font-display` 클래스와
//   h1~h3(globals.css)으로만 걸리므로(CSS의 font-family는 tokens:check가 막음), 그 JSX 아래 글자를 모으고
//   `{title}`·`{f.name}`·`{label(x)}`처럼 값이 흘러 들어오는 이름은 이름 기준으로 넓게(과하게) 따라간다.
//   빠진 글자는 시스템 글꼴로 보이므로 빌드 뒤 HTML 검사(check-build.mjs)와 e2e(landing-fonts.spec.ts)가 한 번 더 본다.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** 랜딩에서 그려지는 화면의 시작 모듈. 랜딩 구조를 바꾸면 여기를 같이 본다 */
export const LANDING_ENTRIES = ['src/app/page.tsx'];

/** 서브셋에 항상 넣는 글자: ASCII 인쇄 문자 (숫자·영문·기호는 어디서든 나올 수 있음) */
export const ALWAYS_CHARS = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
  String.fromCodePoint(0x20 + i),
).join('');

const EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs'];

/**
 * 랜딩 트리에 import되지만 문자열이 화면에 나오지 않는 모듈 (import는 계속 따라감, P4-12).
 * 디자인 토큰의 대비표 설명(`use: '카드 본문'`), 연출 단계 판정 이유(설정·개발 화면용 `'… 끊김'`) 같은 것.
 * 랜딩에 그려지게 되면 e2e `landing-fonts.spec.ts`가 빠진 글자로 잡는다 → 여기서 빼면 된다.
 */
export const NON_TEXT_MODULES = new Set([
  'src/lib/design/tokens.ts',
  'src/lib/motion/detect.ts',
]);

/**
 * 글자로 그려지지 않는 JSX 속성 (스크린리더·툴팁·식별자). 제목·본문 어느 쪽 서브셋에도 넣지 않는다.
 * HTML 요소(소문자 태그)는 `VISIBLE_INTRINSIC_ATTRS` 말고는 전부 화면에 글자를 그리지 않는다(`title` 툴팁은 시스템 글꼴).
 * 컴포넌트 props는 이름이 아래에 걸릴 때만 뺀다(`title`·`label`·`name` 같은 props는 화면에 그려질 수 있음).
 */
const HIDDEN_ATTRS = new Set([
  'className',
  'class',
  'id',
  'key',
  'ref',
  'style',
  'href',
  'src',
  'srcSet',
  'alt',
  'role',
  'type',
  'rel',
  'target',
  'htmlFor',
  'd',
  'viewBox',
]);
const HIDDEN_ATTR_PREFIX = /^(data-|on[A-Z]|aria-)/;
const VISIBLE_INTRINSIC_ATTRS = new Set([
  'value',
  'defaultValue',
  'placeholder',
  'label',
]);

/** JSX 속성이 화면에 글자로 그려지지 않는 자리인지 */
export function isHiddenAttr(attr) {
  const name = attrName(attr);
  if (HIDDEN_ATTRS.has(name) || HIDDEN_ATTR_PREFIX.test(name)) return true;
  const el = attr.parent?.parent; // JsxAttributes → 여는 태그
  const tag = el?.tagName?.getText?.() ?? '';
  return /^[a-z]/.test(tag) && !tag.includes('.')
    ? !VISIBLE_INTRINSIC_ATTRS.has(name)
    : false;
}
/** 글자를 화면에 그리지 않는 호출: 개발자 로그·오류 메시지 */
const HIDDEN_CALLEE = /^(console\.\w+|Error|TypeError|RangeError)$/;
/** 제목 문구를 이름 기준으로 따라가는 최대 깊이 (`{f.name}` 1, `useMemo(() => LINES.out)` 2) */
const MAX_HOPS = 3;
const COMPARE_OPS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.InstanceOfKeyword,
  ts.SyntaxKind.InKeyword,
]);
/** 이름 기준으로 따라가지 않는 흔한 이름 (따라가면 모듈 전체가 제목으로 잡힘) */
const UNRESOLVED_NAMES = new Set([
  'children',
  'props',
  'className',
  'style',
  'ref',
  'key',
  'id',
  'i',
  'e',
  'el',
  'x',
  'length',
  'map',
  'filter',
  'join',
  'slice',
  'cn',
  'clsx',
  'String',
  'Number',
  'Math',
  'undefined',
  'true',
  'false',
]);

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // 패키지 import는 따라가지 않음
  const candidates = [
    base,
    ...EXTS.map((e) => base + e),
    ...EXTS.map((e) => join(base, `index${e}`)),
  ];
  for (const c of candidates) {
    if (
      existsSync(c) &&
      statSync(c).isFile() &&
      EXTS.some((e) => c.endsWith(e))
    ) {
      return c;
    }
  }
  return null; // 이미지·CSS 등
}

function isTypeOnlyImport(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return false;
    if (clause.isTypeOnly) return true;
    // import { type A, type B } from … (값 import가 하나도 없으면 타입 전용)
    const named = clause.namedBindings;
    return (
      !clause.name &&
      !!named &&
      ts.isNamedImports(named) &&
      named.elements.length > 0 &&
      named.elements.every((e) => e.isTypeOnly)
    );
  }
  if (ts.isExportDeclaration(node)) return node.isTypeOnly;
  return false;
}

const isStringPiece = (node) =>
  ts.isStringLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  ts.isTemplateHead(node) ||
  ts.isTemplateMiddle(node) ||
  ts.isTemplateTail(node);

/** `x as T`·`x satisfies T`·`(x)`·`x!` → x */
function unwrap(node) {
  let n = node;
  while (
    ts.isAsExpression(n) ||
    ts.isSatisfiesExpression(n) ||
    ts.isParenthesizedExpression(n) ||
    ts.isTypeAssertionExpression(n) ||
    ts.isNonNullExpression(n)
  )
    n = n.expression;
  return n;
}

/** 소스 글자열 → 모듈 (테스트용으로도 씀) */
export function parseModule(file, src) {
  return { file, sf: parse(file, src), dynamic: false };
}

function parse(file, src) {
  return ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function attrName(attr) {
  return ts.isJsxAttribute(attr) ? attr.name.getText() : null;
}

/** 화면에 글자로 그려지지 않는 자리인지 (aria-label·alt·console·Error·metadata) */
function isHiddenText(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) return isHiddenAttr(p);
    if (
      (ts.isCallExpression(p) || ts.isNewExpression(p)) &&
      HIDDEN_CALLEE.test(p.expression.getText())
    ) {
      return true;
    }
    // Next 메타데이터(`export const metadata`)는 <head>에만 들어감
    if (
      ts.isVariableDeclaration(p) &&
      ts.isIdentifier(p.name) &&
      p.name.text === 'metadata'
    ) {
      return true;
    }
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) return false;
    if (ts.isFunctionLike(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

/**
 * 모듈 그래프를 읽는다. dynamic: `import()`로만 닿는 모듈(첫 화면 뒤에 받는 부분)
 * @returns {{ file: string, sf: ts.SourceFile, dynamic: boolean }[]}
 */
export function loadLandingModules(entries = LANDING_ENTRIES) {
  const mods = new Map();
  const edges = new Map(); // file → [{target, dynamic}]
  const queue = entries.map((e) => join(ROOT, e));
  while (queue.length) {
    const file = queue.shift();
    if (mods.has(file)) continue;
    const sf = parse(file, readFileSync(file, 'utf8'));
    mods.set(file, sf);
    const out = [];
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        if (!isTypeOnlyImport(node)) {
          const target = resolveImport(file, node.moduleSpecifier.text);
          if (target) out.push({ target, dynamic: false });
        }
        return;
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        const target = resolveImport(file, node.arguments[0].text);
        if (target) out.push({ target, dynamic: true });
        return;
      }
      // `typeof import('…')` 같은 타입 자리는 따라가지 않음
      if (ts.isImportTypeNode(node)) return;
      ts.forEachChild(node, visit);
    };
    visit(sf);
    edges.set(file, out);
    for (const { target } of out) queue.push(target);
  }
  // 정적 import만으로 닿는 모듈 = 첫 화면 번들
  const eager = new Set();
  const q2 = entries.map((e) => join(ROOT, e));
  while (q2.length) {
    const f = q2.shift();
    if (eager.has(f)) continue;
    eager.add(f);
    for (const { target, dynamic } of edges.get(f) ?? [])
      if (!dynamic) q2.push(target);
  }
  return [...mods].map(([file, sf]) => ({
    file,
    sf,
    dynamic: !eager.has(file),
  }));
}

/** 모듈의 화면 문구 조각 (모듈 경로·숨은 자리 제외) */
function textPieces(sf) {
  const pieces = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      return; // 모듈 경로 문자열은 글자로 세지 않음
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      return;
    }
    if (ts.isLiteralTypeNode(node) || ts.isImportTypeNode(node)) return; // 타입 자리
    if (isStringPiece(node) || ts.isJsxText(node)) {
      if (!isHiddenText(node)) pieces.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return pieces;
}

/** 글자열 → 공백·제어 문자를 뺀 고유 글자(코드포인트 순) */
export function uniqueChars(text) {
  return [
    ...new Set([...text].filter((ch) => !/[\s\p{Cc}\p{Cf}]/u.test(ch))),
  ].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
}

// ---------------------------------------------------------------------------
// 제목 글꼴(Jua) 자리 찾기

/**
 * CSS에서 `@apply font-display`(·sans·mono)를 쓴 클래스. 마크업에 `font-display`를 쓰는 것이 규칙이지만(landing.css),
 * CSS로 건 것도 놓치지 않게 랜딩 모듈이 import한 CSS를 읽는다.
 * @returns {{ display: Set<string>, sans: Set<string>, mono: Set<string> }}
 */
export function cssFontClasses(css) {
  const out = { display: new Set(), sans: new Set(), mono: new Set() };
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // 가장 안쪽 규칙(중괄호 안에 중괄호 없음)만 본다. 중첩(@layer·@media)은 선택자 쪽에 섞여도 마지막 줄만 씀
  for (const m of text.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const apply = m[2].match(/@apply\s+([^;]+)/);
    if (!apply) continue;
    const kind = apply[1].match(
      /(?:^|\s)font-(display|sans|mono)(?=\s|$)/,
    )?.[1];
    if (!kind) continue;
    for (const sel of m[1].split(',')) {
      const cls = sel.trim().match(/\.([\w-]+)[^\s.]*$/)?.[1];
      if (cls) out[kind].add(cls);
    }
  }
  return out;
}

const NO_CSS_CLASSES = { display: new Set(), sans: new Set(), mono: new Set() };

/**
 * className 속성에 든 글꼴 클래스 (문자열 조각 전부에서, 조건부 포함): `font-display`·`font-sans`·`font-mono` 유틸리티,
 * 그리고 CSS에서 그 글꼴을 `@apply`한 클래스
 * @returns {Set<'display' | 'sans' | 'mono'>}
 */
function fontClasses(el, cssClasses = NO_CSS_CLASSES) {
  const attrs = ts.isJsxElement(el)
    ? el.openingElement.attributes
    : ts.isJsxSelfClosingElement(el)
      ? el.attributes
      : null;
  const found = new Set();
  if (!attrs) return found;
  for (const a of attrs.properties) {
    if (!ts.isJsxAttribute(a) || !a.initializer) continue;
    if (!['className', 'class'].includes(attrName(a))) continue;
    const scan = (n) => {
      if (isStringPiece(n)) {
        for (const token of n.text.split(/\s+/)) {
          const t = token.replace(/^.*:/, ''); // md:font-display → font-display
          const util = t.match(/^font-(display|sans|mono)$/)?.[1];
          if (util) found.add(util);
          for (const kind of ['display', 'sans', 'mono'])
            if (cssClasses[kind].has(t)) found.add(kind);
        }
      }
      ts.forEachChild(n, scan);
    };
    scan(a.initializer);
  }
  return found;
}

function tagNode(el) {
  if (ts.isJsxElement(el)) return el.openingElement.tagName;
  if (ts.isJsxSelfClosingElement(el)) return el.tagName;
  return null;
}

/** 태그 이름: 사용자 컴포넌트면 마지막 식별자(`rig.PybaemRig` → PybaemRig), 아니면 소문자 태그 */
function tagInfo(el) {
  const t = tagNode(el);
  if (!t) return { name: null, component: false };
  const text = t.getText();
  const last = text.split('.').pop();
  const component = /^[A-Z]/.test(last) || text.includes('.');
  return { name: component ? last : text, component };
}

/** JSX 요소가 제목 글꼴 시작점인지: font-display 클래스, 또는 (font-sans·mono가 없는) h1~h3 */
export function isDisplayRoot(el, cssClasses = NO_CSS_CLASSES) {
  const cls = fontClasses(el, cssClasses);
  if (cls.has('display')) return true;
  const { name, component } = tagInfo(el);
  return !component && /^h[1-3]$/.test(name) && !cls.size;
}

function componentName(fn) {
  // function Foo() {} / const Foo = () => {} / const Foo = forwardRef(function …) / memo(…)
  if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
  let p = fn.parent;
  while (p && ts.isCallExpression(p)) p = p.parent; // forwardRef(…)·memo(…)
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name))
    return p.name.text;
  return null;
}

/** 함수 매개변수의 props 이름: 구조 분해한 이름들, 또는 props 식별자 */
function propsShape(fn) {
  const first = fn.parameters?.[0];
  if (!first) return { names: new Map(), ident: null, rest: null };
  if (ts.isIdentifier(first.name))
    return { names: new Map(), ident: first.name.text, rest: null };
  const names = new Map(); // 이름 → { local, init: 기본값 식 }
  let rest = null; // `{ a, ...props }`의 props
  if (ts.isObjectBindingPattern(first.name)) {
    for (const b of first.name.elements) {
      if (b.dotDotDotToken) {
        rest = b.name.getText();
        continue;
      }
      const key = b.propertyName?.getText() ?? b.name.getText();
      names.set(key, { local: b.name.getText(), init: b.initializer ?? null });
    }
  }
  return { names, ident: null, rest };
}

/**
 * 제목 글꼴로 그려지는 문구를 모은다 (Jua 서브셋).
 *
 * - 시작점: `font-display` 클래스가 있는 JSX, 또는 글꼴 클래스가 없는 h1~h3. 안쪽의 `font-sans`·`font-mono`에서 멈춘다.
 * - 그 아래 JSX 텍스트·문자열은 그대로, `{값}`은 따라간다: 컴포넌트 props(`{title}` → 사용처의 `title=`·children),
 *   그 밖의 이름(`{f.name}`·`{label(x)}`·`{LINES.out}`)은 같은 이름의 변수·객체 속성·함수 반환값을 **이름 기준으로**
 *   (모든 모듈에서, 과하게) 모은다. 이름을 따라가는 깊이는 `MAX_HOPS`까지, 객체 리터럴 통째는 글자가 아니라 따라가지 않는다.
 * - 제목 안에 쓴 컴포넌트는 그 컴포넌트가 그리는 JSX 전부를 제목으로 본다.
 * @param {{ sf: ts.SourceFile }[]} modules loadLandingModules 결과
 * @param {object} [options]
 * @param {(text: string, why: string, node: ts.Node) => void} [options.trace] 디버그용 (`node scripts/fonts/landing-text.mjs --why`)
 * @param {ReturnType<typeof cssFontClasses>} [options.cssClasses] CSS에서 글꼴을 `@apply`한 클래스
 * @returns {string[]} 문구 조각
 */
export function collectDisplayText(
  modules,
  { trace = null, cssClasses = NO_CSS_CLASSES } = {},
) {
  /** 이름 → 정의 노드 (변수 초기값·객체 속성 값·함수) */
  const defs = new Map();
  /** 컴포넌트 이름 → { fn, shape } */
  const components = new Map();
  const fnComponent = new Map(); // 함수 노드 → 컴포넌트 이름
  /** 컴포넌트 이름 → JSX 사용처 */
  const usages = new Map();
  const roots = [];
  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  for (const { sf } of modules) {
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        if (node.initializer) push(defs, node.name.text, node.initializer);
      } else if (ts.isPropertyAssignment(node)) {
        const n = node.name;
        const key = ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null;
        if (key) push(defs, key, node.initializer);
      } else if (
        (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
        node.name &&
        ts.isIdentifier(node.name)
      ) {
        push(defs, node.name.text, node);
      }
      if (ts.isFunctionLike(node) && node.body) {
        const name = componentName(node);
        if (name && /^[A-Z]/.test(name) && !components.has(name)) {
          components.set(name, { fn: node, shape: propsShape(node) });
          fnComponent.set(node, name);
        }
      }
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const { name, component } = tagInfo(node);
        if (component) push(usages, name, node);
        if (isDisplayRoot(node, cssClasses)) roots.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  const pieces = [];
  const seen = new Map(); // 노드 → 본 깊이 (더 얕게 다시 오면 다시 봄)
  const resolved = new Map(); // 이름 → 본 깊이
  const displayProps = new Map(); // `컴포넌트.prop` → 본 깊이
  const displayComps = new Set();
  let why = '';

  const emit = (node) => {
    if (isHiddenText(node)) return;
    pieces.push(node.text);
    trace?.(node.text, why, node);
  };
  const enclosingComponent = (node) => {
    for (let p = node.parent; p; p = p.parent)
      if (fnComponent.has(p)) return fnComponent.get(p);
    return null;
  };
  const attrsOf = (el) =>
    ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes;

  /** 컴포넌트 prop이 제목 자리에 쓰임 → 사용처에서 그 prop에 넘긴 값을 모은다. depth: 이름을 따라와 닿았으면 그 깊이 */
  const markProp = (comp, prop, depth = 0) => {
    const key = `${comp}.${prop}`;
    if (displayProps.has(key) && displayProps.get(key) <= depth) return;
    displayProps.set(key, depth);
    const saved = why;
    why = `${saved} > ${key}`;
    const init = components.get(comp)?.shape.names.get(prop)?.init;
    if (init) expr(init, depth);
    for (const use of usages.get(comp) ?? []) {
      for (const a of attrsOf(use).properties) {
        if (ts.isJsxAttribute(a) && attrName(a) === prop && a.initializer)
          expr(a.initializer, depth);
        // `<DialogShell {...props} />`: 감싼 컴포넌트의 같은 이름 prop도 제목으로
        if (ts.isJsxSpreadAttribute(a) && ts.isIdentifier(a.expression)) {
          const outer = enclosingComponent(use);
          const shape = outer && components.get(outer).shape;
          if (shape && [shape.ident, shape.rest].includes(a.expression.text))
            markProp(outer, prop, depth);
        }
      }
      if (prop === 'children' && ts.isJsxElement(use))
        for (const c of use.children) content(c);
    }
    why = saved;
  };

  const markComponent = (comp) => {
    if (displayComps.has(comp)) return;
    displayComps.add(comp);
    const info = components.get(comp);
    if (!info) return; // 패키지 컴포넌트(아이콘 등)
    const saved = why;
    why = `${saved} > <${comp}>`;
    // 컴포넌트가 그리는 JSX 전부
    const walk = (n) => {
      if (
        ts.isJsxElement(n) ||
        ts.isJsxSelfClosingElement(n) ||
        ts.isJsxFragment(n)
      )
        return content(n);
      ts.forEachChild(n, walk);
    };
    walk(info.fn.body);
    why = saved;
  };

  const resolveName = (name, at, depth) => {
    const comp = enclosingComponent(at);
    if (comp) {
      const { names, ident } = components.get(comp).shape;
      for (const [key, { local }] of names)
        if (local === name) return markProp(comp, key, depth);
      if (ident === name) return; // props 통째(`{props}`)는 따라가지 않음
    }
    // 한두 글자 이름(`f`·`q`·`s`)은 콜백 매개변수라 이름 기준으로 따라가면 엉뚱한 값이 잡힌다
    if (name.length < 3 || UNRESOLVED_NAMES.has(name) || depth >= MAX_HOPS)
      return;
    // 컴포넌트를 값으로 넘긴 것(`scene: LevelScene`)은 글자가 아님 — 그리는 곳의 JSX에서 따로 봄
    if (components.has(name)) return;
    if (resolved.has(name) && resolved.get(name) <= depth) return;
    resolved.set(name, depth);
    const saved = why;
    why = `${saved} > ${name}`;
    for (const d of defs.get(name) ?? []) {
      if (ts.isFunctionDeclaration(d) || ts.isMethodDeclaration(d))
        fnReturns(d, depth + 1);
      else expr(d, depth + 1);
    }
    why = saved;
  };

  const fnReturns = (fn, depth) => {
    if (!fn.body) return;
    if (!ts.isBlock(fn.body)) return expr(fn.body, depth);
    const walk = (n) => {
      if (ts.isReturnStatement(n) && n.expression) expr(n.expression, depth);
      else if (!ts.isFunctionLike(n)) ts.forEachChild(n, walk);
    };
    walk(fn.body);
  };

  /** 제목 자리에 들어가는 값(식). depth: 이름을 따라간 횟수 */
  const expr = (node, depth) => {
    if (!node) return;
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node) ||
      ts.isJsxText(node)
    )
      return content(node);
    if (seen.has(node) && seen.get(node) <= depth) return;
    seen.set(node, depth);
    if (ts.isJsxExpression(node)) return expr(node.expression, depth);
    if (isStringPiece(node)) return emit(node);
    // 객체 통째는 글자로 그려지지 않음 (`{f.name}`은 속성 이름으로 따라감)
    if (ts.isObjectLiteralExpression(node) || ts.isTypeNode(node)) return;
    if (ts.isFunctionLike(node)) return fnReturns(node, depth);
    if (ts.isIdentifier(node)) return resolveName(node.text, node, depth);
    if (ts.isPropertyAccessExpression(node)) {
      // `f.name` → 속성 이름 `name`만 따라감 (받는 쪽 `f`를 따라가면 객체 전체가 잡힘)
      const comp = enclosingComponent(node);
      const recv = node.expression;
      if (
        comp &&
        ts.isIdentifier(recv) &&
        components.get(comp).shape.ident === recv.text
      )
        return markProp(comp, node.name.text, depth);
      return resolveName(node.name.text, node, depth);
    }
    if (ts.isCallExpression(node)) {
      if (HIDDEN_CALLEE.test(node.expression.getText())) return;
      expr(node.expression, depth);
      for (const a of node.arguments) expr(a, depth);
      return;
    }
    if (ts.isBinaryExpression(node)) {
      // 비교식·논리식 왼쪽의 값은 화면에 나오지 않음 (`a === 'x'`, `ok && <b/>`)
      const op = node.operatorToken.kind;
      if (COMPARE_OPS.has(op)) return;
      if (op !== ts.SyntaxKind.AmpersandAmpersandToken) expr(node.left, depth);
      expr(node.right, depth);
      return;
    }
    if (ts.isConditionalExpression(node)) {
      expr(node.whenTrue, depth);
      expr(node.whenFalse, depth);
      return;
    }
    if (ts.isElementAccessExpression(node)) {
      // `HEADINGS[ctx]` → 그 객체·배열의 값들
      const recv = node.expression;
      const name = ts.isIdentifier(recv)
        ? recv.text
        : ts.isPropertyAccessExpression(recv)
          ? recv.name.text
          : null;
      if (!name || UNRESOLVED_NAMES.has(name) || depth >= MAX_HOPS) return;
      for (const def of defs.get(name) ?? []) {
        const d = unwrap(def);
        if (ts.isObjectLiteralExpression(d)) {
          for (const p of d.properties)
            if (ts.isPropertyAssignment(p)) expr(p.initializer, depth + 1);
        } else if (!ts.isFunctionLike(d)) expr(d, depth + 1);
      }
      return;
    }
    ts.forEachChild(node, (c) => expr(c, depth));
  };

  /** 제목 글꼴 아래의 JSX 내용 */
  const content = (node) => {
    if (!node || seen.has(node)) return;
    if (ts.isJsxText(node)) {
      seen.set(node, 0);
      return emit(node);
    }
    if (ts.isJsxExpression(node)) return expr(node.expression, 0);
    if (ts.isJsxFragment(node)) {
      seen.set(node, 0);
      for (const c of node.children) content(c);
      return;
    }
    seen.set(node, 0);
    // 안쪽에서 font-sans·font-mono로 바꾸면 거기서 멈춤
    const cls = fontClasses(node, cssClasses);
    if (!cls.has('display') && (cls.has('sans') || cls.has('mono'))) return;
    const { name, component } = tagInfo(node);
    if (component) {
      markComponent(name);
      // 제목 안의 컴포넌트에 넘긴 값은 그 컴포넌트가 그릴 수 있음
      for (const a of attrsOf(node).properties) {
        if (!ts.isJsxAttribute(a) || !a.initializer) continue;
        if (isHiddenAttr(a)) continue;
        expr(a.initializer, 0);
      }
    }
    if (ts.isJsxElement(node)) for (const c of node.children) content(c);
  };

  for (const root of roots) {
    const sf = root.getSourceFile();
    why = `${relative(ROOT, sf.fileName)}:${sf.getLineAndCharacterOfPosition(root.getStart()).line + 1}`;
    // 시작점 자체는 font-sans와 함께 조건부로 걸려도(Button의 ghost 변형) 제목으로 본다
    seen.set(root, 0);
    const { name, component } = tagInfo(root);
    if (component) markComponent(name);
    if (ts.isJsxElement(root)) for (const c of root.children) content(c);
  }
  return pieces;
}

/** 랜딩 모듈이 import한 CSS 파일 (절대 경로) */
export function landingCssFiles(modules) {
  const out = new Set();
  for (const { file, sf } of modules) {
    for (const st of sf.statements) {
      if (
        !ts.isImportDeclaration(st) ||
        !ts.isStringLiteral(st.moduleSpecifier)
      )
        continue;
      const spec = st.moduleSpecifier.text;
      if (!spec.endsWith('.css')) continue;
      const path = spec.startsWith('@/')
        ? join(ROOT, 'src', spec.slice(2))
        : spec.startsWith('.')
          ? resolve(dirname(file), spec)
          : null;
      if (path && existsSync(path)) out.add(path);
    }
  }
  return [...out].sort();
}

/**
 * 제목(Jua) 서브셋에 늘 넣는 글자: 숫자·흔한 문장부호. 영문은 제목 문구에 나온 글자만(대·소문자 둘 다) 넣는다 —
 * Jua 라틴 글리프가 무거워 ASCII 95자만 23KB다(P4-12 실측). 본문(pyRoad Sans)은 `ALWAYS_CHARS` 전부.
 */
export const DISPLAY_ALWAYS_CHARS = ' 0123456789!"\'(),-./:?~%+';

/** 서브셋에 넣을 글자열. kind: 'all' = 본문(랜딩 글자 전부 + ASCII), 'display' = 제목(제목 자리 글자 + 숫자·문장부호) */
export function subsetText(kind, { chars, displayChars }) {
  if (kind === 'all') return ALWAYS_CHARS + chars.join('');
  const letters = displayChars
    .filter((c) => /[A-Za-z]/.test(c))
    .flatMap((c) => [c.toLowerCase(), c.toUpperCase()]);
  // uniqueChars는 공백을 빼므로 공백(띄어쓰기 글리프)은 따로 붙인다
  return (
    ' ' +
    uniqueChars(
      DISPLAY_ALWAYS_CHARS + letters.join('') + displayChars.join(''),
    ).join('')
  );
}

/**
 * 랜딩 문구 글자를 모은다.
 * @returns {{ files: string[], dynamicFiles: string[], cssFiles: string[], text: string, chars: string[], displayText: string, displayChars: string[] }}
 *   chars: 본문(pyRoad Sans) 서브셋 글자 = 화면에 그려질 수 있는 문구 전부, displayChars: 제목(Jua) 글꼴 자리의 글자.
 *   둘 다 공백·제어 문자를 뺀 고유 글자(코드포인트 순)
 */
export function collectLandingText(entries = LANDING_ENTRIES) {
  const modules = loadLandingModules(entries);
  const cssFiles = landingCssFiles(modules);
  const cssClasses = { display: new Set(), sans: new Set(), mono: new Set() };
  for (const f of cssFiles) {
    const c = cssFontClasses(readFileSync(f, 'utf8'));
    for (const k of Object.keys(cssClasses))
      for (const x of c[k]) cssClasses[k].add(x);
  }
  const text = modules
    .filter(({ file }) => !NON_TEXT_MODULES.has(relative(ROOT, file)))
    .flatMap(({ sf }) => textPieces(sf))
    .join('\n');
  const displayText = collectDisplayText(modules, { cssClasses }).join('\n');
  const chars = uniqueChars(text);
  // 제목 글자는 본문 글자의 부분집합 (숨은 자리에서 잘못 들어온 글자 방지)
  const all = new Set(chars);
  const displayChars = uniqueChars(displayText).filter((c) => all.has(c));
  return {
    files: modules.map((m) => relative(ROOT, m.file)).sort(),
    dynamicFiles: modules
      .filter((m) => m.dynamic)
      .map((m) => relative(ROOT, m.file))
      .sort(),
    cssFiles: cssFiles.map((f) => relative(ROOT, f)),
    text,
    chars,
    displayText,
    displayChars,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { files, dynamicFiles, chars, displayChars } = collectLandingText();
  const hangul = (cs) => cs.filter((c) => /[가-힣]/.test(c));
  const other = chars.filter(
    (c) => c.codePointAt(0) > 0x7e && !/[가-힣]/.test(c),
  );
  console.log(
    `모듈 ${files.length}개(동적 import로만 닿는 것 ${dynamicFiles.length}개), 본문 글자 ${chars.length}개 (한글 음절 ${hangul(chars).length}), ` +
      `제목 글자 ${displayChars.length}개 (한글 음절 ${hangul(displayChars).length})`,
  );
  console.log(`본문 한글: ${hangul(chars).join('')}`);
  console.log(`제목 한글: ${hangul(displayChars).join('')}`);
  console.log(`그 밖의 비ASCII: ${other.join(' ')}`);
  if (process.argv.includes('--files')) console.log(files.join('\n'));
  if (process.argv.includes('--why')) {
    // 제목 글자가 어디서 왔는지 (한글이 든 조각만)
    collectDisplayText(loadLandingModules(), {
      trace: (text, why, node) => {
        if (!/[가-힣]/.test(text)) return;
        const sf = node.getSourceFile();
        const at = `${relative(ROOT, sf.fileName)}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
        console.log(`${JSON.stringify(text.trim())}  ${at}  ← ${why}`);
      },
    });
  }
}
