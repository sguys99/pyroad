// SSR 안전성 확인: Node(window 없음)에서 SoundProvider 트리를 renderToString하고,
// howler / use-sound를 import·렌더해도 예외가 없는지 본다.
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
mkdirSync(`${root}/dist`, { recursive: true });
const entry = `
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DemoApp } from './demo/ReactDemo';
import useSound from 'use-sound';
import * as howler from 'howler';
import { getSoundEngine } from './src/sound';
import { STARTER_MANIFEST } from './src/manifest';

function UseSoundButton() {
  const [play] = useSound('/sounds/coin.mp3');
  return createElement('button', { onClick: () => play() }, 'coin');
}
export function run() {
  const out = {};
  out.typeofWindow = typeof window;
  out.engineKind = getSoundEngine(STARTER_MANIFEST).kind;
  out.howlerImported = typeof howler.Howl === 'function';
  out.howlerUsingWebAudio = howler.Howler.usingWebAudio;
  const html = renderToString(createElement(DemoApp));
  out.providerHtmlBytes = html.length;
  out.providerHasButtons = html.includes('r-run');
  out.providerStateText = /<p id="r-state">(.*?)<\\/p>/.exec(html)?.[1] ?? null;
  out.useSoundHtml = renderToString(createElement(UseSoundButton));
  return out;
}
`;
const outfile = `${root}/dist/ssr-check.mjs`;
await build({
  stdin: { contents: entry, resolveDir: root, loader: 'tsx' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  outfile,
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
  logLevel: 'error',
});
const mod = await import(pathToFileURL(outfile).href);
try {
  const r = mod.run();
  console.log(JSON.stringify(r, null, 1));
  writeFileSync(`${root}/results/ssr-check.json`, JSON.stringify({ ok: true, node: process.version, ...r }, null, 1));
} catch (e) {
  console.error('SSR 실패', e);
  writeFileSync(`${root}/results/ssr-check.json`, JSON.stringify({ ok: false, error: String(e) }, null, 1));
  process.exit(1);
}
