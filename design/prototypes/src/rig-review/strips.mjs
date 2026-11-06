// 가짜 시계 프레임 스트립 (디자인 리뷰용) → docs/design/img/rig/*.png
//   cd design/prototypes && npm run build -- rig-review && node src/rig-review/strips.mjs [이름...]
// - dist/rig-review.html의 #strip 화면을 띄우고 window.__rigConfig로 캐릭터·스타일·단계를 정한다 (앱과 같은 리그 코드)
// - Playwright 가짜 시계: clock.install → pauseAt → runFor(33ms)씩 진행하며 #cap 요소를 찍는다.
//   주의(P0-07 §3): install()만 하면 호출 사이에도 시간이 흘러 결과가 빨라진다. pauseAt이 꼭 필요하다
// - 조판도 같은 페이지(#strip의 __compose)에서 한다: 인라인 한글 폰트 서브셋을 그대로 쓰려고
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const OUT = join(ROOT, 'docs', 'design', 'img', 'rig');
const require = createRequire(join(ROOT, 'package.json'));
const { chromium } = require('playwright');
const PORT = Number(process.env.PORT ?? 4326);
const STEP = 1000 / 30;
mkdirSync(OUT, { recursive: true });

const cfg = (char, extra = {}) => ({ char, style: 'AB', tier: 'full', reduced: false, size: 170, ...extra });
const PY = ['idle', 'talk', 'think', 'happy', 'sad', 'cheer', 'dance'];
const PY_EXTRA = ['wave', 'surprised', 'teach', 'encourage', 'confused', 'proud', 'sleep'];
const LABEL = {
  pybaem: { idle: '대기', talk: '말하기', think: '생각', happy: '기쁨', sad: '슬픔', cheer: '응원', dance: '춤', wave: '손 흔들기', surprised: '놀람', teach: '설명', encourage: '격려', confused: '갸우뚱', proud: '뿌듯', sleep: '잠' },
  bugbug: { idle: '대기', appear: '등장', search: '탐색', found: '발견', attack: '공격', hit: '피격', defeat: '패배', makeup: '화해' },
  star: { idle: '떠 있기', flyIn: '날아오기', land: '착지', sparkle: '반짝', give: '보상 건네기' },
};
const STYLE = { A: 'A 모험 섬', B: 'B 그림책', AB: 'A×B' };

/** 스트립 하나 = 행 여러 개. 행 = 설정 + 시각별 상태 입력 */
const STRIPS = {
  'pybaem-states': {
    title: '파이뱀 상태별 움직임',
    rows: PY.map((s) => ({ label: LABEL.pybaem[s], sub: 'A×B', config: cfg('pybaem'), events: [[0, s]], dur: 1200 })),
  },
  'pybaem-poses': {
    title: '파이뱀 기존 표정에서 옮긴 포즈',
    rows: PY_EXTRA.map((s) => ({ label: LABEL.pybaem[s], sub: 'A×B', config: cfg('pybaem'), events: [[0, s]], dur: 1000 })),
  },
  'pybaem-interrupt': {
    title: '끊기 전환: 기쁨 → 0.25초 뒤 슬픔',
    rows: ['A', 'B', 'AB'].map((st) => ({
      label: STYLE[st],
      sub: '기쁨 → 슬픔',
      config: cfg('pybaem', { style: st }),
      events: [
        [0, 'happy'],
        [250, 'sad'],
      ],
      dur: 1300,
    })),
  },
  'bugbug-states': {
    title: '버그버그 상태별 움직임',
    rows: ['appear', 'search', 'found', 'attack', 'hit', 'defeat', 'makeup', 'idle'].map((s) => ({
      label: LABEL.bugbug[s],
      sub: 'A×B',
      config: cfg('bugbug'),
      events: [[0, s]],
      dur: s === 'attack' ? 1900 : 1300,
    })),
  },
  'star-states': {
    title: '별똥이 상태별 움직임',
    rows: [
      { s: 'flyIn', dur: 2000, sub: '→ 착지 → 떠 있기' },
      { s: 'give', dur: 1800, sub: '0.75초 코인 팝' },
      { s: 'sparkle', dur: 1300 },
      { s: 'land', dur: 1000 },
      { s: 'idle', dur: 1300 },
    ].map(({ s, dur, sub }) => ({ label: LABEL.star[s], sub: sub ?? 'A×B', config: cfg('star'), events: [[0, s]], dur })),
  },
  reduced: {
    title: '동작 줄이기: 움직임 없이 표정·후광 색만',
    every: 3,
    rows: [
      { char: 'pybaem', seq: ['happy', 'sad', 'think', 'cheer'] },
      { char: 'bugbug', seq: ['found', 'hit', 'defeat', 'makeup'] },
      { char: 'star', seq: ['flyIn', 'give', 'sparkle', 'idle'] },
    ].map(({ char, seq }) => ({
      label: { pybaem: '파이뱀', bugbug: '버그버그', star: '별똥이' }[char],
      sub: seq.map((s) => LABEL[char][s]).join(' → '),
      config: cfg(char, { reduced: true }),
      events: seq.map((s, i) => [i * 500, s]),
      dur: 2000,
    })),
  },
  tiers: {
    title: '연출 단계: full · lite · minimal (기쁨)',
    rows: ['full', 'lite', 'minimal'].map((tier) => ({
      label: tier,
      sub: tier === 'full' ? '60fps · 모든 레이어' : tier === 'lite' ? '30fps · 2차 움직임 끔' : '상태 전환만',
      config: cfg('pybaem', { tier }),
      events: [[0, 'happy']],
      dur: 1300,
    })),
  },
};

