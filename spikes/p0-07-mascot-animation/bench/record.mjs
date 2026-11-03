// 리그 파라미터를 30fps로 기록 (가짜 시계로 결정적). Lottie 굽기 입력
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch, BASE } from './pw.mjs';
const OUT = new URL('../assets/generated/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const STATES = ['idle', 'talk', 'think', 'happy', 'sad', 'cheer', 'dance'];
const FPS = 30;
const SECS = { idle: 3.2, talk: 2, think: 2, happy: 2, sad: 2.2, cheer: 2.12, dance: 2 };
const b = await launch();
const p = await b.newPage();
await p.clock.install({ time: 0 });
await p.goto(BASE + '/capture.html?look=0&props=0&seed=3');
// install()만 하면 호출 사이에도 시간이 흐른다 → 멈춰 두고 runFor로만 진행
await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 500);
await p.clock.runFor(300);
const segments = [];
for (const st of STATES) {
  await p.evaluate(() => window.__cap.setState('idle'));
  await p.clock.runFor(1500);
  await p.evaluate((s) => window.__cap.setState(s), st);
  await p.clock.runFor(st === 'happy' ? 0 : 700); // 기쁨은 점프 2번 전체를 담는다
  const frames = [];
  const n = Math.round(SECS[st] * FPS);
  for (let i = 0; i < n; i++) {
    frames.push(await p.evaluate(() => window.__cap.snapshot()));
    await p.clock.runFor(1000 / FPS);
  }
  segments.push({ name: st, frames });
}
writeFileSync(OUT + 'rig-frames.json', JSON.stringify({ fps: FPS, segments }));
console.log('recorded', segments.map((s) => `${s.name}:${s.frames.length}`).join(' '));
await b.close();
