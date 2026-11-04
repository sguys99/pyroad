// 데모 화면 캡처 → docs/spikes/img/P0-16-demo.png (왼쪽: full 단계 장면(설정으로 고정), 오른쪽: CPU 6× 자동 하향)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const TMP = '/tmp/claude-1000/-home-sguys99-project-pyroad/82568201-fb29-4b3f-a687-90ce910c2b13/scratchpad/P0-07/';
const OUT = new URL('../../../docs/spikes/img/P0-16-demo.png', import.meta.url).pathname;
const b = await chromium.launch({ headless: true });
async function shot(name, rate, prof, wait) {
  const ctx = await b.newContext({ viewport: { width: 760, height: 620 }, deviceScaleFactor: 1 });
  if (prof) await ctx.addInitScript((p) => {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => p.hc, configurable: true });
    Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => p.dm, configurable: true });
  }, prof);
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await p.goto('http://127.0.0.1:3107/' + (name === 'd1.png' ? '?force=full' : ''));
  await p.waitForTimeout(wait);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: TMP + name });
  await ctx.close();
}
await shot('d1.png', 1, null, 3000);
await shot('d2.png', 6, null, 12000);
await b.close();
execFileSync('python3', ['-c', `import sys
from PIL import Image
a = Image.open(sys.argv[1]).convert('RGB'); c = Image.open(sys.argv[2]).convert('RGB')
o = Image.new('RGB', (a.width + c.width + 12, max(a.height, c.height)), (230, 236, 226))
o.paste(a, (0, 0)); o.paste(c, (a.width + 12, 0))
o = o.resize((int(o.width * 0.8), int(o.height * 0.8)), Image.LANCZOS)
o.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(sys.argv[3], optimize=True)`, TMP + 'd1.png', TMP + 'd2.png', OUT], { cwd: '/tmp' });
console.log('wrote', OUT, Math.round(readFileSync(OUT).length / 1024) + 'KB');
