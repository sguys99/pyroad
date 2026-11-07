// P2-13 마스코트 리그 리뷰 페이지 → dist/rig-review.html
// 앱의 src/components/characters/rig/를 상대 경로로 import해 "같은 코드"로 그린다 (복사 금지).
// - 화면: #pybaem · #bugbug · #star (캐릭터별 상태·끊기·따라보기·모션 느낌 슬라이더) · #poses (정지 그림 표)
// - #strip: 프레임 스트립 캡처용 (strips.mjs가 window.__rigConfig로 설정하고 가짜 시계로 찍는다)
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mountPrototype } from '../shared/app';
import { setMotion, useMotion } from '../shared/motion';
import { RigView, type RigHandle } from '../../../../src/components/characters/rig/LiveRig';
import type { RigEngine } from '../../../../src/components/characters/rig/core/engine';
import { activeCount } from '../../../../src/components/characters/rig/core/ticker';
import {
  BUGBUG,
  BYEOLTTONGI,
  DEFAULT_RIG_STYLE,
  DEFAULT_TUNING,
  PYBAEM,
  PYBAEM_CORE_STATES,
  RIG_STYLES,
  RigStatic,
  STYLE_LABEL,
  STYLE_RULES,
  type Costume,
  type RigDef,
  type RigStyle,
  type RigTuning,
} from '../../../../src/components/characters/rig';
import { SPRINGS, sampleSpring } from '../../../../src/lib/motion/tokens';
import './rig-review.css';

type CharId = 'pybaem' | 'bugbug' | 'star';
type AnyDef = RigDef<string, unknown>;

interface CharInfo {
  def: AnyDef;
  title: string;
  role: string;
  groups: { label: string; states: readonly string[] }[];
  interrupt: { label: string; note: string; seq: [string, number][] };
  talk?: boolean;
}

const PY_EXTRA = PYBAEM.states.filter((s) => !PYBAEM_CORE_STATES.includes(s));

const CHARS: Record<CharId, CharInfo> = {
  pybaem: {
    def: PYBAEM as unknown as AnyDef,
    title: '파이뱀 선생님',
    role: '튜터. 꼬리가 손 역할을 해요 (턱 톡톡, 번쩍, 흔들기, 가리키기). 정답이면 점프 2번 + 젤리.',
    groups: [
      { label: '핵심 7종', states: PYBAEM_CORE_STATES },
      { label: '기존 표정 10종에서 옮긴 포즈', states: PY_EXTRA },
    ],
    interrupt: {
      label: '점프 중 슬픔',
      note: '기쁨 → 0.25초 뒤 슬픔. 얼굴은 바로 슬퍼지고, 몸은 점프를 마친 뒤 털썩 착지해야 해요.',
      seq: [
        ['happy', 0],
        ['sad', 250],
      ],
    },
    talk: true,
  },
  bugbug: {
    def: BUGBUG as unknown as AnyDef,
    title: '버그버그',
    role: '에러·보스 담당 장난꾸러기 라이벌 겸 친구. 무섭지 않게: 큰 눈·볼터치는 늘, 공격도 씩 웃으며.',
    groups: [{ label: '상태 8종', states: BUGBUG.states }],
    interrupt: {
      label: '깜짝 점프 중 맞기',
      note: '발견(깜짝 점프) → 0.2초 뒤 피격. 공중에서 맞아도 끊김 없이 흔들리며 착지해요.',
      seq: [
        ['found', 0],
        ['hit', 200],
      ],
    },
  },
  star: {
    def: BYEOLTTONGI as unknown as AnyDef,
    title: '별똥이',
    role: '보상 안내 요정. 하늘에서 휙 날아와 코인을 건네요. 별의 양옆 끝이 팔이에요.',
    groups: [{ label: '상태 5종', states: BYEOLTTONGI.states }],
    interrupt: {
      label: '날아오다 보상 건네기',
      note: '날아오기 → 0.45초 뒤 보상 건네기. 비행은 끝까지 이어지고, 코인은 도착하면서 올라가요.',
      seq: [
        ['flyIn', 0],
        ['give', 450],
      ],
    },
  },
};

