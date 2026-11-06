// P2-14 사운드 청취 검수 보드 → dist/sound-review.html (claude.ai Artifact로 공유)
// 효과음·배경음악을 앱과 같은 엔진(src/lib/sound/webAudioEngine)으로 재생한다. 소리는 버튼을 눌러야만 난다 (자동재생 없음).
// 오디오는 gen-audio.mjs가 만든 audio.gen.ts의 data(base64)에서 읽는다 (fetch 없음).
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createWebAudioEngine } from '../../../../src/lib/sound/webAudioEngine';
import { attachUnlockListeners } from '../../../../src/lib/sound/platform';
import { normalizeSettings } from '../../../../src/lib/sound/settings';
import type { SoundManifest } from '../../../../src/lib/sound/types';
import { SFX_USES, type SfxId } from '../../../../src/lib/sound/manifest';
import { AUDIO } from './audio.gen';
import { BGM_ITEMS, SFX_ITEMS, WORLD_NAMES, type BgmItem, type SfxItem } from './data';
import './review.css';

// ───────────── 엔진 ─────────────

const keys = Object.keys(AUDIO);
const manifest: SoundManifest = {
  sfx: Object.fromEntries(
    keys
      .filter((k) => k.startsWith('sfx:'))
      .map((k) => [k, { src: [k], gain: k === 'sfx:blip' ? 0.35 : k === 'sfx:wrong' ? 0.8 : k === 'sfx:tap' ? 0.6 : 1, maxVoices: 6 }]),
  ),
  bgm: Object.fromEntries(keys.filter((k) => k.startsWith('bgm:')).map((k) => [k, { src: [k] }])),
};

function bytesOf(key: string): ArrayBuffer {
  const bin = atob(AUDIO[key].b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

const OPUS_OK = typeof document !== 'undefined' && document.createElement('audio').canPlayType('audio/webm; codecs="opus"') !== '';

const engine = createWebAudioEngine(manifest, {
  storage: null,
  // 검수용: 효과음·배경음악 모두 켜고, 앱 기본 볼륨(마스터 0.8 · 효과음 0.7 · 배경음악 0.4)으로 들려줌
  initialSettings: normalizeSettings({ bgm: { enabled: true, volume: 0.4 } }),
  loadBytes: async (k) => bytesOf(k),
  canPlay: () => OPUS_OK,
});
attachUnlockListeners(engine);

function useEngine() {
  return useSyncExternalStore(
    (l) => engine.subscribe(l),
    () => engine.getSnapshot(),
  );
}

// 이음매 듣기: 끝 4초 → 처음 4초를 루프로 (엔진 BGM은 처음부터라 따로 작은 컨텍스트로)
let seamCtx: AudioContext | null = null;
let seamStop: (() => void) | null = null;
async function playSeam(key: string, onEnd: () => void) {
  seamStop?.();
  seamCtx ??= new AudioContext();
  await seamCtx.resume();
  const buf = await seamCtx.decodeAudioData(bytesOf(key));
  const src = seamCtx.createBufferSource();
  const g = seamCtx.createGain();
  g.gain.value = 0.32;
  src.buffer = buf;
  src.loop = true;
  src.connect(g).connect(seamCtx.destination);
  src.start(0, Math.max(0, buf.duration - 4));
  const t = setTimeout(() => stop(), 8000);
  const stop = () => {
    clearTimeout(t);
    try {
      src.stop();
    } catch {
      /* 이미 멈춤 */
    }
    seamStop = null;
    onEnd();
  };
  seamStop = stop;
}

// ───────────── 고른 결과 ─────────────

type Verdict = 'good' | 'change' | null;
interface Choices {
  sfx: Record<string, { v: Verdict; memo: string }>;
  bgm: Record<number, { pick: 'A' | 'B' | 'none' | null; memo: string }>;
}
const STORE = 'pyroad.sound-review.v1';
function loadChoices(): Choices {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) as Choices;
  } catch {
    /* 저장소 없음 */
  }
  return { sfx: {}, bgm: {} };
}

