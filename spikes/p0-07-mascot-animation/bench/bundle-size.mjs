// P0-07 번들 크기 (esbuild minify → gzip -9 / brotli q11). React·react-dom은 외부(앱에 이미 있음).
// wasm은 별도 파일로 내려받으므로 따로 잰다.
import { build } from 'esbuild';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2];
const EXTERNAL = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'];
const kb = (n) => +(n / 1024).toFixed(1);
const measure = (buf) => ({
  min: kb(buf.length),
  gzip: kb(gzipSync(buf, { level: 9 }).length),
  brotli: kb(brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length),
});
const cases = [
  ['SVG 리그 (engine+geometry+PybaemRig+코스튬)', `import { PybaemRig } from './src/rig/PybaemRig'; globalThis.__x = PybaemRig;`],
  ['SVG 리그 정적 렌더만 (PybaemStatic: 마크업+코스튬+geometry, 공유 카드·아바타)', `import { PybaemStatic } from './src/rig/RigSvg'; globalThis.__x = PybaemStatic;`],
  ['참고: framer-motion LazyMotion+domAnimation+m (앱에 이미 있음)', `import { LazyMotion, domAnimation, m } from 'framer-motion'; globalThis.__x = [LazyMotion, domAnimation, m];`],
  ['lottie-web 전체 (lottie.js, svg+canvas+html)', `import l from 'lottie-web'; globalThis.__x = l;`],
  ['lottie-web lottie_svg (SVG 렌더러만)', `import l from 'lottie-web/build/player/lottie_svg'; globalThis.__x = l;`],
  ['lottie-web lottie_light (SVG, 표현식 없음)', `import l from 'lottie-web/build/player/lottie_light'; globalThis.__x = l;`],
  ['lottie-web lottie_canvas', `import l from 'lottie-web/build/player/lottie_canvas'; globalThis.__x = l;`],
  ['lottie-react 2.4.1 (lottie-web 전체 포함)', `import L from 'lottie-react'; globalThis.__x = L;`],
  ['@lottiefiles/dotlottie-web 0.82.1 (JS만)', `import { DotLottie } from '@lottiefiles/dotlottie-web'; globalThis.__x = DotLottie;`],
  ['@lottiefiles/dotlottie-react 0.21.1 (JS만)', `import { DotLottieReact } from '@lottiefiles/dotlottie-react'; globalThis.__x = DotLottieReact;`],
  ['@rive-app/canvas 2.49.1 (JS만)', `import R from '@rive-app/canvas'; globalThis.__x = R;`],
  ['@rive-app/canvas-lite 2.49.1 (JS만)', `import R from '@rive-app/canvas-lite'; globalThis.__x = R;`],
  ['@rive-app/webgl2 2.49.1 (JS만)', `import R from '@rive-app/webgl2'; globalThis.__x = R;`],
  ['@rive-app/react-canvas 4.38.0 (JS만)', `import { useRive } from '@rive-app/react-canvas'; globalThis.__x = useRive;`],
  ['canvas-confetti 1.9.4 (참고: 앱에 이미 있음)', `import c from 'canvas-confetti'; globalThis.__x = c;`],
];
const rows = [];
for (const [name, contents] of cases) {
  const r = await build({
    stdin: { contents, resolveDir: root, loader: 'tsx' },
    bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['es2020', 'safari15'],
    jsx: 'automatic', write: false, external: EXTERNAL, outdir: join(root, 'dist/size'), splitting: true,
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error', loader: { '.wasm': 'file' },
  });
  const js = r.outputFiles.filter((f) => f.path.endsWith('.js'));
  const all = Buffer.concat(js.map((f) => Buffer.from(f.contents)));
  rows.push({ name, ...measure(all), chunks: js.length });
}
const wasm = [
  ['dotlottie-player.wasm', 'node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm'],
  ['rive.wasm (@rive-app/canvas)', 'node_modules/@rive-app/canvas/rive.wasm'],
  ['rive.wasm (@rive-app/canvas-lite)', 'node_modules/@rive-app/canvas-lite/rive.wasm'],
  ['rive.wasm (@rive-app/webgl2)', 'node_modules/@rive-app/webgl2/rive.wasm'],
].map(([name, p]) => ({ name, ...measure(readFileSync(join(root, p))) }));
const assets = [
  ['저장소 Lottie 4종 합계 (도형 플레이스홀더)', ['celebrating', 'entrance', 'level-up', 'project-complete'].map((n) => join(root, `../../public/characters/pybaem/lottie/${n}.json`))],
  ['리그→Lottie 굽기: 7상태 전체 (466프레임)', [join(root, 'assets/generated/pybaem-rig-baked.json')]],
  ['리그→Lottie 굽기: 춤 구간만 (60프레임)', [join(root, 'assets/generated/pybaem-rig-baked-dance-only.json')]],
  ['리그→Lottie 굽기: 대기 구간만 (96프레임)', [join(root, 'assets/generated/pybaem-rig-baked-idle-only.json')]],
  ['Rive avatars.riv (아바타 4종, 벡터)', [join(root, 'assets/third-party/rive/avatars.riv')]],
  ['Rive birb.riv (PNG 16장 포함)', [join(root, 'assets/third-party/rive/birb.riv')]],
  ['현재 PybaemSvg.tsx 소스 (참고)', [join(root, '../../src/components/characters/PybaemSvg.tsx')]],
].map(([name, files]) => ({ name, ...measure(Buffer.concat(files.map((f) => readFileSync(f)))) }));
const print = (title, rs) => {
  console.log(`\n### ${title}\n| 대상 | min KB | gzip KB | brotli KB |\n|---|---:|---:|---:|`);
  for (const r of rs) console.log(`| ${r.name} | ${r.min} | ${r.gzip} | ${r.brotli} |`);
};
print('JS (React 제외)', rows);
print('WASM (별도 요청)', wasm);
print('에셋', assets);
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), esbuild: (await import('esbuild')).version, rows, wasm, assets }, null, 1));
}
