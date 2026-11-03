// 데모·벤치 번들 (esbuild). dist/ 는 gitignore. 런타임 wasm은 자체 호스팅하도록 dist/wasm/ 으로 복사
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const nm = join(root, 'node_modules');
mkdirSync(join(root, 'dist/wasm'), { recursive: true });
for (const [src, dst] of [
  ['@rive-app/canvas/rive.wasm', 'rive-canvas.wasm'],
  ['@rive-app/canvas-lite/rive.wasm', 'rive-canvas-lite.wasm'],
  ['@rive-app/webgl2/rive.wasm', 'rive-webgl2.wasm'],
  ['@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm', 'dotlottie-player.wasm'],
]) {
  if (existsSync(join(nm, src))) copyFileSync(join(nm, src), join(root, 'dist/wasm', dst));
}
const watch = process.argv.includes('--watch');
const opts = {
  absWorkingDir: root,
  entryPoints: Object.fromEntries(
    Object.entries({
      showcase: 'demo/showcase.tsx',
      bench: 'demo/bench.tsx',
      inspect: 'demo/inspect.ts',
      capture: 'demo/capture.tsx',
      rt: 'demo/rt.ts',
    }).filter(([, f]) => existsSync(join(root, f))),
  ),
  outdir: 'dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  sourcemap: true,
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
};
if (watch) {
  const { context } = await import('esbuild');
  const ctx = await context(opts);
  await ctx.watch();
} else {
  await build(opts);
}
