// 같은 페이지에서 eager(1→4→16… 즉시)/hybrid(첫 전송 40ms 뒤)/batch를 번갈아 5번씩 실행해 중앙값 비교.
//   node test/stream-vs-batch.mjs   (server.mjs가 3106에서 떠 있어야 함)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const pw = await import(process.env.PW_CORE || 'playwright');
const { chromium } = pw.default || pw;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://127.0.0.1:3106/?pyodide=local');
await page.waitForFunction(() => window.__demo?.phase === 'ready', null, { timeout: 180000 });
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const out = {};
for (const id of ['square', 'flower', 'spiral', 'heavy']) {
  const rows = { eager: [], hybrid: [], batch: [] };
  const modes = Object.keys(rows);
  for (let i = 0; i < 15; i++) {
    const mode = modes[i % 3];
    const m = await page.evaluate(async ([id, mode]) => {
      const d = window.__demo;
      d.stream = mode !== 'batch';
      d.firstMs = mode === 'eager' ? 0 : 40;
      await d.loadSample(id);
      const el = document.getElementById('speed');
      el.value = '6';
      el.dispatchEvent(new Event('input'));
      document.getElementById('run').click();
      await new Promise((res) => { const iv = setInterval(() => { if (d.phase === 'idle') { clearInterval(iv); res(); } }, 5); });
      return { ...d.metrics, chars: d.lastResult.turtle.chars, messages: d.lastResult.turtle.messages };
    }, [id, mode]);
    rows[mode].push(m);
  }
  out[id] = {};
  for (const mode of modes) {
    const r = rows[mode];
    out[id][mode] = {
      execMs: med(r.map((x) => x.execMs)), firstMoveChunkMs: med(r.map((x) => x.firstMoveChunkMs)),
      firstInkMs: med(r.map((x) => x.firstInkMs)), resultMs: med(r.map((x) => x.resultMs)), idleMs: med(r.map((x) => x.idleMs)),
      messages: r[0].messages, chars: r[0].chars,
    };
    console.log(id.padEnd(7), mode.padEnd(6), Object.entries(out[id][mode]).map(([k, v]) => `${k} ${Math.round(v)}`).join('  '));
  }
}
fs.mkdirSync(path.join(HERE, 'out'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'out/stream-vs-batch.json'), JSON.stringify(out, null, 2));
await browser.close();
