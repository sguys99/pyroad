// 감지 타임라인 그림 (results/raw/validate.json → docs/spikes/img/P0-16-detect-timeline.png)
// 막대 = 페이지 시작부터 16초 동안의 연출 단계, 3회 반복은 얇은 막대 3개. 오른쪽 = 기대 단계와 일치 여부
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
const IN = process.argv[2] ?? new URL('../results/raw/validate.json', import.meta.url).pathname;
const OUT = new URL('../../../docs/spikes/img/P0-16-detect-timeline.png', import.meta.url).pathname;
const TMP = '/tmp/claude-1000/-home-sguys99-project-pyroad/82568201-fb29-4b3f-a687-90ce910c2b13/scratchpad/P0-07/timeline.png';
const d = JSON.parse(readFileSync(IN, 'utf8'));
const TIERS = ['full', 'lite', 'minimal'];
const COLOR = { full: '#184f95', lite: '#3987e5', minimal: '#86b6ef' }; // 순서형 단일 색상 램프 (dataviz 검증 통과)
const TEXT = { full: '#ffffff', lite: '#ffffff', minimal: '#0d366b' };
const idx = (t) => TIERS.indexOf(t);
const lower = (a, b) => (idx(a) >= idx(b) ? a : b);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const oracle = {};
for (const o of d.oracle) (oracle[`${o.scene}|${o.rate}|${o.tier}`] ??= []).push(o.drop);
const ans = (scene, rate) => TIERS.find((t) => med(oracle[`${scene}|${rate}|${t}`] ?? [1]) <= 0.25) ?? 'minimal';
const cap = { pc: 'full', chromebook: 'lite', weak: 'lite', ipad: 'full' };
const PLABEL = { pc: 'PC 실제값 (20코어·32GB)', chromebook: '크롬북 (2코어·4GB)', weak: '약한 기기 (2코어·2GB)', ipad: 'iPad UA (코어 4)' };
const T = 16000;
const W = 560;
const groups = [...new Set(d.detect.map((r) => `${r.rate}|${r.scene}|${r.profile}`))];
let rows = '';
for (const g of groups) {
  const [rate, scene, profile] = g.split('|');
  const rs = d.detect.filter((r) => `${r.rate}|${r.scene}|${r.profile}` === g);
  const expect = lower(ans(scene, +rate), cap[profile]);
  const bars = rs
    .map((r) => {
      const segs = [];
      const log = r.log;
      for (let i = 0; i < log.length; i++) {
        const a = i === 0 ? 0 : Math.min(T, log[i].t);
        const b = i + 1 < log.length ? Math.min(T, log[i + 1].t) : T;
        if (b > a) segs.push({ tier: log[i].tier, a, b });
      }
      return `<div class="bar">${segs
        .map((s) => {
          const w = ((s.b - s.a) / T) * W;
          return `<span style="left:${(s.a / T) * W}px;width:${Math.max(0, w - 2)}px;background:${COLOR[s.tier]};color:${TEXT[s.tier]}">${w > 46 ? s.tier : ''}</span>`;
        })
        .join('')}</div>`;
    })
    .join('');
  const finals = rs.map((r) => r.log[r.log.length - 1].tier);
  const okN = finals.filter((f) => f === expect).length;
  rows += `<div class="row${rate !== groups[0].split('|')[0] && g === groups.find((x) => x.startsWith(rate + '|')) ? ' sep' : ''}"><div class="lab"><b>${rate}×</b> ${scene === 'light' ? '가벼운 장면' : ''} ${PLABEL[profile]}</div><div class="bars">${bars}</div><div class="exp">기대 <b>${expect}</b> · ${okN}/${finals.length} 일치</div></div>`;
}
const ticks = [0, 2, 4, 6, 8, 10, 12, 14, 16].map((s) => `<span style="left:${(s * 1000 / T) * W}px">${s}s</span>`).join('');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>body{margin:0;background:#fcfcfb;font-family:'Gowun Dodum',sans-serif;color:#24331f}.w{display:inline-block;padding:16px 20px}
h1{font:20px Jua;margin:0}.n{font-size:12px;color:#5d6b57;margin:3px 0 10px;max-width:980px}
.lg{display:flex;gap:14px;font-size:12px;margin-bottom:8px;color:#24331f}.lg i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px}
.row{display:grid;grid-template-columns:250px ${W}px 150px;gap:10px;align-items:center;padding:3px 0}.row.sep{border-top:1px solid #e6e9e1;margin-top:4px;padding-top:7px}
.lab{font-size:12.5px}.lab b{font:14px Jua;margin-right:2px}.exp{font-size:12px;color:#5d6b57}.exp b{color:#24331f}
.bar{position:relative;height:9px;margin:2px 0}.bar span{position:absolute;top:0;height:9px;border-radius:2px;font:9px/9px ui-monospace,monospace;text-indent:3px;overflow:hidden}
.axis{position:relative;height:16px;margin-left:260px;font:10px ui-monospace,monospace;color:#7a8673}.axis span{position:absolute;transform:translateX(-50%)}</style></head>
<body><div class="w" id="w"><h1>자동 감지 타임라인: 페이지 시작부터 16초 동안의 연출 단계</h1>
<div class="n">헤드리스 Chromium, CPU 스로틀 × 하드웨어 프로필, 각 3회(얇은 막대 3개). 기대 단계 = min(단계를 고정해 측정한 정답 단계, 정적 신호 상한). 같은 장면이 단계에 반응해 가벼워지므로 내려간 뒤에는 더 내려가지 않는 것이 정상입니다</div>
<div class="lg">${TIERS.map((t) => `<span><i style="background:${COLOR[t]}"></i>${t}</span>`).join('')}</div>
${rows}<div class="axis">${ticks}</div></div></body></html>`;
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1100, height: 800 } });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await (await p.$('#w')).screenshot({ path: TMP });
await b.close();
execFileSync('python3', ['-c', `import sys
from PIL import Image
Image.open(sys.argv[1]).convert('RGB').quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(sys.argv[2], optimize=True)`, TMP, OUT], { cwd: '/tmp' });
console.log('wrote', OUT, Math.round(readFileSync(OUT).length / 1024) + 'KB');
