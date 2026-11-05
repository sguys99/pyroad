// 진입점마다 Artifact로 공유할 단일 HTML을 만든다 → dist/<이름>.html
//   node build.mjs              # 모든 진입점 (src/*/entry.json이 있는 폴더)
//   node build.mjs a moodboard  # 고른 진입점만
//   node build.mjs --watch a    # 소스가 바뀌면 다시 빌드
//
// Artifact 페이지 계약 (design/README.md):
// - <!doctype>·<html>·<head>·<body>를 쓰지 않는다 (게시할 때 감싸짐). 맨 위는 <title> → claude:viewport-fit-sides 메타 → <style>
// - 외부 스크립트는 cdnjs React 18.3.1 UMD 두 개만. 우리 코드는 esbuild로 묶어 인라인, react/react-dom은 전역(React, ReactDOM)으로 매핑
// - 외부 스타일시트는 Google Fonts만(Jua·Gaegu·Gowun Dodum). Pretendard·D2Coding은 쓰인 글자만 서브셋해 base64 woff2로 인라인
import { build, context } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureFonts } from './scripts/fetch-fonts.mjs';
import { genContent } from './scripts/gen-content.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const CACHE = join(ROOT, '.build');
mkdirSync(DIST, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const REACT_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
];

/** 인라인 폰트: 토큰의 FONT_STACK 첫 이름과 같아야 한다 */
const INLINE_FONTS = {
  sans: { family: 'pyRoad Sans', key: 'pretendard', weight: '45 920', note: 'Pretendard Variable 서브셋 (OFL, 이름 변경)' },
  mono: { family: 'pyRoad Mono', key: 'd2coding', weight: '400', note: 'D2Coding Regular 서브셋 (OFL, 이름 변경)' },
};

// react / react-dom → UMD 전역
const globalsPlugin = {
  name: 'umd-globals',
  setup(b) {
    b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({ path: a.path, namespace: 'umd-global' }));
    b.onLoad({ filter: /.*/, namespace: 'umd-global' }, (a) => {
      if (a.path === 'react/jsx-runtime' || a.path === 'react/jsx-dev-runtime') {
        return {
          contents: `const R = window.React;
export const Fragment = R.Fragment;
export function jsx(type, props, key) { return R.createElement(type, key === undefined ? props : { ...props, key }); }
export const jsxs = jsx;
export const jsxDEV = jsx;`,
          loader: 'js',
        };
      }
      const g = a.path.startsWith('react-dom') ? 'ReactDOM' : 'React';
      return { contents: `module.exports = window.${g};`, loader: 'js' };
    });
  },
};

function listEntries() {
  return readdirSync(SRC)
    .filter((d) => existsSync(join(SRC, d, 'entry.json')) && existsSync(join(SRC, d, 'main.tsx')))
    .sort();
}

function esbuildOptions(name) {
  return {
    entryPoints: [join(SRC, name, 'main.tsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020', 'chrome100', 'safari15', 'firefox100'],
    jsx: 'automatic',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
    outdir: join(CACHE, name),
    metafile: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.json': 'json' },
    plugins: [globalsPlugin],
    logLevel: 'warning',
  };
}

/** 문서에 실제로 그려질 글자: 번들(JS·CSS) 문자열 + 출력 가능한 ASCII 전체 + 자주 쓰는 기호 */
function collectText(...texts) {
  const set = new Set();
  for (let c = 0x20; c < 0x7f; c++) set.add(String.fromCharCode(c));
  for (const ch of '·…–—×÷→←↑↓★☆♥“”‘’「」『』《》〈〉①②③④⑤ ') set.add(ch);
  for (const t of texts) for (const ch of t) if (ch.codePointAt(0) >= 0xa0) set.add(ch);
  return [...set].sort().join('');
}

function subsetFont(srcPath, text, family) {
  const h = createHash('sha1').update(srcPath).update(statSync(srcPath).size.toString()).update(text).update(family).digest('hex').slice(0, 12);
  const out = join(CACHE, `${family.replace(/\s+/g, '')}-${h}.woff2`);
  if (!existsSync(out)) {
    const tf = join(CACHE, `text-${h}.txt`);
    writeFileSync(tf, text);
    execFileSync('python3', ['-P', '-E', join(ROOT, 'scripts', 'subset_font.py'), srcPath, tf, out, family], { stdio: 'inherit' });
  }
  return readFileSync(out);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

async function assemble(name, result, fonts) {
  const meta = JSON.parse(readFileSync(join(SRC, name, 'entry.json'), 'utf8'));
  const js = result.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
  const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
  const text = collectText(js, css);

  const faces = [];
  const fontReport = [];
  for (const k of meta.inlineFonts ?? ['sans', 'mono']) {
    const f = INLINE_FONTS[k];
    if (!f) throw new Error(`${name}: 알 수 없는 inlineFonts 값 ${k}`);
    const buf = subsetFont(fonts[f.key], text, f.family);
    fontReport.push(`${f.family} ${(buf.length / 1024).toFixed(1)}KB`);
    faces.push(
      `@font-face{font-family:'${f.family}';src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');font-weight:${f.weight};font-style:normal;font-display:swap}`,
    );
  }

  const gf = meta.googleFonts?.length
    ? `https://fonts.googleapis.com/css2?${meta.googleFonts.map((f) => `family=${f}`).join('&')}&display=swap`
    : null;

  const html = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="claude:viewport-fit-sides" content="cover">`,
    `<style>\n/* 인라인 폰트: ${(meta.inlineFonts ?? ['sans', 'mono']).map((k) => INLINE_FONTS[k].note).join(' · ')} */\n${faces.join('\n')}\n${css.replace(/<\/style/gi, '<\\/style')}</style>`,
    meta.description ? `<meta name="description" content="${esc(meta.description)}">` : '',
    gf
      ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(gf)}">`
      : '',
    `<div id="root"></div>`,
    ...REACT_CDN.map((u) => `<script src="${u}" crossorigin="anonymous"></script>`),
    `<script>\n${js.replace(/<\/script/gi, '<\\/script')}</script>`,
    '',
  ]
    .filter(Boolean)
    .join('\n');

  const out = join(DIST, `${name}.html`);
  writeFileSync(out, html);
  const kb = Buffer.byteLength(html) / 1024;
  console.log(
    `  ${name}.html  ${kb.toFixed(0)}KB  (JS ${(Buffer.byteLength(js) / 1024).toFixed(0)}KB · CSS ${(Buffer.byteLength(css) / 1024).toFixed(0)}KB · ${fontReport.join(' · ')} · 글자 ${[...text].length}종)${kb > 2048 ? '  ⚠ 2MB 초과' : ''}`,
  );
}

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const picked = args.filter((a) => !a.startsWith('--'));
const all = listEntries();
const names = picked.length ? picked : all;
for (const n of names) if (!all.includes(n)) throw new Error(`진입점 없음: src/${n}/ (entry.json + main.tsx 필요)`);

const fonts = ensureFonts();
genContent();
console.log(`build → ${DIST}`);

if (!watch) {
  for (const n of names) {
    const r = await build(esbuildOptions(n));
    await assemble(n, r, fonts);
  }
} else {
  for (const n of names) {
    const ctx = await context({
      ...esbuildOptions(n),
      plugins: [
        globalsPlugin,
        {
          name: 'assemble-on-end',
          setup(b) {
            b.onEnd(async (r) => {
              if (r.errors.length) return;
              await assemble(n, r, fonts);
            });
          },
        },
      ],
    });
    await ctx.watch();
  }
  console.log('watching… (Ctrl+C로 종료)');
}
