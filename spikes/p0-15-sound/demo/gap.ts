export {};

/**
 * 코덱별 (1) canPlayType (2) decodeAudioData 결과의 앞뒤 패딩 (3) <audio loop> 실제 재생의 루프 틈 (4) 75초 BGM 디코드 시간·메모리.
 * 테스트 신호: 정확히 4.000초, 440Hz 코사인 (진폭 0.4, t=0에서 최대값) → 앞/뒤 무음 샘플 = 인코더/디코더 패딩.
 */
interface GapResult {
  ua: string;
  sampleRate: number;
  canPlay: Record<string, string>;
  bufferAnalysis: Array<{
    file: string;
    ok: boolean;
    error?: string;
    decodeMs?: number;
    bytes?: number;
    lengthSamples?: number;
    expectedSamples?: number;
    extraSamples?: number;
    leadSilenceMs?: number;
    tailSilenceMs?: number;
    bufferLoopGapMs?: number;
  }>;
  mediaLoop: Array<{ file: string; ok: boolean; error?: string; recordedMs?: number; gaps?: Array<{ atMs: number; ms: number }>; maxGapMs?: number }>;
  sfxDecode: Array<{ file: string; ok: boolean; error?: string; bytes?: number; decodeMs?: number }>;
  bgmDecode: Array<{ file: string; ok: boolean; error?: string; bytes?: number; fetchMs?: number; decodeMs?: number; durationS?: number; decodedMB?: number }>;
  done: boolean;
}

declare global {
  interface Window {
    __gap: GapResult;
    runGap: (opts?: { mediaLoop?: boolean; bgm?: boolean }) => Promise<GapResult>;
  }
}

const MIME: Record<string, string> = {
  wav: 'audio/wav',
  webm: 'audio/webm; codecs="opus"',
  ogg: 'audio/ogg; codecs="opus"',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4; codecs="mp4a.40.2"',
};
const EXTS = ['wav', 'webm', 'ogg', 'mp3', 'm4a'];
const THRESH = 0.05;

const R: GapResult = { ua: navigator.userAgent, sampleRate: 0, canPlay: {}, bufferAnalysis: [], mediaLoop: [], sfxDecode: [], bgmDecode: [], done: false };

// ?probe=1: 페이지 스크립트(제스처 없음)에서 AudioContext를 만들어 자동재생 정책을 확인.
// (Playwright page.evaluate는 Chromium에서 사용자 제스처로 취급되므로 측정에 쓰면 안 된다)
if (new URLSearchParams(location.search).has('probe')) {
  const c = new AudioContext();
  const probe: Record<string, unknown> = { initial: c.state, hasAudioSession: 'audioSession' in navigator, audioSessionType: (navigator as unknown as { audioSession?: { type: string } }).audioSession?.type ?? null };
  const media = new Audio('generated/loop440.mp3');
  void Promise.race([c.resume().then(() => 'resolved'), new Promise((r) => setTimeout(() => r('pending>1s'), 1000))]).then((r) => {
    probe.resumeWithoutGesture = r;
    probe.after = c.state;
    return media.play().then(() => 'played', (e: unknown) => (e instanceof Error ? e.name : String(e)));
  }).then((m) => {
    probe.mediaPlayWithoutGesture = m;
    media.pause();
    void c.close();
    (window as unknown as { __probe: unknown }).__probe = probe;
  });
}
window.__gap = R;
const log = (s: string) => {
  const el = document.getElementById('log');
  if (el) el.textContent += s + '\n';
};

function decode(ctx: BaseAudioContext, ab: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((res, rej) => {
    const p = ctx.decodeAudioData(ab, res, rej) as Promise<AudioBuffer> | undefined;
    p?.then(res, rej);
  });
}

function analyzeBuffer(buf: AudioBuffer) {
  const x = buf.getChannelData(0);
  let first = 0;
  while (first < x.length && Math.abs(x[first]!) < THRESH) first++;
  let last = x.length - 1;
  while (last > 0 && Math.abs(x[last]!) < THRESH) last--;
  // 440Hz 코사인은 반주기(1.14ms)마다 0을 지나므로 THRESH 미만 구간은 정상 신호에서 0.04ms 이하
  const sr = buf.sampleRate;
  const lead = first;
  const tail = x.length - 1 - last;
  return {
    lengthSamples: x.length,
    expectedSamples: Math.round(4 * sr),
    extraSamples: x.length - Math.round(4 * sr),
    leadSilenceMs: (lead / sr) * 1000,
    tailSilenceMs: (tail / sr) * 1000,
    bufferLoopGapMs: ((lead + tail) / sr) * 1000,
  };
}

const RECORDER = `
class Rec extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor('rec', Rec);
`;