const sec = (s: number) => `${s.toFixed(2)}초`;
const kb = (b: number) => `${(b / 1024).toFixed(1)}KB`;

function summaryText(c: Choices): string {
  const lines = ['[P2-14 소리 검수 결과]', '', '효과음'];
  for (const item of SFX_ITEMS) {
    const ch = c.sfx[item.id];
    const label = ch?.v === 'good' ? '좋아요' : ch?.v === 'change' ? '바꿔 주세요' : '(안 고름)';
    lines.push(`- ${item.id} (${SFX_USES[item.id as SfxId].name}): ${label}${ch?.memo ? ` — ${ch.memo}` : ''}`);
  }
  lines.push('', '배경음악');
  for (const w of [1, 2, 3] as const) {
    const ch = c.bgm[w];
    const cand = (p: 'A' | 'B') => BGM_ITEMS.find((b) => b.world === w && b.pick === p)!;
    const label =
      ch?.pick === 'A' || ch?.pick === 'B'
        ? `${ch.pick} "${cand(ch.pick).title}" (${cand(ch.pick).author})`
        : ch?.pick === 'none'
          ? '둘 다 별로'
          : '(안 고름)';
    lines.push(`- ${w}월드: ${label}${ch?.memo ? ` — ${ch.memo}` : ''}`);
  }
  return lines.join('\n');
}

// ───────────── 화면 ─────────────

function Verdicts({ value, onChange, name }: { value: Verdict; onChange: (v: Verdict) => void; name: string }) {
  return (
    <div className="sr-verdicts" role="group" aria-label={`${name} 평가`}>
      <button type="button" className="sr-chip sr-good" aria-pressed={value === 'good'} onClick={() => onChange(value === 'good' ? null : 'good')}>
        좋아요
      </button>
      <button type="button" className="sr-chip sr-change" aria-pressed={value === 'change'} onClick={() => onChange(value === 'change' ? null : 'change')}>
        바꿔 주세요
      </button>
    </div>
  );
}

function SfxCard({ item, choice, onChoice }: { item: SfxItem; choice?: { v: Verdict; memo: string }; onChoice: (c: { v: Verdict; memo: string }) => void }) {
  const use = SFX_USES[item.id as SfxId];
  const a = AUDIO[item.key];
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const v = choice?.v ?? null;
  return (
    <article className="sr-card" data-verdict={v ?? ''}>
      <header className="sr-card-head">
        <h3>
          {use.name} <code>{item.id}</code>
        </h3>
        <span className="sr-meta">{a ? `${sec(a.dur)} · ${kb(a.bytes)}` : '파일 없음'}</span>
      </header>
      <p className="sr-when">
        <strong>언제:</strong> {use.when}
      </p>
      <div className="sr-actions">
        <button type="button" className="sr-play" disabled={!a} onClick={() => engine.play(item.key)}>
          ▶ 듣기
        </button>
        {item.rate && (
          <button type="button" className="sr-btn" onClick={() => item.rate!.forEach((r, i) => later(i * 180, () => engine.play(item.key, { rate: r })))}>
            뱃지 3개 (도-미-솔)
          </button>
        )}
        {item.id === 'blip' && (
          <button
            type="button"
            className="sr-btn"
            onClick={() => {
              for (let i = 0; i < 16; i++) later(i * 150, () => engine.play(item.key, { rate: 0.94 + Math.random() * 0.14 }));
            }}
          >
            대사처럼 연속 재생
          </button>
        )}
        {item.compare && AUDIO[item.compare.key] && (
          <button type="button" className="sr-btn" onClick={() => engine.play(item.compare!.key)}>
            ▶ {item.compare.label}
          </button>
        )}
      </div>
      {item.note && <p className="sr-note">{item.note}</p>}
      <p className="sr-src">
        출처: {item.source}
        {item.compare && <> · 이전: {item.compare.source}</>}
      </p>
      <Verdicts value={v} name={use.name} onChange={(nv) => onChoice({ v: nv, memo: choice?.memo ?? '' })} />
      {v === 'change' && (
        <label className="sr-memo">
          <span>어떤 느낌이면 좋을까요? (선택)</span>
          <input
            type="text"
            value={choice?.memo ?? ''}
            placeholder="예: 더 짧게, 더 부드럽게, 실로폰 느낌"
            onChange={(e) => onChoice({ v, memo: e.target.value })}
          />
        </label>
      )}
    </article>
  );
}