const SCREENS = [
  { id: 'pybaem', label: '파이뱀' },
  { id: 'bugbug', label: '버그버그' },
  { id: 'star', label: '별똥이' },
  { id: 'poses', label: '정지 그림' },
  { id: 'strip', label: '스트립(캡처용)' },
  { id: 'bench', label: '성능(측정용)' },
] as const;
type Screen = (typeof SCREENS)[number]['id'];

// ───────────── 모션 느낌 리뷰 값 (기기에 기억)

const TUNING_KEY = 'pyroad-rig-review-tuning';
function loadTuning(): RigTuning {
  try {
    const v = JSON.parse(localStorage.getItem(TUNING_KEY) ?? 'null');
    if (v && typeof v === 'object') return { ...DEFAULT_TUNING, ...v };
  } catch {
    /* 무시 */
  }
  return { ...DEFAULT_TUNING };
}
function saveTuning(t: RigTuning) {
  try {
    localStorage.setItem(TUNING_KEY, JSON.stringify(t));
  } catch {
    /* 무시 */
  }
}

const JELLY_DEFAULT_ZETA: Record<RigStyle, number> = Object.fromEntries(
  RIG_STYLES.map((s) => {
    const sp = SPRINGS[STYLE_RULES[s].jelly];
    return [s, sp.c / (2 * Math.sqrt(sp.k))];
  }),
) as Record<RigStyle, number>;

function jellySettle(style: RigStyle, zeta: number | null) {
  const sp = SPRINGS[STYLE_RULES[style].jelly];
  const c = zeta === null ? sp.c : 2 * zeta * Math.sqrt(sp.k);
  return { k: sp.k, c, ms: sampleSpring({ k: sp.k, c }).durationMs };
}

const f2 = (v: number) => (Math.round(v * 100) / 100).toString();

