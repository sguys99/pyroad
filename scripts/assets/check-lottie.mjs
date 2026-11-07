// 일회성 Lottie 이펙트 검사 (P2-16, B32 재발 방지). 대상: public/animations/<id>.v<N>.json
//
//   npm run assets:lottie                       # 구조 검사 + 실제 렌더 검사 (Playwright Chromium + lottie_light)
//   node scripts/assets/check-lottie.mjs a.json  # 파일을 직접 지정 (받아 온 에셋을 넣기 전에)
//   ... --no-render                              # 구조 검사만 (브라우저 없이)
//
// 렌더 검사: lottie-web의 `lottie_light`(앱이 쓸 빌드)로 안쪽 프레임 6개를 그려 마젠타 바탕에서 칠해진 픽셀을 센다.
// 빈 화면이면 실패 (B32: 구조는 그럴듯했지만 lottie-web이 아무것도 안 그림). 매번 검사기 자체 시험(정상 1개는 그려지고
// B32 파일은 비어야 함)을 먼저 돌려, 검사기가 망가져 아무거나 통과시키는 일을 막는다.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { inspectLottie, judgeRender, sampleFrames } from './lib/lottie.mjs';
import {
  ROOT,
  VERSIONED_NAME,
  isMain,
  kb,
  listFiles,
  rel,
} from './lib/fsutil.mjs';

export const ANIMATION_DIR = join(ROOT, 'public/animations');
const FIXTURES = join(ROOT, 'scripts/assets/__tests__/fixtures');
const RENDER_BOX = 256;
/** 바탕색 (마젠타: 흰색·검은색 그림을 모두 잡고 그림책 색과 겹치지 않음) */
const BG = [255, 0, 255];

function lottieLightPath() {
  try {
    return createRequire(join(ROOT, 'package.json')).resolve(
      'lottie-web/build/player/lottie_light.min.js',
    );
  } catch {
    throw new Error(
      'lottie-web을 찾지 못했어요. 지금은 lottie-react의 의존성으로 설치돼요. lottie-react를 지우면 lottie-web을 직접 추가하세요',
    );
  }
}

/** 페이지 안에서: 스크린숏 PNG를 캔버스에 그려 바탕색과 다른 픽셀 비율과 간단한 해시를 잰다 */
async function measureInPage({ b64, bg }) {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  let ink = 0;
  let hash = 0;
  for (let i = 0; i < px.length; i += 4) {
    const diff =
      Math.abs(px[i] - bg[0]) +
      Math.abs(px[i + 1] - bg[1]) +
      Math.abs(px[i + 2] - bg[2]);
    if (diff > 48) ink++;
    hash = (Math.imul(hash, 31) + px[i] + px[i + 1] * 7 + px[i + 2] * 13) | 0;
  }
  return { ratio: ink / (px.length / 4), hash };
}

/**
 * lottie_light로 몇 프레임 그려 본다.
 * @returns {Promise<{ frames: {frame:number, ratio:number, hash:number}[], pageErrors: string[] }>}
 */
export async function renderFrames(browser, data) {
  const scale = RENDER_BOX / Math.max(data.w, data.h);
  const w = Math.max(1, Math.round(data.w * scale));
  const h = Math.max(1, Math.round(data.h * scale));
  const page = await browser.newPage({
    viewport: { width: w + 16, height: h + 16 },
    deviceScaleFactor: 1,
  });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
  try {
    await page.setContent(
      `<!doctype html><html><body style="margin:8px;background:rgb(${BG})"><div id="c" style="width:${w}px;height:${h}px"></div></body></html>`,
    );
    await page.addScriptTag({ path: lottieLightPath() });
    await page.evaluate(async (animationData) => {
      const anim = window.lottie.loadAnimation({
        container: document.getElementById('c'),
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData,
      });
      window.__anim = anim;
      if (!anim.isLoaded) {
        await new Promise((resolve) => {
          anim.addEventListener('DOMLoaded', resolve);
          anim.addEventListener('data_failed', resolve);
          setTimeout(resolve, 3000);
        });
      }
    }, data);
    const frames = [];
    for (const frame of sampleFrames(data.ip, data.op)) {
      await page.evaluate((f) => window.__anim.goToAndStop(f, true), frame);
      const png = await page.locator('#c').screenshot();
      const m = await page.evaluate(measureInPage, {
        b64: png.toString('base64'),
        bg: BG,
      });
      frames.push({ frame, ...m });
    }
    return { frames, pageErrors };
  } finally {
    await page.close();
  }
}

