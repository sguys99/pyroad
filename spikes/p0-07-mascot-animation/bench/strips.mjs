// 프레임 스트립 캡처 (가짜 시계로 결정적) + 조판(HTML→PNG) + 프레임 간 픽셀 변화량
// 사용: node bench/strips.mjs <scenario...|all>   결과: results/strips/*.json, $FRAMES_DIR/<id>/, docs/spikes/img/P0-07-*.png
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { launch, BASE } from './pw.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const IMG = join(ROOT, '../../docs/spikes/img');
const FR = process.env.FRAMES_DIR ?? '/tmp/claude-1000/-home-sguys99-project-pyroad/82568201-fb29-4b3f-a687-90ce910c2b13/scratchpad/P0-07/frames';
const RES = join(ROOT, 'results/strips');
mkdirSync(RES, { recursive: true });
const STEP = 1000 / 30;

// 리그 페이지 (capture.html) / 런타임 페이지 (rt.html)
const rig = (qs) => ({ url: `/capture.html?size=170&look=0&${qs}`, set: (s) => `window.__cap.setState('${s}')`, ready: '!!window.__cap' });
const rt = (name) => ({ url: `/rt.html?rt=${name}&size=170`, set: (s) => `window.__rt.setState('${s}')`, ready: 'window.__rt && window.__rt.ready' });

/** 끊기: 대기 → 0ms 기쁨 → 250ms 슬픔 (기쁨 점프 도중) */
const INTERRUPT = { events: [[0, 'happy'], [250, 'sad']], dur: 1300 };
const SCEN = {
  'int-rig': { label: 'SVG 리그', ...rig('props=0'), ...INTERRUPT },
  'int-dl-tween': { label: 'dotLottie 상태머신 (Tweened 0.25s)', ...rt('baked-sm'), ...INTERRUPT },
  'int-dl-instant': { label: 'dotLottie 상태머신 (즉시 전환)', ...rt('baked-sm-instant'), ...INTERRUPT },
  'int-lottie-seg': { label: 'lottie-web 구간 전환 (playSegments)', ...rt('lottie-seg'), ...INTERRUPT },
  'int-rive': { label: 'Rive avatars.riv (isHappy→isSad)', ...rt('rive-avatar'), ...INTERRUPT },
  // 디자인 A 시그니처: 점프 + 젤리 (모자 출렁임 포함)
  'happy-a': { label: '기쁨 (A)', ...rig('hat=party&cape=E53935'), events: [[0, 'happy']], dur: 1500 },
  'cheer-a': { label: '응원 (A)', ...rig('hat=explorer&glasses=round'), events: [[0, 'cheer']], dur: 1100 },
  'dance-a': { label: '춤 (A)', ...rig('hat=crown'), events: [[0, 'dance']], dur: 1100 },
  'talk-a': { label: '말하기 (A)', ...rig(''), events: [[0, 'talk']], dur: 1100, settle: 600 },
  'think-a': { label: '생각 (A)', ...rig('glasses=round'), events: [[0, 'think']], dur: 1100 },
  'sad-a': { label: '슬픔 (A)', ...rig(''), events: [[0, 'sad']], dur: 1300 },
  // 디자인 B: 같은 리그, 잉크 떨림 필터 + 2프레임(12fps) 계단식
  'happy-b': { label: '기쁨 (B)', ...rig('style=B&hat=wizard'), events: [[0, 'happy']], dur: 1500 },
  'dance-b': { label: '춤 (B)', ...rig('style=B&bg=paper'), events: [[0, 'dance']], dur: 1100 },
  // reduced-motion: 움직임 없이 표정 + 후광 색
  'reduced': { label: 'reduced-motion', ...rig('reduced=1&hat=party'), events: [[0, 'happy'], [400, 'sad'], [800, 'think'], [1200, 'cheer']], dur: 1500 },
};