function BgmCard({ item, chosen, onPick }: { item: BgmItem; chosen: boolean; onPick: () => void }) {
  const snap = useEngine();
  const a = AUDIO[item.key];
  const playing = snap.desiredBgm === item.key;
  const loading = playing && snap.playingBgm !== item.key;
  const [seam, setSeam] = useState(false);
  return (
    <article className="sr-card sr-bgm" data-chosen={chosen}>
      <header className="sr-card-head">
        <h3>
          <span className="sr-pick">{item.pick}</span> {item.title}
        </h3>
        <span className="sr-meta">{a ? `${sec(a.dur)} · 미리 듣기 ${kb(a.bytes)}` : '파일 없음'}</span>
      </header>
      <p className="sr-when">
        <strong>느낌:</strong> {item.mood}
      </p>
      <div className="sr-actions">
        <button
          type="button"
          className="sr-play"
          disabled={!a}
          aria-pressed={playing}
          onClick={() => (playing ? engine.stopBgm({ fadeMs: 400 }) : engine.playBgm(item.key, { fadeMs: 600 }))}
        >
          {playing ? (loading ? '불러오는 중…' : '■ 멈추기') : '▶ 반복 재생'}
        </button>
        <button
          type="button"
          className="sr-btn"
          disabled={!a}
          aria-pressed={seam}
          onClick={() => {
            if (seam) return seamStop?.();
            setSeam(true);
            void playSeam(item.key, () => setSeam(false));
          }}
        >
          {seam ? '■ 이음매 멈추기' : '이음매 듣기 (끝 → 처음)'}
        </button>
      </div>
      <p className="sr-note">{item.note}</p>
      <p className="sr-src">
        {item.author} ·{' '}
        <a href={item.url} target="_blank" rel="noreferrer">
          OpenGameArt
        </a>{' '}
        · CC0 · 2026-11-05 받음
      </p>
      <button type="button" className="sr-chip sr-good sr-pick-btn" aria-pressed={chosen} onClick={onPick}>
        {chosen ? `✓ ${item.pick}로 할래요` : `${item.pick}로 할래요`}
      </button>
    </article>
  );
}

