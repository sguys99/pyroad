// 정적 렌더 비교 이미지: 같은 SVG 문자열을 브라우저(Chromium)와 resvg(next/og와 같은 래스터라이저)로
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch } from './pw.mjs';
const DIR = '/tmp/claude-1000/-home-sguys99-project-pyroad/82568201-fb29-4b3f-a687-90ce910c2b13/scratchpad/P0-07/static';
const OUT = new URL('../../../docs/spikes/img/P0-07-static-share.png', import.meta.url).pathname;
const ids = ['a-happy', 'a-think', 'a-sad', 'b-cheer', 'b-dance', 'reduced-happy'];
const labels = { 'a-happy': 'A 기쁨 + 파티 모자·안경·망토', 'a-think': 'A 생각 + 탐험가 모자', 'a-sad': 'A 슬픔 + 왕관·섬 배경', 'b-cheer': 'B 응원 + 마법사 모자·종이', 'b-dance': 'B 춤 + 선글라스·망토', 'reduced-happy': 'reduced-motion 기쁨 (후광)' };
const res = JSON.parse(readFileSync(new URL('../results/static-svg.json', import.meta.url), 'utf8'));
const b64 = (f) => readFileSync(join(DIR, f)).toString('base64');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>body{margin:0;background:#f6f8f2;font-family:'Gowun Dodum';color:#24331f}.w{display:inline-block;padding:14px 18px}h1{font:20px Jua;margin:0}.n{font-size:12px;color:#66735f;margin:2px 0 10px}
table{border-collapse:separate;border-spacing:8px 6px}th{font:13px Jua;text-align:left;width:120px}td{background:#fff;border-radius:10px;text-align:center;font-size:11px;color:#66735f;padding:4px}img{width:150px;height:150px;display:block}</style></head>
<body><div class="w" id="w"><h1>정적 렌더 = 공유 카드·아바타·SSR 경로</h1><div class="n">엔진 없이 PybaemStatic(훅 없음) → P0-10 직렬화기로 SVG 문자열 → 위: Chromium, 아래: resvg(next/og가 쓰는 래스터라이저). 코스튬이 같은 자리에 붙고 두 렌더가 일치합니다</div>
<table><tr><th></th>${ids.map((i) => `<td style="background:none;font:12px Jua;color:#24331f">${labels[i]}</td>`).join('')}</tr>
<tr><th>Chromium</th>${ids.map((i) => `<td><img src="data:image/svg+xml;base64,${b64(i + '.svg')}"></td>`).join('')}</tr>
<tr><th>resvg<br><small>(next/og)</small></th>${ids.map((i) => `<td><img src="data:image/png;base64,${b64(i + '.resvg.png')}">${res.find((r) => r.id === i).resvgMs}ms · ${(res.find((r) => r.id === i).svgBytes / 1024).toFixed(1)}KB</td>`).join('')}</tr></table></div></body></html>`;
const b = await launch();
const p = await b.newPage({ viewport: { width: 1300, height: 600 } });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const tmp = join(DIR, 'compose.png');
await (await p.$('#w')).screenshot({ path: tmp });
await b.close();
execFileSync('python3', ['-c', `import sys
from PIL import Image
Image.open(sys.argv[1]).convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(sys.argv[2], optimize=True)`, tmp, OUT], { cwd: DIR });
console.log('wrote', OUT, Math.round(readFileSync(OUT).length / 1024) + 'KB');