async function capture(id, sc) {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 260, height: 260 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log(`[${id}] pageerror`, e.message));
  await p.clock.install({ time: 0 });
  await p.goto(BASE + sc.url);
  // install()만 하면 호출 사이에도 시간이 흐른다 → 멈춰 두고 runFor로만 진행
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 500);
  for (let i = 0; i < 200 && !(await p.evaluate(sc.ready)); i++) await p.clock.runFor(50);
  await p.clock.runFor(sc.settle ?? 1500);
  const dir = join(FR, id);
  mkdirSync(dir, { recursive: true });
  const el = await p.$('#cap');
  const events = [...sc.events];
  const n = Math.round(sc.dur / STEP);
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const t = i * STEP;
    while (events.length && events[0][0] <= t + 0.5) {
      const [, s] = events.shift();
      await p.evaluate(sc.set(s));
    }
    const f = join(dir, `${String(i).padStart(3, '0')}.png`);
    await el.screenshot({ path: f });
    frames.push({ i, t: Math.round(t), f });
    await p.clock.runFor(STEP);
  }
  await b.close();
  return frames;
}

/** 프레임 간 평균 픽셀 변화량(0~255)과 캐릭터 실루엣 무게중심 y(px) */
function diffs(dir) {
  const out = execFileSync('python3', ['-c', `
import sys, glob, json
from PIL import Image, ImageChops, ImageStat
fs = sorted(glob.glob(sys.argv[1] + '/*.png'))
prev = None; d = []; cy = []
for f in fs:
    im = Image.open(f).convert('L')
    if prev is not None and prev.size == im.size:
        d.append(round(ImageStat.Stat(ImageChops.difference(prev, im)).mean[0], 3))
    prev = im
    m = im.point(lambda v: 255 if v < 235 else 0)
    w, h = m.size; px = m.load(); sy = 0; n = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y]: sy += y; n += 1
    cy.append(round(sy / n, 2) if n else None)
print(json.dumps({'d': d, 'cy': cy}))
`, dir], { cwd: FR });
  return JSON.parse(out.toString());
}