function App() {
  const [choices, setChoices] = useState<Choices>(loadChoices);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'select'>('idle');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const snap = useEngine();
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(choices));
    } catch {
      /* 저장 안 됨 */
    }
  }, [choices]);
  const summary = useMemo(() => summaryText(choices), [choices]);
  const done = SFX_ITEMS.filter((i) => choices.sfx[i.id]?.v).length + [1, 2, 3].filter((w) => choices.bgm[w]?.pick).length;
  const totalKb = Object.values(AUDIO).reduce((n, a) => n + a.bytes, 0) / 1024;

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied('ok');
    } catch {
      textRef.current?.focus();
      textRef.current?.select();
      setCopied('select');
    }
  }

  return (
    <main className="sr-page">
      <header className="sr-hero">
        <p className="sr-kicker">pyRoad · P2-14 사운드</p>
        <h1>소리 검수 보드</h1>
        <p>
          효과음 12종과 월드별 배경음악 후보를 들어 보고 <strong>좋아요 / 바꿔 주세요</strong>를 골라 주세요. 다 고르면 맨 아래 요약을 복사해서
          보내 주시면 됩니다. 소리는 버튼을 눌러야만 나요. 앱과 같은 엔진·같은 기본 볼륨(효과음 56%, 배경음악 32%)으로 재생합니다.
        </p>
        <ul className="sr-tips">
          <li>이어폰보다 노트북·태블릿 스피커로도 한 번 들어 보세요 (아이들이 주로 쓰는 환경).</li>
          <li>iPhone은 무음 스위치가 켜져 있으면 소리가 나지 않아요 (앱도 같은 동작).</li>
          <li>배경음악 미리 듣기는 페이지 크기 때문에 48kbps로 줄였어요. 앱은 96kbps입니다.</li>
          {!OPUS_OK && <li className="sr-warn">이 브라우저는 WebM(Opus)을 재생하지 못해요 (iOS 17.4 이하 Safari). 다른 브라우저로 열어 주세요.</li>}
        </ul>
        <div className="sr-status" role="status">
          엔진: {snap.state === 'idle' ? '아직 꺼짐 (아무 버튼이나 누르면 켜져요)' : snap.state} · 고름 {done}/15 · 오디오 {(totalKb / 1024).toFixed(1)}MB
          <button type="button" className="sr-btn" onClick={() => engine.stopBgm({ fadeMs: 200 })}>
            배경음악 모두 멈추기
          </button>
        </div>
      </header>

      <section aria-labelledby="sfx-title">
        <h2 id="sfx-title">효과음 12종</h2>
        <p className="sr-sub">
          Kenney CC0 팩에서 고른 초안. 앞 무음을 지우고 역할별 크기로 맞췄어요(탭·블립은 작게, 축하 징글은 크게). <code>wrong</code>·<code>bug</code>는
          이전 초안과 비교해 들을 수 있어요.
        </p>
        <div className="sr-grid">
          {SFX_ITEMS.map((item) => (
            <SfxCard
              key={item.id}
              item={item}
              choice={choices.sfx[item.id]}
              onChoice={(c) => setChoices((p) => ({ ...p, sfx: { ...p.sfx, [item.id]: c } }))}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="bgm-title">
        <h2 id="bgm-title">월드별 배경음악 후보</h2>
        <p className="sr-sub">
          모두 OpenGameArt의 CC0(퍼블릭 도메인) 곡이고, -16 LUFS로 맞추고 루프 이음매에 5ms 크로스페이드를 넣었어요. 앱에서 배경음악은 기본으로
          꺼져 있고, 켠 아이에게만 들려요. 월드마다 A·B 중 하나를 골라 주세요.
        </p>
        {([1, 2, 3] as const).map((w) => {
          const ch = choices.bgm[w];
          const set = (pick: 'A' | 'B' | 'none' | null, memo = ch?.memo ?? '') =>
            setChoices((p) => ({ ...p, bgm: { ...p.bgm, [w]: { pick, memo } } }));
          return (
            <div key={w} className="sr-world">
              <h3 className="sr-world-title">{WORLD_NAMES[w]}</h3>
              <div className="sr-grid">
                {BGM_ITEMS.filter((b) => b.world === w).map((item) => (
                  <BgmCard key={item.key} item={item} chosen={ch?.pick === item.pick} onPick={() => set(ch?.pick === item.pick ? null : item.pick)} />
                ))}
              </div>
              <div className="sr-world-foot">
                <button type="button" className="sr-chip sr-change" aria-pressed={ch?.pick === 'none'} onClick={() => set(ch?.pick === 'none' ? null : 'none')}>
                  둘 다 별로예요
                </button>
                <label className="sr-memo">
                  <span>메모 (선택)</span>
                  <input type="text" value={ch?.memo ?? ''} placeholder="예: 더 느긋하게, 피아노 느낌" onChange={(e) => set(ch?.pick ?? null, e.target.value)} />
                </label>
              </div>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="sum-title" className="sr-summary">
        <h2 id="sum-title">요약 (복사해서 보내 주세요)</h2>
        <textarea ref={textRef} readOnly value={summary} rows={Math.min(24, summary.split('\n').length + 1)} aria-label="검수 결과 요약" />
        <div className="sr-actions">
          <button type="button" className="sr-play" onClick={copy}>
            요약 복사
          </button>
          <span role="status" className="sr-copied">
            {copied === 'ok' && '복사했어요!'}
            {copied === 'select' && '복사 권한이 없어 글자를 선택해 두었어요. Ctrl+C(⌘C)로 복사해 주세요.'}
          </span>
          <button type="button" className="sr-btn" onClick={() => setChoices({ sfx: {}, bgm: {} })}>
            처음부터 다시
          </button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
