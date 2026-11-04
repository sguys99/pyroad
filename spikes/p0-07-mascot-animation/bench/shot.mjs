// 사용: node bench/shot.mjs <path> <out.png> [width] [height] [waitMs] [selector]
import { launch, BASE } from './pw.mjs';
const [, , path = '/', out = 'shot.png', w = '1280', h = '900', wait = '1500', sel] = process.argv;
const b = await launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log('[page]', m.type(), m.text()));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(BASE + path);
await p.waitForTimeout(+wait);
if (sel) await (await p.$(sel)).screenshot({ path: out });
else await p.screenshot({ path: out, fullPage: true });
await b.close();
