// 데모 번들 + 테스트 번들 (esbuild). dist/는 gitignore
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  absWorkingDir: root, entryPoints: ['test/motionTier.test.ts'], outdir: 'dist/node', outExtension: { '.js': '.mjs' },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'warning',
});
const { existsSync } = await import('node:fs');
if (existsSync(`${root}/demo/main.tsx`)) {
  await build({
    absWorkingDir: root, entryPoints: { main: 'demo/main.tsx' }, outdir: 'dist', bundle: true, splitting: true, format: 'esm',
    target: ['es2020', 'safari15'], jsx: 'automatic', minify: true, sourcemap: true,
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
    nodePaths: [`${root}/node_modules`],
    // p0-07 리그를 가져오므로 React 사본이 둘이 되지 않게 고정
    alias: {
      react: `${root}/node_modules/react`,
      'react-dom': `${root}/node_modules/react-dom`,
    },
  });
}
console.log('built');
