// 보고서용 스크린샷: 대화창 스타일 입력 박스 (P11-01 UX 시안)
// 사용: node tests/screenshots.mjs  (서버 실행 중, Chromium)
import { chromium } from 'playwright';

const OUT = new URL('../../../docs/spikes/img/', import.meta.url);
const browser = await chromium.launch();
for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 860 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: name === 'mobile' ? 2 : 1 });
  await page.goto('http://localhost:3105/m/plain/web/index.html?opt=jspi');
  await page.waitForFunction(() => spike.log.some((e) => e.type === 'ready'), null, { timeout: 300_000 });
  await page.selectOption('#program', 'adventure');
  await page.click('#run');
  for (const answer of ['파이', '1']) {
    await page.waitForSelector('#inputForm:not([hidden])');
    await page.fill('#answer', answer);
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('#inputForm:not([hidden])');
  await page.fill('#answer', '1');
  if (name === 'mobile') await page.locator('.console').scrollIntoViewIfNeeded();
  await page.screenshot({ path: new URL(`P0-05-input-${name}.png`, OUT).pathname, fullPage: name === 'desktop' });
  await page.close();
}
await browser.close();
