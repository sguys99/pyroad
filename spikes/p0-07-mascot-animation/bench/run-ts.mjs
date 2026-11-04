// TS 스크립트를 esbuild로 묶어 Node에서 실행: node bench/run-ts.mjs <file.ts> [...args]
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, basename } from 'node:path';
import { mkdirSync } from 'node:fs';
const root = fileURLToPath(new URL('..', import.meta.url));
const entry = process.argv[2];
mkdirSync(join(root, 'dist/node'), { recursive: true });
const out = join(root, 'dist/node', basename(entry).replace(/\.tsx?$/, '.mjs'));
await build({
  absWorkingDir: root, entryPoints: [entry], outfile: out, bundle: true, platform: 'node', format: 'esm',
  jsx: 'automatic', packages: 'external', logLevel: 'warning', define: { 'import.meta.url': 'import_meta_url' },
  banner: { js: `const import_meta_url = ${JSON.stringify(pathToFileURL(join(root, entry)).href)};` },
});
process.argv.splice(2, 1);
await import(pathToFileURL(out).href);