// ───────────── 공용 UI

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="rr-seg" role="group" aria-label={label}>
      <span className="rr-seg-label">{label}</span>
      <div className="rr-seg-row">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="rr-chip"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  display,
  isDefault,
  onReset,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: ReactNode;
  isDefault: boolean;
  onReset: () => void;
}) {
  const id = `rr-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="rr-slider">
      <div className="rr-slider-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className={isDefault ? '' : 'rr-changed'}>
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="rr-slider-bottom">
        <small>{hint}</small>
        <button type="button" className="rr-link" onClick={onReset} disabled={isDefault}>
          기본값
        </button>
      </div>
    </div>
  );
}

// ───────────── 캐릭터 화면

function useEngineStats(handle: React.RefObject<RigHandle<string> | null>) {
  const [stats, setStats] = useState({ fps: 0, renders: 0, active: 0, state: '' });
  useEffect(() => {
    let last = { frames: 0, renders: 0, at: performance.now() };
    const id = window.setInterval(() => {
      const e = handle.current?.engine();
      if (!e) return;
      const now = performance.now();
      const dt = (now - last.at) / 1000;
      setStats({
        fps: Math.round((e.stats.renders - last.renders) / dt),
        renders: e.stats.renders,
        active: activeCount(),
        state: e.state,
      });
      last = { frames: e.stats.frames, renders: e.stats.renders, at: now };
    }, 500);
    return () => window.clearInterval(id);
  }, [handle]);
  return stats;
}

function CharacterScreen({
  id,
  style,
  setStyle,
  tuning,
  setTuning,
}: {
  id: CharId;
  style: RigStyle;
  setStyle: (s: RigStyle) => void;
  tuning: RigTuning;
  setTuning: (t: RigTuning) => void;
}) {
  const info = CHARS[id];
  const { def } = info;
  const motion = useMotion();
  const [state, setState] = useState<string>(def.idleState);
  const [talking, setTalking] = useState(false);
  const [look, setLook] = useState(true);
  const [costume, setCostume] = useState<Costume>({});
  const [coins, setCoins] = useState(0);
  const [cue, setCue] = useState('');
  const handle = useRef<RigHandle<string> | null>(null);
  const stats = useEngineStats(handle);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const go = (s: string) => {
    const e = handle.current?.engine();
    if (s === state && e) e.replay();
    setState(s);
  };

  const runInterrupt = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    const e = handle.current?.engine() as RigEngine<string> | undefined;
    if (!e) return;
    e.setState(def.idleState);
    setState(def.idleState);
    timers.current = info.interrupt.seq.map(([s, ms]) =>
      window.setTimeout(() => {
        e.setState(s);
        setState(s);
      }, 400 + ms),
    );
  };

  const onCue = (c: string) => {
    setCue(c);
    if (c === 'reward') setCoins((n) => n + 1);
    window.setTimeout(() => setCue(''), 700);
  };

  const t = tuning;
  const set = (patch: Partial<RigTuning>) => setTuning({ ...t, ...patch });
  const jelly = jellySettle(style, t.jellyZeta);
  const zeta = t.jellyZeta ?? JELLY_DEFAULT_ZETA[style];
  const paperDefault = STYLE_RULES[style === 'A' ? 'B' : style].paper;
  const paper = t.paper ?? paperDefault;
  const boilFps = t.boilFps ?? STYLE_RULES.B.boilFps;
  const haloStates = def.states.filter((s) => s !== def.idleState);

  return (
    <main className="rr-main">
      <header className="rr-head">
        <h1>{info.title}</h1>
        <p>{info.role}</p>
      </header>

      <div className="rr-layout">
        <section className="rr-stage-card" aria-label="무대">
          <div className={`rr-stage rr-stage-${style}`}>
            <RigView
              key={id}
              def={def}
              ref={handle}
              state={state}
              talking={talking}
              style={style}
              tier={motion.tier}
              reduced={motion.reduced}
              lookAt={look}
              size={280}
              tuning={tuningFor(def, tuning)}
              costume={costume}
              onAutoState={setState}
              onCue={onCue}
            />
            {id === 'star' && (
              <div className={`rr-hud ${cue === 'reward' ? 'rr-hud-pop' : ''}`} aria-live="polite">
                <svg width="22" height="22" viewBox="-10 -10 20 20" aria-hidden>
                  <circle r="8" fill="#FFCA28" stroke="#E08A00" strokeWidth="1.6" />
                </svg>
                <span>{coins}</span>
              </div>
            )}
            {cue && cue !== 'reward' && <div className="rr-cue">신호: {cue}</div>}
          </div>
          <p className="rr-tip">캐릭터를 누르면 콕 찌르기, 포인터를 움직이면 따라봐요.</p>
          <div className="rr-stats" aria-label="엔진 상태">
            <span>상태 <b>{def.stateLabel[stats.state] ?? '-'}</b></span>
            <span>그리기 <b>{stats.fps}</b>/초</span>
            <span>프레임 받는 리그 <b>{stats.active}</b></span>
          </div>
        </section>

        <section className="rr-panel" aria-label="상태">
          {info.groups.map((g) => (
            <div key={g.label} className="rr-group">
              <h2>{g.label}</h2>
              <div className="rr-states">
                {g.states.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rr-state"
                    aria-pressed={state === s}
                    onClick={() => go(s)}
                  >
                    {def.stateLabel[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="rr-group">
            <h2>끊기 시험</h2>
            <button type="button" className="rr-action" onClick={runInterrupt}>
              {info.interrupt.label}
            </button>
            <p className="rr-note">{info.interrupt.note}</p>
          </div>
          <div className="rr-group rr-toggles">
            <h2>보기</h2>
            <Seg
              label="스타일"
              value={style}
              options={RIG_STYLES.map((s) => ({ id: s, label: STYLE_LABEL[s] }))}
              onChange={setStyle}
            />
            <Seg
              label="연출 단계"
              value={motion.tier}
              options={[
                { id: 'full', label: 'full' },
                { id: 'lite', label: 'lite' },
                { id: 'minimal', label: 'minimal' },
              ]}
              onChange={(v) => setMotion({ tier: v })}
            />
            <div className="rr-checks">
              <label>
                <input type="checkbox" checked={motion.reduced} onChange={(e) => setMotion({ reduced: e.target.checked })} />
                동작 줄이기
              </label>
              <label>
                <input type="checkbox" checked={look} onChange={(e) => setLook(e.target.checked)} />
                따라보기
              </label>
              {info.talk && (
                <label>
                  <input type="checkbox" checked={talking} onChange={(e) => setTalking(e.target.checked)} />
                  말하기 레이어
                </label>
              )}
              {id === 'pybaem' && (
                <label>
                  <input
                    type="checkbox"
                    checked={!!costume.hat}
                    onChange={(e) => setCostume(e.target.checked ? { hat: 'party', cape: '#E53935' } : {})}
                  />
                  코스튬 (모자·망토)
                </label>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="rr-tuning" aria-label="모션 느낌 리뷰">
        <div className="rr-tuning-head">
          <h2>모션 느낌 리뷰</h2>
          <p>
            슬라이더로 바꿔 보고 마음에 드는 값을 알려 주세요. 바꾼 값은 <b className="rr-changed-text">주황색</b>으로 보여요 (세 캐릭터 공통).
          </p>
        </div>
        <div className="rr-sliders">
          <Slider
            label="점프 높이"
            hint="파이뱀 기쁨 점프 2번 · 응원 연속 점프 (128 기준 높이)"
            value={t.hop}
            min={0.5}
            max={1.6}
            step={0.05}
            onChange={(v) => set({ hop: v })}
            display={`×${f2(t.hop)} (기쁨 ${f2(16 * t.hop)} · 응원 ${f2(10 * t.hop)})`}
            isDefault={t.hop === DEFAULT_TUNING.hop}
            onReset={() => set({ hop: DEFAULT_TUNING.hop })}
          />
          <Slider
            label="젤리 정도"
            hint={`착지 출렁임 감쇠비 ζ (작을수록 많이 출렁). 스타일 기본 A 0.22 · A×B 0.36 · B 0.55`}
            value={zeta}
            min={0.12}
            max={0.75}
            step={0.01}
            onChange={(v) => set({ jellyZeta: v })}
            display={`ζ ${f2(zeta)} (k ${jelly.k} · c ${f2(jelly.c)} · ${jelly.ms}ms)`}
            isDefault={t.jellyZeta === null}
            onReset={() => set({ jellyZeta: null })}
          />
          <Slider
            label="슬픔 털썩"
            hint="슬퍼질 때(점프 중이면 착지할 때) 아래로 찌그러지는 세기"
            value={t.thud}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => set({ thud: v })}
            display={`×${f2(t.thud)}`}
            isDefault={t.thud === DEFAULT_TUNING.thud}
            onReset={() => set({ thud: DEFAULT_TUNING.thud })}
          />
          <Slider
            label="말하기 속도"
            hint="입 모양 리듬 (1 = 음절 0.09~0.21초, 단어 사이 0.12~0.38초). 파이뱀 말하기 레이어"
            value={t.talkSpeed}
            min={0.5}
            max={1.8}
            step={0.05}
            onChange={(v) => set({ talkSpeed: v })}
            display={`×${f2(t.talkSpeed)} (음절 ${f2(0.09 / t.talkSpeed)}~${f2(0.21 / t.talkSpeed)}초)`}
            isDefault={t.talkSpeed === DEFAULT_TUNING.talkSpeed}
            onReset={() => set({ talkSpeed: DEFAULT_TUNING.talkSpeed })}
          />
          <Slider
            label="따라보기 세기"
            hint="포인터를 볼 때 눈·얼굴·머리가 움직이는 정도"
            value={t.look}
            min={0.5}
            max={2}
            step={0.05}
            onChange={(v) => set({ look: v })}
            display={`×${f2(t.look)} (눈 ±${f2(2.2 * Math.min(1.8, t.look))} · 머리 ±${f2(4 * Math.min(1.5, t.look) * Math.min(1.8, t.look))}°)`}
            isDefault={t.look === DEFAULT_TUNING.look}
            onReset={() => set({ look: DEFAULT_TUNING.look })}
          />
          <Slider
            label="B안 선 떨림 (변위)"
            hint="B·A×B 종이 결 필터의 선 흔들림 크기. 기본 B 2.6 · A×B 1.5 (full 단계에서만)"
            value={paper}
            min={0}
            max={4}
            step={0.1}
            onChange={(v) => set({ paper: v })}
            display={`${f2(paper)}${style === 'A' ? ' (A는 필터 없음)' : ''}`}
            isDefault={t.paper === null}
            onReset={() => set({ paper: null })}
          />
          <Slider
            label="B안 선 떨림 (빠르기)"
            hint="B 스타일에서 선이 바뀌는 횟수(초당). 0이면 고정. 그림은 12fps 계단식"
            value={boilFps}
            min={0}
            max={12}
            step={1}
            onChange={(v) => set({ boilFps: v })}
            display={`${boilFps}회/초`}
            isDefault={t.boilFps === null}
            onReset={() => set({ boilFps: null })}
          />
          <Slider
            label="후광 진하기"
            hint="동작 줄이기·minimal에서 움직임 대신 보이는 상태 색"
            value={t.haloOpacity}
            min={0.2}
            max={0.9}
            step={0.05}
            onChange={(v) => set({ haloOpacity: v })}
            display={f2(t.haloOpacity)}
            isDefault={t.haloOpacity === DEFAULT_TUNING.haloOpacity}
            onReset={() => set({ haloOpacity: DEFAULT_TUNING.haloOpacity })}
          />
        </div>
        <div className="rr-halo">
          <h3>후광 색 (동작 줄이기를 켜고 상태를 눌러 보세요)</h3>
          <div className="rr-halo-row">
            {haloStates.map((s) => {
              const key = `${def.id}:${s}`;
              const value = t.haloColors[key] ?? def.halo[s];
              return (
                <label key={s} className="rr-color">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => set({ haloColors: { ...t.haloColors, [key]: e.target.value } })}
                  />
                  <span>{def.stateLabel[s]}</span>
                  <code className={t.haloColors[key] ? 'rr-changed-text' : ''}>{value}</code>
                </label>
              );
            })}
          </div>
        </div>
        <TuningSummary tuning={t} style={style} onReset={() => setTuning({ ...DEFAULT_TUNING })} />
      </section>

      <section className="rr-compare" aria-label="세 스타일 비교">
        <h2>세 스타일 (정지 그림 · 지금 상태)</h2>
        <div className="rr-compare-row">
          {RIG_STYLES.map((s) => (
            <figure key={s}>
              <RigStatic def={def} state={state} style={s} size={120} filters={s !== 'A'} />
              <figcaption>{STYLE_LABEL[s]}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}

function TuningSummary({ tuning, style, onReset }: { tuning: RigTuning; style: RigStyle; onReset: () => void }) {
  const lines = [
    `점프 높이 ×${f2(tuning.hop)}`,
    `젤리 ζ ${tuning.jellyZeta === null ? `스타일 기본 (${STYLE_LABEL[style]} ${f2(JELLY_DEFAULT_ZETA[style])})` : f2(tuning.jellyZeta)}`,
    `슬픔 털썩 ×${f2(tuning.thud)}`,
    `말하기 속도 ×${f2(tuning.talkSpeed)}`,
    `따라보기 ×${f2(tuning.look)}`,
    `선 떨림 변위 ${tuning.paper === null ? '기본' : f2(tuning.paper)} · 빠르기 ${tuning.boilFps === null ? '기본' : tuning.boilFps}`,
    `후광 진하기 ${f2(tuning.haloOpacity)}`,
    ...Object.entries(tuning.haloColors).map(([k, v]) => `후광 ${k} ${v}`),
  ];
  return (
    <div className="rr-summary">
      <div className="rr-summary-head">
        <h3>고른 값</h3>
        <button type="button" className="rr-link" onClick={onReset}>
          모두 기본값
        </button>
      </div>
      <pre aria-label="고른 값 요약">{lines.join('\n')}</pre>
    </div>
  );
}

// ───────────── 정지 그림 표

function PosesScreen({ style, setStyle }: { style: RigStyle; setStyle: (s: RigStyle) => void }) {
  const motion = useMotion();
  return (
    <main className="rr-main">
      <header className="rr-head">
        <h1>정지 그림 (포즈 표)</h1>
        <p>
          공유 카드·아바타·서버 첫 화면에 쓰는 <code>PybaemStatic</code>·<code>BugBugStatic</code>·<code>ByeolttongiStatic</code>. 엔진 없이 같은 geometry로 그려요.
          동작 줄이기를 켜면 상태별 후광 색이 함께 보여요.
        </p>
        <Seg label="스타일" value={style} options={RIG_STYLES.map((s) => ({ id: s, label: STYLE_LABEL[s] }))} onChange={setStyle} />
      </header>
      {(Object.keys(CHARS) as CharId[]).map((id) => {
        const { def, title } = CHARS[id];
        return (
          <section key={id} className="rr-poses" aria-label={title}>
            <h2>{title}</h2>
            <div className="rr-poses-grid">
              {def.states.map((s) => (
                <figure key={s}>
                  <RigStatic def={def} state={s} style={style} size={104} halo={motion.reduced} filters={false} />
                  <figcaption>{def.stateLabel[s]}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
      <section className="rr-poses" aria-label="작은 아바타">
        <h2>작은 아바타 (32 · 48 · 64px)</h2>
        <div className="rr-avatars">
          {(Object.keys(CHARS) as CharId[]).map((id) =>
            [32, 48, 64].map((px) => (
              <RigStatic key={`${id}${px}`} def={CHARS[id].def} style={style} size={px} filters={false} label="" />
            )),
          )}
        </div>
      </section>
    </main>
  );
}

// ───────────── 스트립 캡처 화면 (strips.mjs 전용)

interface StripConfig {
  char: CharId;
  style: RigStyle;
  tier: 'full' | 'lite' | 'minimal';
  reduced: boolean;
  size: number;
  state?: string;
  costume?: Costume;
  tuning?: Partial<RigTuning>;
}
interface ComposeSpec {
  title: string;
  note: string;
  rows: { label: string; sub?: string; frames: { src: string; t: number; hl?: boolean }[] }[];
}
declare global {
  interface Window {
    __rigConfig?: StripConfig;
    __rig?: { ready: boolean; engine: () => RigEngine<string> | null; setState: (s: string) => void };
    __compose?: (spec: ComposeSpec) => void;
  }
}

/** 스트립 제목·설명에 쓰는 문구 (인라인 폰트 서브셋에 글자가 들어가도록 번들에 둔다) */
export const STRIP_TEXT = {
  states: '상태별 움직임',
  poses: '기존 표정에서 옮긴 포즈',
  interrupt: '끊기 전환: 기쁨 → 0.25초 뒤 슬픔',
  reduced: '동작 줄이기: 움직임 없이 표정·후광 색만',
  tiers: '연출 단계: full · lite · minimal',
  note: '가짜 시계로 33ms씩 진행한 프레임 (66ms 간격 표시) · 주황 테두리 = 입력 순간',
  styles: 'A 모험 섬 · B 그림책 · A×B',
};

function StripScreen() {
  const cfg = window.__rigConfig ?? { char: 'pybaem', style: DEFAULT_RIG_STYLE, tier: 'full', reduced: false, size: 170 };
  const handle = useRef<RigHandle<string> | null>(null);
  const [spec, setSpec] = useState<ComposeSpec | null>(null);
  const def = CHARS[cfg.char].def;
  useEffect(() => {
    window.__compose = (s) => setSpec(s);
  }, []);
  const onEngine = useMemo(
    () => () => {
      window.__rig = {
        ready: true,
        engine: () => handle.current?.engine() ?? null,
        setState: (s: string) => handle.current?.engine()?.setState(s),
      };
    },
    [],
  );
  if (spec) return <ComposeView spec={spec} />;
  return (
    <main className="rr-strip">
      <div id="cap" style={{ width: cfg.size + 30, height: cfg.size + 30 }}>
        <RigView
          def={def}
          ref={handle}
          state={cfg.state}
          style={cfg.style}
          tier={cfg.tier}
          reduced={cfg.reduced}
          lookAt={false}
          pokeable={false}
          size={cfg.size}
          costume={cfg.costume}
          tuning={cfg.tuning}
          onEngine={onEngine}
        />
      </div>
    </main>
  );
}

function ComposeView({ spec }: { spec: ComposeSpec }) {
  return (
    <div id="compose" className="rr-compose">
      <h1>{spec.title}</h1>
      <p>{spec.note}</p>
      {spec.rows.map((r) => (
        <div key={r.label + (r.sub ?? '')} className="rr-compose-row">
          <div className="rr-compose-label">
            {r.label}
            {r.sub && <small>{r.sub}</small>}
          </div>
          {r.frames.map((f, i) => (
            <figure key={i} className={f.hl ? 'hl' : ''}>
              <img src={f.src} alt="" width={96} height={96} />
              <figcaption>{f.t}ms</figcaption>
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}

// ───────────── 성능 측정 화면 (bench.mjs 전용, P0-07 bench.html과 같은 방식)

interface BenchConfig {
  scene: 'single' | 'busy';
  style: RigStyle;
  tier: 'full' | 'lite' | 'minimal';
  warm: number;
  dur: number;
  /** 파이뱀 상태 (기본 dance = 가장 무거운 경우, idle = 대기 CPU) */
  state?: string;
}
declare global {
  interface Window {
    __benchConfig?: BenchConfig;
    __result?: unknown;
  }
}

function BenchScreen() {
  const c = window.__benchConfig ?? { scene: 'single', style: 'A', tier: 'full', warm: 1500, dur: 5000 };
  // single = 240px 파이뱀 춤 1개, busy = 파이뱀 춤 240 + 버그버그 공격 180 + 별똥이 반짝 180
  const items: { def: AnyDef; state: string; size: number }[] =
    c.scene === 'busy'
      ? [
          { def: CHARS.pybaem.def, state: 'dance', size: 240 },
          { def: CHARS.bugbug.def, state: 'attack', size: 180 },
          { def: CHARS.star.def, state: 'sparkle', size: 180 },
        ]
      : [{ def: CHARS.pybaem.def, state: c.state ?? 'dance', size: 240 }];
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, c.warm));
      if (cancelled) return;
      document.title = 'measuring';
      const deltas: number[] = [];
      const longtasks: number[] = [];
      let po: PerformanceObserver | null = null;
      try {
        po = new PerformanceObserver((l) => l.getEntries().forEach((e) => longtasks.push(e.duration)));
        po.observe({ type: 'longtask', buffered: false });
      } catch {
        /* 무시 */
      }
      await new Promise<void>((done) => {
        let last = 0;
        const t0 = performance.now();
        const f = (t: number) => {
          if (last) deltas.push(t - last);
          last = t;
          if (t - t0 < c.dur) requestAnimationFrame(f);
          else done();
        };
        requestAnimationFrame(f);
      });
      po?.disconnect();
      window.__result = { deltas, longtasks, nodes: document.getElementsByTagName('*').length };
      document.title = 'done';
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [c.warm, c.dur]);
  return (
    <main className="rr-strip">
      {items.map((it, i) => (
        <RigView
          key={i}
          def={it.def}
          state={it.state}
          style={c.style}
          tier={c.tier}
          reduced={false}
          lookAt={false}
          pokeable={false}
          size={it.size}
          seed={i + 1}
        />
      ))}
    </main>
  );
}

// ───────────── 앱

const STYLE_KEY = 'pyroad-rig-review-style';
function loadStyle(): RigStyle {
  try {
    const v = localStorage.getItem(STYLE_KEY);
    if (v === 'A' || v === 'B' || v === 'AB') return v;
  } catch {
    /* 무시 */
  }
  return DEFAULT_RIG_STYLE;
}

function App({ screen }: { screen: Screen }) {
  const [style, setStyleState] = useState<RigStyle>(loadStyle);
  const [tuning, setTuningState] = useState<RigTuning>(loadTuning);
  const setStyle = (s: RigStyle) => {
    setStyleState(s);
    try {
      localStorage.setItem(STYLE_KEY, s);
    } catch {
      /* 무시 */
    }
  };
  const setTuning = (t: RigTuning) => {
    setTuningState(t);
    saveTuning(t);
  };
  if (screen === 'strip') return <StripScreen />;
  if (screen === 'bench') return <BenchScreen />;
  if (screen === 'poses') return <PosesScreen style={style} setStyle={setStyle} />;
  return <CharacterScreen key={screen} id={screen} style={style} setStyle={setStyle} tuning={tuning} setTuning={setTuning} />;
}

// 후광 색 덮어쓰기는 "캐릭터:상태" 키로 기억하고, 리그에는 상태 이름으로 넘긴다
function tuningFor(def: AnyDef, t: RigTuning): RigTuning {
  const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(t.haloColors)) {
    const [c, s] = k.split(':');
    if (c === def.id) colors[s] = v;
  }
  return { ...t, haloColors: colors };
}

mountPrototype<Screen>({
  concept: 'AB',
  name: 'pyRoad 마스코트 리그',
  subtitle: 'P2-13 · 앱과 같은 코드',
  screens: SCREENS,
  defaultScreen: 'pybaem',
  render: (screen) => <App screen={screen} />,
});
