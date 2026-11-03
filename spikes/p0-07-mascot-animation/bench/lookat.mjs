// 따라보기 반응: 포인터를 순간 이동했을 때 시선이 목표의 50%/90%에 닿는 시간 (가짜 시계, 결정적)
// + 포인터 위치별 스냅샷 스트립 (docs/spikes/img/P0-07-lookat.png)
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, BASE } from './pw.mjs';
const FR = '/tmp/claude-1000/-home-sguys99-project-pyroad/82568201-fb29-4b3f-a687-90ce910c2b13/scratchpad/P0-07/frames/look';
mkdirSync(FR, { recursive: true });
const b = await launch();
const p = await b.newPage({ viewport: { width: 700, height: 500 } });
await p.clock.install({ time: 0 });
await p.goto(BASE + '/capture.html?size=170&hat=explorer');
await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 500);
await p.clock.runFor(1500);
const box = await (await p.$('#cap svg')).boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height * 0.42;
// 반응 시간: 중앙 → 오른쪽 끝
await p.mouse.move(cx, cy);
await p.clock.runFor(800);
const x0 = (await p.evaluate(() => window.__cap.snapshot())).lookX;
await p.mouse.move(cx + 400, cy);
const trace = [];
for (let i = 0; i < 40; i++) {
  await p.clock.runFor(1000 / 60);
  trace.push((await p.evaluate(() => window.__cap.snapshot())).lookX);
}
const target = trace[trace.length - 1];
const reach = (f) => (trace.findIndex((v) => (v - x0) / (target - x0) >= f) + 1) * (1000 / 60);
const res = { x0, target, t50: Math.round(reach(0.5)), t90: Math.round(reach(0.9)), overshoot: +(Math.max(...trace) / target - 1).toFixed(3) };
console.log('look-at', res);
writeFileSync(new URL('../results/lookat.json', import.meta.url), JSON.stringify({ ...res, trace }, null, 1));
// 스냅샷: 9방향
const shots = [];
for (const [dx, dy, name] of [[-300, -200, '↖'], [0, -260, '↑'], [300, -200, '↗'], [-320, 0, '←'], [0, 0, '·'], [320, 0, '→'], [-300, 220, '↙'], [0, 260, '↓'], [300, 220, '↘']]) {
  await p.mouse.move(cx + dx, cy + dy);
  await p.clock.runFor(700);
  const f = join(FR, `${shots.length}.png`);
  await (await p.$('#cap')).screenshot({ path: f });
  shots.push({ f, name });
}
// 터치: 탭한 곳을 잠깐 보고 2.5초 뒤 원위치
await b.close();
const b2 = await launch();
const q = await b2.newPage({ viewport: { width: 980, height: 400 } });
const cell = (s) => `<figure><img src="data:image/png;base64,${readFileSync(s.f).toString('base64')}"><figcaption>${s.name}</figcaption></figure>`;
await q.setContent(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>body{margin:0;background:#f6f8f2;font-family:'Gowun Dodum';color:#24331f}.w{display:inline-block;padding:14px 16px}h1{font:20px Jua;margin:0}.n{font-size:12px;color:#66735f;margin:2px 0 8px}
.g{display:grid;grid-template-columns:repeat(9,100px);gap:6px}figure{margin:0;background:#fff;border-radius:8px;text-align:center;box-shadow:0 1px 0 #dde5d4}img{width:100px;height:100px;object-fit:contain;display:block}figcaption{font:16px Jua;color:#ff7043}</style></head>
<body><div class="w" id="w"><h1>포인터 따라보기 (대기 상태, 화살표 = 포인터 방향)</h1><div class="n">눈동자 → 얼굴 → 머리 순으로 크게 따라갑니다. 반응: 목표의 50%까지 ${res.t50}ms, 90%까지 ${res.t90}ms (스프링 k=150·c=22, 넘침 ${(res.overshoot * 100).toFixed(1)}%). 터치는 탭한 곳을 2.5초 보고 돌아옵니다</div>
<div class="g">${shots.map(cell).join('')}</div></div></body></html>`, { waitUntil: 'networkidle' });
await q.evaluate(() => document.fonts.ready);
const tmp = join(FR, 'compose.png');
await (await q.$('#w')).screenshot({ path: tmp });
await b2.close();
const OUT = new URL('../../../docs/spikes/img/P0-07-lookat.png', import.meta.url).pathname;
execFileSync('python3', ['-c', `import sys
from PIL import Image
Image.open(sys.argv[1]).convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(sys.argv[2], optimize=True)`, tmp, OUT], { cwd: FR });
console.log('wrote', OUT, Math.round(readFileSync(OUT).length / 1024) + 'KB');
