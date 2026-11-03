// 쇼케이스 화면 캡처 → docs/spikes/img/P0-07-showcase.png (128색, 250KB 이하)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { launch, BASE } from './pw.mjs';
const TMP = '/tmp/claude-1000/-home-sguys99-project-pyroad/82568201-fb29-4b3f-a687-90ce910c2b13/scratchpad/P0-07/showcase-raw.png';
const OUT = new URL('../../../docs/spikes/img/P0-07-showcase.png', import.meta.url).pathname;
const b = await launch();
const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await p.clock.install({ time: 0 });
await p.goto(BASE + '/?state=cheer&hat=party&glasses=1&cape=E53935');
await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 500);
for (let i = 0; i < 60; i++) await p.clock.runFor(50); // 3초: 런타임 카드 로드 + 응원 포즈
await p.mouse.move(900, 200);
await p.clock.runFor(700);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: TMP, fullPage: true });
await b.close();
execFileSync('python3', ['-c', `import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
im = im.resize((int(w*0.8), int(h*0.8)), Image.LANCZOS)
im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(sys.argv[2], optimize=True)`, TMP, OUT], { cwd: '/tmp' });
console.log('wrote', OUT, Math.round(readFileSync(OUT).length / 1024) + 'KB');