async function compose(out, title, rows, every = 2, note = '') {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: 1 });
  const cell = (f, t, hl) =>
    `<figure class="${hl ? 'hl' : ''}"><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${t}ms</figcaption></figure>`;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>body{margin:0;background:#f6f8f2;font-family:'Gowun Dodum',sans-serif;color:#24331f}
.wrap{display:inline-block;padding:14px 16px}h1{font:20px Jua;margin:0 0 2px}.note{font-size:12px;color:#66735f;margin-bottom:8px}
.row{display:flex;align-items:center;gap:6px;margin:6px 0}.lab{width:150px;font:14px Jua;flex:none}.lab small{display:block;font:11px 'Gowun Dodum';color:#66735f}
figure{margin:0;background:#fff;border-radius:8px;padding:2px;text-align:center;box-shadow:0 1px 0 #dde5d4}figure.hl{box-shadow:0 0 0 2px #ff8a65}
img{display:block;width:96px;height:96px;object-fit:contain}figcaption{font:10px ui-monospace,monospace;color:#7a8673}</style></head>
<body><div class="wrap" id="w"><h1>${title}</h1><div class="note">${note}</div>
${rows
  .map(
    (r) =>
      `<div class="row"><div class="lab">${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</div>${r.frames
        .filter((_, k) => k % every === 0)
        .map((fr, k, arr) => cell(fr.f, fr.t, r.hl?.some((e) => fr.t >= e && (k === 0 || arr[k - 1].t < e))))
        .join('')}</div>`,
  )
  .join('')}</div></body></html>`;
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const tmp = join(FR, 'compose.png');
  await (await p.$('#w')).screenshot({ path: tmp });
  await b.close();
  // 256색 팔레트로 줄여 250KB 이하로
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(sys.argv[2], optimize=True)
`, tmp, out], { cwd: FR });
  console.log('wrote', out, Math.round(readFileSync(out).length / 1024) + 'KB');
}

const want = process.argv.slice(2);
const ids = want.includes('all') || !want.length ? Object.keys(SCEN) : want.filter((w) => SCEN[w]);
const results = {};
for (const id of ids) {
  const frames = await capture(id, SCEN[id]);
  const { d, cy } = diffs(join(FR, id));
  results[id] = { label: SCEN[id].label, events: SCEN[id].events, frames: frames.map((f) => ({ i: f.i, t: f.t })), diffs: d, cy };
  writeFileSync(join(RES, `${id}.json`), JSON.stringify(results[id]));
  const sorted = [...d].sort((a, b) => a - b);
  console.log(id, 'frames', frames.length, 'diff median', sorted[Math.floor(sorted.length / 2)], 'max', sorted[sorted.length - 1]);
}

const load = (id) => {
  const j = JSON.parse(readFileSync(join(RES, `${id}.json`), 'utf8'));
  return { ...j, frames: j.frames.map((f) => ({ ...f, f: join(FR, id, `${String(f.i).padStart(3, '0')}.png`) })) };
};
const have = (ids) => ids.every((id) => existsSync(join(RES, `${id}.json`)) && existsSync(join(FR, id)));

if (have(['int-rig', 'int-dl-tween', 'int-lottie-seg', 'int-rive'])) {
  const rows = ['int-rig', 'int-dl-tween', 'int-dl-instant', 'int-lottie-seg', 'int-rive'].filter((id) => have([id])).map((id) => {
    const r = load(id);
    // 실루엣 무게중심의 프레임당 이동량: 입력 전(0~250ms) 최대 vs 입력 후(250~450ms) 최대
    const jump = (a, b) => {
      let m = 0;
      for (let i = 1; i < r.cy.length; i++) if (r.frames[i].t > a && r.frames[i].t <= b && r.cy[i] != null && r.cy[i - 1] != null) m = Math.max(m, Math.abs(r.cy[i] - r.cy[i - 1]));
      return m;
    };
    const before = jump(0, 250);
    const after = jump(250, 450);
    return { label: r.label, sub: `프레임당 최대 이동 입력 전 ${before.toFixed(1)}px → 입력 후 ${after.toFixed(1)}px`, frames: r.frames.slice(0, 28), hl: [0, 250] };
  });
  await compose(join(IMG, 'P0-07-interrupt.png'), '끊기 테스트: 0ms 기쁨 → 250ms 슬픔 (점프 도중)', rows, 2,
    '주황 테두리 = 입력 시점. 66ms 간격. SVG 리그·Lottie 3종은 같은 파이뱀 동작(리그를 구운 것), Rive는 공개 샘플(다른 캐릭터)');
}
if (have(['happy-a'])) {
  const h = load('happy-a');
  await compose(join(IMG, 'P0-07-happy-jelly-a.png'), 'A 모험 섬 시그니처: 기쁨 점프 + 젤리 스퀴시', [
    { label: '0~730ms', sub: '준비→도약→착지', frames: h.frames.slice(0, 23) },
    { label: '770~1500ms', sub: '두 번째 점프→젤리 출렁', frames: h.frames.slice(23, 46) },
  ], 1, '33ms 간격(30fps). 착지 찌그러짐이 스프링으로 출렁이고(젤리), 모자·망토가 한 박자 늦게 따라옵니다(오버래핑 액션)');
}
if (have(['cheer-a', 'dance-a', 'talk-a', 'think-a', 'sad-a'])) {
  await compose(join(IMG, 'P0-07-states-a.png'), 'SVG 리그 상태별 움직임 (A안, 코스튬 착용)', ['talk-a', 'think-a', 'sad-a', 'cheer-a', 'dance-a'].map((id) => {
    const r = load(id);
    return { label: r.label, frames: r.frames.slice(0, 33) };
  }), 3, '100ms 간격. 말하기는 음절 리듬으로 입이 열리고 닫힘, 생각은 꼬리로 턱 톡톡 + 생각 풍선, 슬픔은 처진 눈꺼풀·눈썹·꼬리 + 눈물');
}
if (have(['happy-b', 'dance-b', 'reduced'])) {
  const hb = load('happy-b');
  const db = load('dance-b');
  const rd = load('reduced');
  await compose(join(IMG, 'P0-07-style-b-reduced.png'), 'B 마법 그림책 & reduced-motion (같은 리그)', [
    { label: '기쁨 (B)', sub: '잉크 떨림 + 12fps 계단식', frames: hb.frames.slice(0, 26) },
    { label: '춤 (B)', sub: '종이 배경', frames: db.frames.slice(0, 26) },
    { label: 'reduced-motion', sub: '움직임 0, 표정+후광 색', frames: rd.frames.slice(0, 46).filter((_, k) => k % 2 === 0) },
  ], 2, 'B는 같은 리그에 SVG 필터(feTurbulence+feDisplacementMap, 8fps로 seed 변경)와 2프레임 계단식 렌더만 바꿨습니다. reduced-motion은 위치·크기 변화 없이 표정과 후광 색만 바뀝니다');
}
writeFileSync(join(RES, 'summary.json'), JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { label: v.label, diffs: v.diffs }]))));
