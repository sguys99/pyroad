// P0-14 스크린샷
//
//   FONTCONFIG_FILE=<scratch>/sysfonts/fonts.conf node screenshot.mjs specimen <outdir>
//     → specimen-{a,b}-{390,1280}.png (원본 PNG, 압축은 shrink.py)
//   FONTCONFIG_FILE=... node screenshot.mjs filmstrip <outdir> [variants=system,a-next,a-subset,b-next] [profile=fast3g]
//     → filmstrip-<variant>-<ms>.png  (히어로 영역, 시간대별 프레임: FOUT 확인용)
//   node screenshot.mjs alignment <outdir>  → 스페시멘의 코드 패널 실측값(JSON)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [mode = 'specimen', outdir = '.', variantsArg, profileArg] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://localhost:3114';
// B안 종이 결(feTurbulence 노이즈)은 PNG로 압축되지 않아(250KB 초과) 스크린샷에서만 끈다. KEEP_NOISE=1이면 유지
const NO_NOISE = "[data-stack='b'] body { background-image: radial-gradient(700px 420px at 92% 4%, rgba(94,143,184,.16) 0%, transparent 60%), radial-gradient(640px 380px at 0% 30%, rgba(124,139,69,.13) 0%, transparent 60%) !important; }";
const quiet = async (page) => { if (process.env.KEEP_NOISE !== '1') await page.addStyleTag({ content: NO_NOISE }); };
fs.mkdirSync(outdir, { recursive: true });
// 설치된 Playwright 브라우저 빌드가 패키지 버전과 다르면 PW_CHROMIUM=<chrome 실행 파일>로 지정
const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), args: ['--font-render-hinting=none'] });

if (mode === 'specimen' || mode === 'alignment') {
  const align = {};
  for (const stack of ['a', 'b']) {
    for (const width of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1, locale: 'ko-KR' });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/specimen-${stack}`, { waitUntil: 'networkidle' });
      await quiet(page);
      await page.waitForFunction(() => document.documentElement.getAttribute('data-measured') === '1', null, { timeout: 60000 });
      await page.waitForTimeout(500);
      align[`${stack}-${width}`] = await page.$$eval('[data-mono]', (els) => els.map((e) => ({ name: e.getAttribute('data-mono'), ratio: +e.getAttribute('data-ratio'), spreadPx: +e.getAttribute('data-spread'), fontSize: getComputedStyle(e.querySelector('pre')).fontSize })));
      // 14/16/18px에서 '가'/'a' 폭 비 (canvas measureText)
      align[`${stack}-${width}-sizes`] = await page.evaluate(async () => {
        await document.fonts.ready;
        const fams = { jbm: getComputedStyle(document.querySelector('[data-mono] pre')).fontFamily, d2: "'D2Coding', monospace" };
        const panels = [...document.querySelectorAll('[data-mono] pre')].map((p) => [p.parentElement.getAttribute('data-mono'), getComputedStyle(p).fontFamily]);
        const c = document.createElement('canvas').getContext('2d');
        const out = {};
        for (const [name, ff] of panels) for (const px of [14, 16, 18]) { c.font = `${px}px ${ff}`; out[`${name} ${px}px`] = { a: c.measureText('a').width, ga: c.measureText('가').width, ratio: +(c.measureText('가').width / c.measureText('a').width).toFixed(4) }; }
        return out;
      });
      if (mode === 'specimen') await page.screenshot({ path: path.join(outdir, `specimen-${stack}-${width}.png`), fullPage: true });
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(outdir, 'alignment.json'), JSON.stringify(align, null, 1));
  console.log(JSON.stringify(align, null, 1));
}

if (mode === 'filmstrip') {
  const variants = (variantsArg ?? 'system,a-next,a-subset,b-next').split(',');
  const prof = profileArg === 'slow4g' ? { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 } : { latency: 562.5, down: ((1.6 * 1024 * 1024) / 8) * 0.9, up: ((750 * 1024) / 8) * 0.9 };
  for (const v of variants) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ko-KR' });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: prof.latency, downloadThroughput: prof.down, uploadThroughput: prof.up });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const frames = [];
    let t0 = 0;
    cdp.on('Page.screencastFrame', async (f) => {
      frames.push({ t: Date.now() - t0, data: f.data });
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 390, maxHeight: 640 });
    t0 = Date.now();
    await page.goto(`${BASE}/${v}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await cdp.send('Page.stopScreencast');
    const dir = path.join(outdir, v);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of frames) fs.writeFileSync(path.join(dir, `${String(f.t).padStart(6, '0')}.png`), Buffer.from(f.data, 'base64'));
    console.log(v, frames.length, 'frames', frames.length ? `${frames[0].t}..${frames[frames.length - 1].t}ms` : '');
    await ctx.close();
  }
}
if (mode === 'mobile') {
  // 390px 화면 두 컷: ① 위쪽(히어로~카드) ② 코드 정렬 섹션. 전체 페이지는 너무 길어 PNG 250KB 안에 담기지 않음
  for (const stack of ['a', 'b']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/specimen-${stack}`, { waitUntil: 'networkidle' });
    await quiet(page);
    await page.waitForFunction(() => document.documentElement.getAttribute('data-measured') === '1', null, { timeout: 60000 });
    await page.waitForTimeout(500);
    const box = await page.locator('section').nth(1).boundingBox();
    await page.screenshot({ path: path.join(outdir, `mobile-${stack}-top.png`), fullPage: true, clip: { x: 0, y: 0, width: 390, height: Math.ceil(box.y + box.height + 12) } });
    await page.locator('section').last().screenshot({ path: path.join(outdir, `mobile-${stack}-code.png`) });
    await ctx.close();
  }
}
await browser.close();
