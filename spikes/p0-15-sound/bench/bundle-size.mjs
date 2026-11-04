// P0-15 번들 크기 측정 (esbuild minify → gzip -9 / brotli q11). React는 외부(이미 앱에 있음)로 뺀다.
// 사용: node bundle-size.mjs <spike 디렉토리> [출력 json]
import { build } from 'esbuild';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SPIKE = process.argv[2] ?? '/home/sguys99/project/pyroad/spikes/p0-15-sound';
const OUT = process.argv[3];
const NM = [join(here, 'node_modules'), join(SPIKE, 'node_modules')];
const EXTERNAL = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'];

const cases = [
  ['howler (전체: core + spatial)', `import { Howl, Howler } from 'howler'; globalThis.__x = [Howl, Howler];`],
  ['howler.core.min.js (spatial 제외)', `import * as H from 'howler/dist/howler.core.min.js'; globalThis.__x = H;`],
  ['use-sound 5.0.0 (초기 청크, howler 지연 로드)', `import useSound from 'use-sound'; globalThis.__x = useSound;`],
  ['react-sounds 1.0.30', `import * as RS from 'react-sounds'; globalThis.__x = RS;`],
  ['tone 15.1.22 (import *)', `import * as Tone from 'tone'; globalThis.__x = Tone;`],
  ['tone 15.1.22 (Player만, tree-shaking)', `import { Player, start, getContext } from 'tone'; globalThis.__x = [Player, start, getContext];`],
  ['zzfx 1.4.0 (합성 효과음)', `import { zzfx } from 'zzfx'; globalThis.__x = zzfx;`],
  [
    '자체 엔진 core (webAudioEngine + settings + platform)',
    `import { createWebAudioEngine } from '${SPIKE}/src/sound/webAudioEngine'; import { createLocalSettingsStorage } from '${SPIKE}/src/sound/settings'; import { attachUnlockListeners } from '${SPIKE}/src/sound/platform'; globalThis.__x = [createWebAudioEngine, createLocalSettingsStorage, attachUnlockListeners];`,
  ],
  [
    '자체 엔진 + React 바인딩 (SoundProvider, hooks)',
    `import * as P from '${SPIKE}/src/react/SoundProvider'; globalThis.__x = P;`,
  ],
  [
    '비교: Howler 어댑터 (howlerEngine + howler)',
    `import { createHowlerEngine } from '${SPIKE}/src/sound/howlerEngine'; globalThis.__x = createHowlerEngine;`,
  ],
];

const kb = (n) => +(n / 1024).toFixed(2);
const rows = [];
for (const [name, contents] of cases) {
  const r = await build({
    stdin: { contents, resolveDir: here, loader: 'tsx' },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020', 'safari15'],
    jsx: 'automatic',
    splitting: true,
    outdir: join(here, 'out'),
    write: false,
    external: EXTERNAL,
    nodePaths: NM,
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  const files = r.outputFiles.filter((f) => f.path.endsWith('.js'));
  const entry = files.find((f) => f.path.includes('stdin')) ?? files[0];
  const measure = (buf) => ({
    min: kb(buf.length),
    gzip: kb(gzipSync(buf, { level: 9 }).length),
    brotli: kb(brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length),
  });
  const initial = measure(Buffer.from(entry.contents));
  const lazy = files.filter((f) => f !== entry).map((f) => Buffer.from(f.contents));
  const lazyTotal = lazy.length ? measure(Buffer.concat(lazy)) : null;
  rows.push({ name, initial, lazy: lazyTotal });
}
console.log('| 대상 | min KB | gzip KB | brotli KB | 지연 청크 gzip KB |');
console.log('|---|---:|---:|---:|---:|');
for (const r of rows) console.log(`| ${r.name} | ${r.initial.min} | ${r.initial.gzip} | ${r.initial.brotli} | ${r.lazy ? r.lazy.gzip : '-'} |`);
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), esbuild: (await import('esbuild')).version, rows }, null, 1));
}
