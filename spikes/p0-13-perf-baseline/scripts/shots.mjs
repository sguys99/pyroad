// P0-13 "개편 전" 스크린샷 (모바일 390×844 · 태블릿 820×1180, DPR 2)
//   P013_WORK=<작업> FONTCONFIG_FILE=<작업>/sysfonts/fonts.conf node scripts/shots.mjs
// 원본 PNG 는 <작업>/shots/ 에 저장하고, images.py 가 docs/spikes/img/P0-13-*.png 로 합쳐 줄인다.
import fs from 'node:fs';
import path from 'node:path';
import { APP, QUEST, STAGE1_LAST_ANSWER, WORK, ensureUser, resetCeleb } from './lib.mjs';
import { launch, newContext, setCode, waitRunEnabled } from './runtime.mjs';

const OUT = path.join(WORK, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });
const settle = (page, ms = 1500) => page.waitForTimeout(ms);

try {
  for (const dev of ['mobile', 'tablet']) {
    // 랜딩 (비로그인)
    let ctx = await newContext(browser, dev, null);
    let page = await ctx.newPage();
    await page.goto(APP + '/', { waitUntil: 'networkidle' });
    await settle(page, 2500);
    await shot(page, `${dev}-landing`);
    await shot(page, `${dev}-landing-full`, { fullPage: true });
    await ctx.close();

    // 월드맵·프로필 (perf: 1·2스테이지 완료)
    ctx = await newContext(browser, dev, 'perf');
    page = await ctx.newPage();
    await page.goto(APP + '/world', { waitUntil: 'networkidle' });
    await settle(page, 2500);
    await shot(page, `${dev}-world`);
    await shot(page, `${dev}-world-full`, { fullPage: true });
    await page.goto(APP + '/profile', { waitUntil: 'networkidle' });
    await settle(page, 2000);
    await shot(page, `${dev}-profile`);
    await ctx.close();

    // 첫 퀘스트 (newbie, Pyodide 준비 후)
    ctx = await newContext(browser, dev, 'newbie');
    page = await ctx.newPage();
    await page.goto(APP + `/quest/${QUEST.first}`, { waitUntil: 'commit' });
    await waitRunEnabled(page);
    await settle(page, 2000);
    await shot(page, `${dev}-quest`);
    if (dev === 'mobile') {
      await page.getByRole('button', { name: '코드', exact: true }).click();
      await settle(page, 800);
      await shot(page, `${dev}-quest-code`);
    }
    await ctx.close();

    // 축하 오버레이 (celeb: 1스테이지 마지막 퀘스트 정답 → 스테이지 클리어)
    resetCeleb(await ensureUser('celeb'));
    ctx = await newContext(browser, dev, 'celeb');
    page = await ctx.newPage();
    await page.goto(APP + `/quest/${QUEST.stage1Last}`, { waitUntil: 'commit' });
    await waitRunEnabled(page);
    if (dev === 'mobile') {
      await page.getByRole('button', { name: '코드', exact: true }).click();
      await settle(page, 500);
    }
    await setCode(page, STAGE1_LAST_ANSWER);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('코드 돌려보기')).click());
    await page.waitForFunction(() => document.body.textContent.includes('다음 모험으로'), null, { timeout: 30000 });
    await settle(page, 1800);
    await shot(page, `${dev}-celebration`);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('다음 모험으로'))?.click());
    await settle(page, 1200);
    await shot(page, `${dev}-levelup`);
    await ctx.close();
    resetCeleb(await ensureUser('celeb'));
    console.log(`[shots] ${dev} done`);
  }
} finally {
  await browser.close();
}