async function captureRow(browser, row) {
  const ctx = await browser.newContext({ viewport: { width: 260, height: 260 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await ctx.addInitScript((c) => {
    window.__rigConfig = c;
    try {
      localStorage.setItem('pyroad-proto-chrome-collapsed', '1');
    } catch {}
  }, row.config);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  await page.clock.install({ time: 0 });
  await page.goto(`http://127.0.0.1:${PORT}/rig-review.html#strip`);
  await page.addStyleTag({ content: '[data-proto-chrome]{display:none!important}' });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 500);
  for (let i = 0; i < 200 && !(await page.evaluate(() => !!window.__rig?.ready)); i++) await page.clock.runFor(50);
  await page.clock.runFor(1200);
  const el = await page.$('#cap');
  const events = [...row.events];
  const n = Math.round(row.dur / STEP);
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const t = i * STEP;
    let hl = false;
    while (events.length && events[0][0] <= t + 0.5) {
      const [, s] = events.shift();
      await page.evaluate((st) => window.__rig.setState(st), s);
      hl = true;
    }
    const buf = await el.screenshot();
    frames.push({ src: `data:image/png;base64,${buf.toString('base64')}`, t: Math.round(t), hl });
    await page.clock.runFor(STEP);
  }
  await ctx.close();
  return frames;
}

async function compose(browser, name, strip, rows) {
  const page = await browser.newPage({ viewport: { width: 2600, height: 600 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/rig-review.html#strip`);
  await page.addStyleTag({ content: '[data-proto-chrome]{display:none!important}' });
  await page.waitForFunction(() => typeof window.__compose === 'function');
  const every = strip.every ?? 2;
  const spec = {
    title: strip.title,
    note: `가짜 시계로 33ms씩 진행한 프레임 (${Math.round(STEP * every)}ms 간격 표시) · 주황 테두리 = 입력 순간`,
    rows: rows.map((r) => ({
      label: r.label,
      sub: r.sub,
      // 입력 순간 프레임은 간격과 상관없이 넣는다
      frames: r.frames.filter((f, i) => i % every === 0 || f.hl),
    })),
  };
  await page.evaluate((s) => window.__compose(s), spec);
  await page.waitForSelector('#compose');
  await page.evaluate(() => document.fonts.ready);
  const file = join(OUT, `${name}.png`);
  await (await page.$('#compose')).screenshot({ path: file });
  await page.close();
  console.log(`  ${file}`);
}

const picked = process.argv.slice(2);
const names = picked.length ? picked : Object.keys(STRIPS);
const server = await startServer(PORT);
const browser = await chromium.launch();
try {
  for (const name of names) {
    const strip = STRIPS[name];
    if (!strip) throw new Error(`스트립 없음: ${name}`);
    const rows = [];
    for (const row of strip.rows) rows.push({ ...row, frames: await captureRow(browser, row) });
    await compose(browser, name, strip, rows);
  }
} finally {
  await browser.close();
  server.close();
}