async function launch() {
  const { chromium } = await import('@playwright/test');
  try {
    return await chromium.launch();
  } catch (e) {
    throw new Error(
      `Chromium을 띄우지 못했어요 (npx playwright install chromium). ${String(e.message).split('\n')[0]}`,
    );
  }
}

/** 검사기 자체 시험: 정상 파일은 그려지고 B32 파일은 비어야 한다 */
async function selfTest(browser) {
  const good = JSON.parse(
    readFileSync(join(FIXTURES, 'valid-pop.json'), 'utf8'),
  );
  const bad = JSON.parse(
    readFileSync(join(FIXTURES, 'b32/entrance.json'), 'utf8'),
  );
  const g = judgeRender((await renderFrames(browser, good)).frames);
  const b = judgeRender((await renderFrames(browser, bad)).frames);
  if (g.blank || !b.blank) {
    throw new Error(
      `렌더 검사기 자체 시험 실패: 정상 파일 빈 화면=${g.blank}, B32 파일 빈 화면=${b.blank} (lottie-web·Chromium 버전 확인)`,
    );
  }
  console.log(
    `  ✓ 검사기 자체 시험 (정상: 최대 ${(g.max * 100).toFixed(1)}% 칠함, B32: 빈 화면)`,
  );
}

/**
 * @param {{ files?: string[], render?: boolean, requireVersioned?: boolean }} opts
 * @returns {Promise<boolean>} 통과 여부
 */
export async function runLottie({
  files = listFiles(ANIMATION_DIR, (p) => p.endsWith('.json')),
  render = true,
  requireVersioned = true,
} = {}) {
  let ok = true;
  const fail = (file, msg) => {
    ok = false;
    console.error(`  ✗ ${rel(file)}: ${msg}`);
  };
  const parsed = [];
  for (const file of files) {
    const buf = readFileSync(file);
    let data;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch (e) {
      fail(file, `JSON이 아니에요 (${e.message})`);
      continue;
    }
    if (requireVersioned && !VERSIONED_NAME.test(basename(file))) {
      fail(file, '파일 이름은 <id>.v<N>.json (immutable 캐시)');
    }
    const { errors, warnings, stats } = inspectLottie(data, {
      bytes: buf.length,
    });
    // 레이어마다 같은 오류가 반복되므로 8개까지만 보여 준다
    errors.slice(0, 8).forEach((m) => fail(file, m));
    if (errors.length > 8) fail(file, `… 외 ${errors.length - 8}개`);
    warnings.forEach((m) => console.warn(`  ! ${rel(file)}: ${m}`));
    if (!errors.length) {
      console.log(
        `  ✓ ${rel(file)} 구조 (${stats.w}×${stats.h}, ${stats.seconds.toFixed(2)}초, 레이어 ${stats.layers}, ${kb(buf.length)} · gzip ${kb(gzipSync(buf).length)})`,
      );
    }
    parsed.push({ file, data, structural: !errors.length });
  }
  if (!render) return ok;
  // 파일이 없어도 자체 시험은 돈다: lottie-web·Chromium을 올렸을 때 검사기가 여전히 빈 화면을 잡는지
  const browser = await launch();
  try {
    await selfTest(browser);
    if (files.length === 0)
      console.log('  (public/animations에 Lottie 파일 없음)');
    for (const { file, data } of parsed) {
      // 구조가 틀린 파일도 그려 본다 (결과를 함께 보여 주려고)
      if (!Number.isFinite(data?.w) || !Array.isArray(data?.layers)) continue;
      const { frames, pageErrors } = await renderFrames(browser, data);
      const j = judgeRender(frames);
      pageErrors.forEach((m) => fail(file, `렌더 중 오류: ${m}`));
      if (j.blank) {
        fail(
          file,
          `lottie_light에서 빈 화면 (칠한 프레임 ${j.painted}/${frames.length}, 최대 ${(j.max * 100).toFixed(2)}%, B32)`,
        );
      } else {
        console.log(
          `  ✓ ${rel(file)} 렌더 (칠한 프레임 ${j.painted}/${frames.length}, 최대 ${(j.max * 100).toFixed(1)}%)`,
        );
        if (j.still)
          console.warn(
            `  ! ${rel(file)}: 프레임이 모두 같아요 (움직이지 않음)`,
          );
      }
    }
  } finally {
    await browser.close();
  }
  return ok;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  console.log('Lottie 검사 (lottie_light)');
  runLottie({
    render: !args.includes('--no-render'),
    ...(files.length
      ? { files: files.map((f) => resolve(f)), requireVersioned: false }
      : {}),
  })
    .then((ok) => {
      if (!ok) process.exit(1);
    })
    .catch((err) => {
      console.error(`  ✗ ${err.message}`);
      process.exit(1);
    });
}
