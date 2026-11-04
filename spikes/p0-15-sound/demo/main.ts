import { installInstrumentation, markGesture } from './instrument';
import { createWebAudioEngine } from '../src/sound/webAudioEngine';
import { createHowlerEngine } from '../src/sound/howlerEngine';
import { attachUnlockListeners, getAudioSessionType } from '../src/sound/platform';
import { createLocalSettingsStorage } from '../src/sound/settings';
import { STARTER_MANIFEST, STAR_RATES, type BgmId, type SfxId } from '../src/manifest';
import type { SoundEngine } from '../src/sound/types';

/**
 * ?engine=webaudio (기본) | howler (첫 제스처에 Howl 생성) | howler-eager (use-sound처럼 로드 즉시 Howl 생성)
 * &howlerAutoSuspend=0 → Howler.autoSuspend=false
 */
const params = new URLSearchParams(location.search);
const mode = params.get('engine') ?? 'webaudio';
const P = installInstrumentation(mode);
const t0 = performance.now();

const storage = createLocalSettingsStorage('p015:sound:' + mode);
const onMetric = (m: unknown) => P.metrics.push(m);
const engine: SoundEngine<SfxId, BgmId> & { debug(): Record<string, unknown> } =
  mode === 'webaudio'
    ? createWebAudioEngine(STARTER_MANIFEST, { storage, onMetric, predecode: params.get('predecode') !== '0' })
    : createHowlerEngine(STARTER_MANIFEST, {
        storage,
        onMetric,
        eager: mode === 'howler-eager',
        autoSuspend: params.get('howlerAutoSuspend') !== '0',
      });
P.notes.push(`engine constructed in ${(performance.now() - t0).toFixed(2)} ms`);
P.notes.push(`audioSession before unlock: ${getAudioSessionType() ?? 'n/a'}`);
(window as unknown as { __engine: typeof engine }).__engine = engine;

attachUnlockListeners(engine);
engine.prefetch();

// ───── UI ─────
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const sfxGrid = $('#sfx');
const LABELS: Record<SfxId, string> = {
  tap: '탭', correct: '정답', wrong: '오답', coin: '코인', star: '별', levelup: '레벨업',
  unlock: '스테이지 해제', chest: '보물상자', run: '실행', bug: '버그버그', blip: '대사 블립', celebrate: '축하',
};
for (const id of Object.keys(STARTER_MANIFEST.sfx) as SfxId[]) {
  const b = document.createElement('button');
  b.textContent = LABELS[id];
  b.dataset.sfx = id;
  sfxGrid.append(b);
}
// 효과음은 pointerdown에서 재생 (이미 잠금 해제된 뒤라면 터치에서도 바로 재생 가능 → 체감 지연 최소)
sfxGrid.addEventListener('pointerdown', (e) => {
  const id = (e.target as HTMLElement).dataset.sfx as SfxId | undefined;
  if (!id) return;
  markGesture(e, id);
  engine.play(id);
});

$('#stars').addEventListener('pointerdown', (e) => {
  markGesture(e, 'star3');
  STAR_RATES.forEach((rate, i) => setTimeout(() => engine.play('star', { rate }), i * 220));
});
$('#coins').addEventListener('pointerdown', (e) => {
  markGesture(e, 'coin-burst');
  for (let i = 0; i < 10; i++) setTimeout(() => engine.play('coin', { rate: 1 + i * 0.03 }), i * 30);
});
for (const id of ['world1', 'world2', 'world3'] as BgmId[]) {
  $('#bgm-' + id).addEventListener('click', () => engine.playBgm(id, { fadeMs: 800 }));
}
$('#bgm-stop').addEventListener('click', () => engine.stopBgm({ fadeMs: 800 }));
const bgmOn = $<HTMLInputElement>('#bgm-on');
const mute = $<HTMLInputElement>('#mute');
const sfxVol = $<HTMLInputElement>('#sfx-vol');
const bgmVol = $<HTMLInputElement>('#bgm-vol');
bgmOn.addEventListener('change', () => engine.setSettings({ bgm: { enabled: bgmOn.checked } }));
mute.addEventListener('change', () => engine.setSettings({ muted: mute.checked }));
sfxVol.addEventListener('input', () => engine.setSettings({ sfx: { volume: Number(sfxVol.value) } }));
bgmVol.addEventListener('input', () => engine.setSettings({ bgm: { volume: Number(bgmVol.value) } }));

const out = $('#out');
function render() {
  const s = engine.getSnapshot();
  bgmOn.checked = s.settings.bgm.enabled;
  mute.checked = s.settings.muted;
  sfxVol.value = String(s.settings.sfx.volume);
  bgmVol.value = String(s.settings.bgm.volume);
  $('#state').textContent = `${engine.kind} · ${s.state} · bgm ${s.playingBgm ?? '-'} (원함: ${s.desiredBgm ?? '-'}) · audioSession ${getAudioSessionType() ?? 'n/a'}`;
}
engine.subscribe(render);
render();
setInterval(() => {
  const lat = P.starts
    .filter((s) => s.gestureTs !== null)
    .slice(-8)
    .map((s) => `${s.gestureId}: ${(s.t - (s.gestureTs ?? 0)).toFixed(1)}ms`);
  out.textContent = JSON.stringify(
    { debug: engine.debug(), ctxCreated: P.ctxCreated, states: P.states.slice(-5), decodes: P.decodes.length, lastLatency: lat },
    null,
    1,
  );
}, 500);

// ?blessTest=<ms>: 첫 잠금 해제 후 <ms> 뒤 (제스처 밖, 페이지 타이머)에서 BGM 슬롯 재생 vs 새 <audio> 재생을 비교
const blessMs = Number(params.get('blessTest') ?? 0);
if (blessMs > 0) {
  const off = engine.subscribe(() => {
    if (engine.getSnapshot().state !== 'running') return;
    off();
    setTimeout(() => {
      const r: Record<string, string> = { fresh: 'pending' };
      (window as unknown as { __bless: typeof r }).__bless = r;
      const a = new Audio('generated/bgm-world2.mp3');
      a.play().then(() => { r.fresh = 'played'; a.pause(); }, (e: unknown) => (r.fresh = e instanceof Error ? e.name : String(e)));
      engine.setSettings({ bgm: { enabled: true } });
      engine.playBgm('world1', { fadeMs: 300 });
    }, blessMs);
  });
}
