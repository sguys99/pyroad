// 랜딩 화면 문구에 쓰인 글자를 모은다 (P2-10). 랜딩 텍스트 서브셋을 만들 때(build-fonts.mjs)와
// "서브셋에 랜딩 글자가 다 있는지" 검사할 때(check.mjs) 같은 함수를 쓴다.
//
// 어떻게: 랜딩 페이지(`src/app/page.tsx`)에서 시작해 `@/`·상대 경로 import를 따라가며 닿는 모든 TS/TSX 모듈의
// 문자열 리터럴·템플릿 글자·JSX 텍스트를 TypeScript AST로 모은다. 주석·타입 전용 import는 보지 않는다.
// 화면에 안 나오는 문자열(className, 이벤트 이름)도 섞이지만 거의 ASCII라 서브셋 크기에 영향이 없고,
// 어떤 문구가 나중에 보일지 코드만으로 확실히 가를 수 없으므로 넓게 모으는 쪽이 안전하다.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** 랜딩에서 그려지는 화면의 시작 모듈. 랜딩 구조를 바꾸면(P4) 여기를 같이 본다 */
export const LANDING_ENTRIES = ['src/app/page.tsx'];

/** 서브셋에 항상 넣는 글자: ASCII 인쇄 문자 (숫자·영문·기호는 어디서든 나올 수 있음) */
export const ALWAYS_CHARS = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
  String.fromCodePoint(0x20 + i),
).join('');

const EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs'];

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

/**
 * 랜딩 문구 글자를 모은다.
 * @returns {{ files: string[], text: string, chars: string[] }} chars: 공백·제어 문자를 뺀 고유 글자(코드포인트 순)
 */
export function collectLandingText(entries = LANDING_ENTRIES) {
  const seen = new Set();
  const queue = entries.map((e) => join(ROOT, e));
  const pieces = [];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(
      file,
      src,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        if (!isTypeOnlyImport(node)) {
          const target = resolveImport(file, node.moduleSpecifier.text);
          if (target) queue.push(target);
        }
        return; // 모듈 경로 문자열은 글자로 세지 않음
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0])
      ) {
        const target = resolveImport(file, node.arguments[0].text);
        if (target) queue.push(target);
        return;
      }
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        pieces.push(node.text);
      } else if (ts.isJsxText(node)) {
        pieces.push(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const text = pieces.join('\n');
  const chars = [
    ...new Set([...text].filter((ch) => !/[\s\p{Cc}\p{Cf}]/u.test(ch))),
  ].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  return {
    files: [...seen].map((f) => relative(ROOT, f)).sort(),
    text,
    chars,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { files, chars } = collectLandingText();
  const hangul = chars.filter((c) => /[가-힣]/.test(c));
  const other = chars.filter(
    (c) => c.codePointAt(0) > 0x7e && !/[가-힣]/.test(c),
  );
  console.log(
    `모듈 ${files.length}개, 고유 글자 ${chars.length}개 (한글 음절 ${hangul.length})`,
  );
  console.log(`한글: ${hangul.join('')}`);
  console.log(`그 밖의 비ASCII: ${other.join(' ')}`);
  if (process.argv.includes('--files')) console.log(files.join('\n'));
}