async function recordMediaLoop(ctx: AudioContext, url: string, ms: number) {
  const el = new Audio();
  el.src = url;
  el.loop = true;
  el.preload = 'auto';
  const node = ctx.createMediaElementSource(el);
  const rec = new AudioWorkletNode(ctx, 'rec');
  const sink = ctx.createGain();
  sink.gain.value = 0; // 들리지 않게 (그래프가 계속 돌도록 destination에는 연결)
  node.connect(rec);
  rec.connect(sink).connect(ctx.destination);
  const chunks: Float32Array[] = [];
  rec.port.onmessage = (e: MessageEvent<Float32Array>) => chunks.push(e.data);
  await el.play();
  await new Promise((r) => setTimeout(r, ms));
  el.pause();
  rec.port.onmessage = null;
  node.disconnect();
  rec.disconnect();
  el.removeAttribute('src');
  el.load();
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const x = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    x.set(c, o);
    o += c.length;
  }
  // 재생 시작 전 무음과 정지 후 무음은 제외
  let s = 0;
  while (s < x.length && Math.abs(x[s]!) < THRESH) s++;
  let e = x.length - 1;
  while (e > s && Math.abs(x[e]!) < THRESH) e--;
  const sr = ctx.sampleRate;
  const minRun = Math.round(sr * 0.001); // 1ms 이상 이어지는 무음만 틈으로 본다
  const gaps: Array<{ atMs: number; ms: number }> = [];
  let run = 0;
  for (let i = s; i <= e; i++) {
    if (Math.abs(x[i]!) < THRESH) run++;
    else {
      if (run >= minRun) gaps.push({ atMs: ((i - run - s) / sr) * 1000, ms: (run / sr) * 1000 });
      run = 0;
    }
  }
  return { recordedMs: ((e - s) / sr) * 1000, gaps, maxGapMs: gaps.reduce((m, g) => Math.max(m, g.ms), 0) };
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout ' + label)), ms))]);
}

window.runGap = async (opts = {}) => {
  const ctx = new AudioContext();
  await withTimeout(ctx.resume(), 3000, 'resume');
  R.sampleRate = ctx.sampleRate;
  const probe = document.createElement('audio');
  for (const ext of EXTS) R.canPlay[ext] = probe.canPlayType(MIME[ext]!) || 'no';
  log('canPlay ' + JSON.stringify(R.canPlay));

  for (const ext of EXTS) {
    const file = `generated/loop440.${ext}`;
    try {
      const ab = await (await fetch(file)).arrayBuffer();
      const bytes = ab.byteLength;
      const t = performance.now();
      const buf = await withTimeout(decode(ctx, ab), 5000, 'decode');
      R.bufferAnalysis.push({ file, ok: true, decodeMs: performance.now() - t, bytes, ...analyzeBuffer(buf) });
    } catch (e) {
      R.bufferAnalysis.push({ file, ok: false, error: String(e) });
    }
    log(JSON.stringify(R.bufferAnalysis.at(-1)));
  }

  if (opts.mediaLoop !== false) {
    try {
      const url = URL.createObjectURL(new Blob([RECORDER], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      for (const ext of EXTS) {
        const file = `generated/loop440.${ext}`;
        if (R.canPlay[ext] === 'no') {
          R.mediaLoop.push({ file, ok: false, error: 'canPlayType=no' });
          continue;
        }
        try {
          R.mediaLoop.push({ file, ok: true, ...(await withTimeout(recordMediaLoop(ctx, file, 9000), 15000, 'record')) });
        } catch (e) {
          R.mediaLoop.push({ file, ok: false, error: String(e) });
        }
        log(JSON.stringify(R.mediaLoop.at(-1)));
      }
    } catch (e) {
      R.mediaLoop.push({ file: '*', ok: false, error: 'audioWorklet: ' + String(e) });
    }
  }

  // 효과음 12종 순차 디코드 (동시 디코드의 대기 시간을 빼고 파일당 비용만)
  for (const ext of ['webm', 'mp3']) {
    for (const id of ['tap', 'blip', 'correct', 'wrong', 'coin', 'star', 'run', 'bug', 'unlock', 'chest', 'levelup', 'celebrate']) {
      const file = `sounds/${id}.${ext}`;
      try {
        const ab = await (await fetch(file)).arrayBuffer();
        const bytes = ab.byteLength;
        const t = performance.now();
        await withTimeout(decode(ctx, ab), 5000, 'decode');
        R.sfxDecode.push({ file, ok: true, bytes, decodeMs: performance.now() - t });
      } catch (e) {
        R.sfxDecode.push({ file, ok: false, error: String(e) });
      }
    }
  }
  log('sfxDecode ' + JSON.stringify(R.sfxDecode.map((d) => [d.file, d.ok ? d.decodeMs?.toFixed(1) : d.error])));

  if (opts.bgm !== false) {
    for (const ext of ['webm', 'mp3', 'm4a']) {
      const file = `generated/bgm-world1.${ext}`;
      try {
        const tf = performance.now();
        const ab = await (await fetch(file)).arrayBuffer();
        const fetchMs = performance.now() - tf;
        const bytes = ab.byteLength;
        const t = performance.now();
        const buf = await withTimeout(decode(ctx, ab), 20000, 'decode');
        R.bgmDecode.push({
          file,
          ok: true,
          bytes,
          fetchMs,
          decodeMs: performance.now() - t,
          durationS: buf.duration,
          decodedMB: (buf.length * buf.numberOfChannels * 4) / 1e6,
        });
      } catch (e) {
        R.bgmDecode.push({ file, ok: false, error: String(e) });
      }
      log(JSON.stringify(R.bgmDecode.at(-1)));
    }
  }
  R.done = true;
  await ctx.close();
  return R;
};

document.getElementById('run')?.addEventListener('click', () => void window.runGap());
