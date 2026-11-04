// 데모 번들 (esbuild). dist/ 는 gitignore
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  absWorkingDir: root,
  entryPoints: { main: 'demo/main.ts', gap: 'demo/gap.ts', react: 'demo/react-main.tsx' },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  sourcemap: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
