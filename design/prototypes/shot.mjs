// Playwright 스크린샷 → shots/ (gitignore). 저장소 루트에 설치된 playwright를 재사용한다.
//   node shot.mjs <이름> [--hash quest] [--widths 360,768,1280] [--reduced] [--tier lite] [--frame mobile]
//                        [--full] [--wait 1200] [--fonts]
// 예: node shot.mjs moodboard --full --fonts
//     node shot.mjs a --hash world --widths 390 --reduced
// 콘솔 오류·페이지 오류를 모아 출력하고, --fonts면 document.fonts로 실제 적용된 웹폰트를 보고한다.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(ROOT, '..', '..', 'package.json'));
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const flag = (k) => argv.includes(`--${k}`);
const name = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')) ?? 'moodboard';
const hash = opt('hash', '');
const widths = opt('widths', '360,768,1280').split(',').map(Number);
const reduced = flag('reduced');
const tier = opt('tier', 'full');
const frame = opt('frame', 'full');
const full = flag('full');
const wait = Number(opt('wait', '1500'));
const port = Number(opt('port', '4318'));

const OUT = join(ROOT, 'shots');
mkdirSync(OUT, { recursive: true });
const server = await startServer(port);
const browser = await chromium.launch();
let errors = 0;
try {
  for (const w of widths) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: w < 600 ? 800 : w < 1000 ? 1024 : 860 },
      deviceScaleFactor: w < 600 ? 2 : 1,
      reducedMotion: reduced ? 'reduce' : 'no-preference',
      locale: 'ko-KR',
    });
    // 검토 도구 상태를 미리 심어 둔다 (localStorage)
    await ctx.addInitScript(
      ([t, r, f]) => {
        try {
          localStorage.setItem('pyroad-proto-motion', JSON.stringify({ tier: t, reduced: r }));
          localStorage.setItem('pyroad-proto-frame', f);
          localStorage.setItem('pyroad-proto-chrome-collapsed', '1');
        } catch {}
      },
      [tier, reduced, frame],
    );
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(`http://127.0.0.1:${port}/${name}.html${hash ? '#' + hash : ''}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(wait);
    const tag = [name, hash || 'top', w, reduced ? 'reduced' : '', tier !== 'full' ? tier : '', frame !== 'full' ? frame : '']
      .filter(Boolean)
      .join('-');
    const file = join(OUT, `${tag}.png`);
    await page.screenshot({ path: file, fullPage: full });
    console.log(`  ${file}`);
    if (flag('fonts')) {
      const f = await page.evaluate(() => {
        const loaded = [...document.fonts].filter((x) => x.status === 'loaded').map((x) => `${x.family.replace(/"/g, '')} ${x.weight}`);
        const probe = (fam) => document.fonts.check(`16px "${fam}"`, '파이뱀 안녕');
        return {
          loaded: [...new Set(loaded)],
          check: Object.fromEntries(['pyRoad Sans', 'pyRoad Mono', 'Jua', 'Gaegu', 'Gowun Dodum'].map((x) => [x, probe(x)])),
        };
      });
      console.log('    fonts loaded:', f.loaded.join(', ') || '(없음)');
      console.log('    fonts.check:', JSON.stringify(f.check));
    }
    if (logs.length) {
      errors += logs.filter((l) => !l.startsWith('[warning]')).length;
      console.log(logs.map((l) => '    ' + l).join('\n'));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(errors ? `콘솔 오류 ${errors}건` : '콘솔 오류 0');
