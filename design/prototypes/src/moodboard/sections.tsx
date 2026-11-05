// 무드보드 절 (개요 · 팔레트 · 타이포 · 캐릭터 · 모션 · 월드 · 체크리스트)
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BugBug, Byeolttongi, type BugBugMood, type StarMood } from '../shared/characters/Friends';
import { quest, STAGES, WORLD1, SAMPLE_PLAYER } from '../shared/content';
import { contrast, fmtRatio, passes, THRESHOLD } from '../shared/contrast';
import { Icon, RewardIcon } from '../shared/icons';
import { sampleSpring } from '../shared/motion';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { RIG_STATES, STATE_LABEL, type RigState } from '../shared/rig/params';
import {
  COLOR_NAMES,
  CONCEPTS,
  CONCEPT_NAME,
  LEGACY_GREEN,
  PAIRS,
  PALETTES,
  SPRINGS,
  TOKEN_ROLE,
  TYPE,
  TYPE_SCALE,
  cssVars,
  type Concept,
  type SpringName,
  type TokenName,
} from '../shared/tokens';
import { paperFiber, paperGrain } from '../shared/textures';
import { CHARACTER_ROLES, CHECKLIST, CONCEPT_INFO, ILLUSTRATION_RULES, MOTION_SPECS, WORLD_VISUALS } from './data';
import { CoinDemo, GameButtonDemo, InkDemo, JellyDemo, PageTurnDemo, PopupIslandDemo, StampDemo } from './demos';
import { WorldScene } from './scenes';

export const tagOf = (c: Concept) => (c === 'AB' ? 'A×B' : c);

/** 시안 범위: 토큰 CSS 변수 + data-concept (B·AB는 종이 결) */
export function Scope({ concept, className, children, as = 'div' }: { concept: Concept; className?: string; children: ReactNode; as?: 'div' | 'article' }) {
  const style = { ...cssVars(concept) } as Record<string, string>;
  if (concept !== 'A') style['--paper'] = `${paperGrain(0.08)}, ${paperFiber('#B89B6A', 0.06)}`;
  const Tag = as;
  return (
    <Tag className={`mb-scope ${className ?? ''}`} data-concept={concept} style={style as CSSProperties}>
      {children}
    </Tag>
  );
}

export function SectionHead({ id, no, title, lead }: { id: string; no: string; title: string; lead: ReactNode }) {
  return (
    <header className="mb-shead">
      <span className="mb-sno">{no}</span>
      <h2 id={`${id}-h`}>{title}</h2>
      <p>{lead}</p>
    </header>
  );
}

// ───────────── 개요

export function Overview() {
  return (
    <section id="overview" className="mb-section" aria-labelledby="overview-h">
      <SectionHead
        id="overview"
        no="01"
        title="세 가지 방향"
        lead="같은 파이뱀, 같은 퀘스트를 세 가지 분위기로. 시안 프로토타입(P2-02~04)은 이 페이지의 색·글꼴·모션 규칙을 그대로 씁니다."
      />
      <div className="mb-grid3">
        {CONCEPTS.map((c) => (
          <Scope key={c} concept={c} as="article" className="mb-ov">
            <div className="mb-ov-scene">
              <WorldScene concept={c} world={0} label={`${CONCEPT_NAME[c]} 1월드 장면`} />
              <div className="mb-ov-rig">
                <PybaemRig style={c} state={c === 'B' ? 'talk' : 'happy'} size={112} lookAt={false} seed={c.length * 3} />
              </div>
            </div>
            <div className="mb-ov-body">
              <span className="mb-ov-tag">{tagOf(c)}</span>
              <h3 className="mb-display mb-ov-name">{CONCEPT_NAME[c]}</h3>
              <p className="mb-ov-one">{CONCEPT_INFO[c].oneLine}</p>
              <ul className="mb-chips">
                {CONCEPT_INFO[c].mood.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <div className="mb-ov-sample">
                <button type="button" className={`mb-btn mb-btn-${c}`}>
                  <Icon name="play" size={20} />
                  모험 시작!
                </button>
                <span className="mb-ov-rewards" aria-label="보상 아이콘 견본">
                  <RewardIcon kind="coin" style={c} />
                  <RewardIcon kind="star" style={c} />
                  <RewardIcon kind="key" style={c} />
                  <RewardIcon kind="heart" style={c} />
                </span>
              </div>
              <dl className="mb-ov-meta">
                <div>
                  <dt>분위기</dt>
                  <dd>{CONCEPT_INFO[c].genre}</dd>
                </div>
                <div>
                  <dt>주의</dt>
                  <dd>{CONCEPT_INFO[c].risk}</dd>
                </div>
              </dl>
            </div>
          </Scope>
        ))}
      </div>
    </section>
  );
}

// ───────────── 팔레트·대비

const GROUPS: { title: string; tokens: TokenName[] }[] = [
  { title: '바탕·선', tokens: ['bg', 'surface', 'surface2', 'line', 'lineStrong'] },
  { title: '글자', tokens: ['text', 'textMuted', 'primaryText', 'accentText'] },
  { title: '주색·보조색', tokens: ['primary', 'primaryLip', 'primaryBright', 'secondary', 'secondaryLip', 'accent', 'highlight'] },
  { title: '상태', tokens: ['success', 'successSoft', 'warning', 'warningSoft', 'error', 'errorSoft'] },
  { title: '월드 테마', tokens: ['w1', 'w1Ink', 'w1Soft', 'w2', 'w2Ink', 'w2Soft', 'w3', 'w3Ink', 'w3Soft'] },
  { title: '코드', tokens: ['codeBg', 'codeText', 'codeComment', 'codeKeyword', 'codeString', 'codeNumber', 'codeFunc'] },
];
/** 채움 견본 위에 얹어 보여 줄 글자색 */
const ON: Partial<Record<TokenName, TokenName>> = {
  primary: 'onPrimary',
  secondary: 'onSecondary',
  highlight: 'onHighlight',
  w1Ink: 'onPrimary',
  w2Ink: 'onPrimary',
  w3Ink: 'onPrimary',
  successSoft: 'success',
  warningSoft: 'warning',
  errorSoft: 'error',
  w1Soft: 'w1Ink',
  w2Soft: 'w2Ink',
  w3Soft: 'w3Ink',
  codeBg: 'codeText',
  bg: 'text',
  surface: 'text',
  surface2: 'text',
};

function Swatch({ c, t }: { c: Concept; t: TokenName }) {
  const p = PALETTES[c];
  const role = TOKEN_ROLE[t];
  const on = ON[t];
  const isText = role.role === 'text';
  const fg = on ? p[on] : isText ? p[t] : undefined;
  const bg = isText ? (t.startsWith('code') ? p.codeBg : p.surface) : p[t];
  const r = fg ? contrast(fg, bg) : null;
  const named = COLOR_NAMES[c][t];
  return (
    <li className="mb-sw">
      <span className="mb-sw-chip" style={{ background: bg, color: fg }} data-decor={role.role === 'decor' ? '' : undefined}>
        {fg ? (
          <span className="mb-sw-aa">가 Aa</span>
        ) : role.role === 'ui' ? (
          <span className="mb-sw-decor">경계 {fmtRatio(contrast(p[t], p.surface))}</span>
        ) : (
          <span className="mb-sw-decor">장식</span>
        )}
        {r && <span className="mb-sw-ratio">{fmtRatio(r)}</span>}
      </span>
      <span className="mb-sw-name">{named ?? role.label}</span>
      <span className="mb-sw-meta">
        <code>{t}</code> {p[t].toUpperCase()}
      </span>
    </li>
  );
}

export function PaletteSection() {
  return (
    <section id="palette" className="mb-section" aria-labelledby="palette-h">
      <SectionHead
        id="palette"
        no="02"
        title="팔레트와 대비"
        lead={
          <>
            세 시안이 <b>같은 토큰 이름</b>(<code>--c-bg</code>, <code>--c-primary</code> …)을 쓰고 값만 다릅니다. 글자를 얹는 모든 조합은 WCAG AA(본문 4.5:1, 경계선·아이콘 3:1)를 넘깁니다. 견본 오른쪽 위 숫자는 그 견본의 글자 대비입니다.
          </>
        }
      />
      <GreenCompare />
      {CONCEPTS.map((c) => (
        <Scope key={c} concept={c} className="mb-pal">
          <div className="mb-pal-head">
            <span className="mb-ov-tag">{tagOf(c)}</span>
            <h3 className="mb-display">{CONCEPT_NAME[c]}</h3>
          </div>
          <div className="mb-pal-groups">
            {GROUPS.map((g) => (
              <div key={g.title} className="mb-pal-group">
                <h4>{g.title}</h4>
                <ul className="mb-sws">
                  {g.tokens.map((t) => (
                    <Swatch key={t} c={c} t={t} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <ContrastGrid c={c} />
        </Scope>
      ))}
    </section>
  );
}

function GreenCompare() {
  const rows: { label: string; green: string; on: string; bg: string; note: string }[] = [
    { label: '지금 앱', green: LEGACY_GREEN, on: '#FFFFFF', bg: '#f8f5ee', note: '흰 글자·배경 위 글자 모두 미달' },
    ...CONCEPTS.map((c) => ({
      label: `${tagOf(c)} ${CONCEPT_NAME[c]}`,
      green: PALETTES[c].primary,
      on: PALETTES[c].onPrimary,
      bg: PALETTES[c].bg,
      note: COLOR_NAMES[c].primary ?? '',
    })),
  ];
  return (
    <div className="mb-green">
      <h3>브랜드 초록 바꾸기</h3>
      <p>파이뱀의 초록은 그대로 두고 명도만 낮춰 흰 글자 4.5:1을 넘깁니다. 밝은 초록은 글자를 얹지 않는 장식(캐릭터 몸, 섬 풀밭)에만 씁니다.</p>
      <ul className="mb-green-row">
        {rows.map((r) => {
          const onR = contrast(r.on, r.green);
          const bgR = contrast(r.green, r.bg);
          const ok = passes(onR, 'text') && passes(bgR, 'text');
          return (
            <li key={r.label} className="mb-green-item">
              <span className="mb-green-btn" style={{ background: r.green, color: r.on }}>
                시작하기
              </span>
              <span className="mb-green-label">
                <b>{r.label}</b>
                <span>
                  {r.green.toUpperCase()} {r.note && `· ${r.note}`}
                </span>
              </span>
              <span className={`mb-badge ${ok ? 'ok' : 'bad'}`}>
                버튼 {fmtRatio(onR)} · 글자 {fmtRatio(bgR)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ContrastGrid({ c }: { c: Concept }) {
  const p = PALETTES[c];
  const rows = PAIRS.map((pr) => ({ ...pr, r: contrast(p[pr.fg], p[pr.bg]) }));
  const fails = rows.filter((r) => !passes(r.r, r.kind)).length;
  const min = rows.filter((r) => r.kind === 'text').reduce((a, r) => Math.min(a, r.r), 99);
  return (
    <details className="mb-cg">
      <summary>
        대비 표 {rows.length}개 조합 · {fails ? <b className="bad">미달 {fails}</b> : <b className="ok">모두 통과</b>} · 글자 최저 {fmtRatio(min)}:1
      </summary>
      <ul className="mb-cg-grid">
        {rows.map((r) => (
          <li key={`${r.fg}-${r.bg}`} style={{ background: p[r.bg], color: p[r.fg] }} className="mb-cg-cell">
            {r.kind === 'ui' ? (
              <span className="mb-cg-ui" style={{ borderColor: p[r.fg] }} />
            ) : (
              <span className="mb-cg-aa">가나 Aa</span>
            )}
            <span className="mb-cg-num">
              {fmtRatio(r.r)}
              <small>/{THRESHOLD[r.kind]}</small>
            </span>
            <span className="mb-cg-use">{r.use}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// ───────────── 타이포

export function TypeSection() {
  const q = quest(2, 2);
  const stage = STAGES[1];
  return (
    <section id="type" className="mb-section" aria-labelledby="type-h">
      <SectionHead
        id="type"
        no="03"
        title="타이포 견본"
        lead={
          <>
            실제 퀘스트 문구로 그렸습니다. 본문 {TYPE_SCALE.body}px · 자간 0 · <code>word-break: keep-all</code> · 캡션 {TYPE_SCALE.caption}px 이상. 손글씨 제목(Gaegu)은 같은 px에서 작게 보여 1.15배로 키웁니다. HUD 숫자는 고정 폭 상자, 코드는 D2Coding(한글 = 영문 2칸).
          </>
        }
      />
      <div className="mb-grid3">
        {CONCEPTS.map((c) => {
          const t = TYPE[c];
          const display = c === 'A' ? 'Jua 400' : 'Gaegu 700';
          const body = c === 'B' ? 'Gowun Dodum 400' : 'Pretendard (가변)';
          return (
            <Scope key={c} concept={c} as="article" className="mb-type">
              <div className="mb-type-spec">
                <span className="mb-ov-tag">{tagOf(c)}</span>
                <span>
                  제목 {display} ×{t.displayScale} · 본문 {body} {TYPE_SCALE.body}/{t.bodyLineHeight}
                </span>
              </div>
              <p className="mb-type-k">{WORLD1.title} · Stage {stage.order}</p>
              <h3 className="mb-display mb-type-h1">{stage.title}</h3>
              <h4 className="mb-display mb-type-h2">{q.title}</h4>
              <p className="mb-type-body">{q.story}</p>
              <p className="mb-type-body">
                {c === 'B' ? (
                  <>
                    <span className="mb-em">해 볼 일</span> {q.task}
                  </>
                ) : (
                  <>
                    <strong>해 볼 일</strong> {q.task}
                  </>
                )}
              </p>
              <div className="mb-type-bubble">
                <PybaemRig style={c} state="happy" static size={56} framing="avatar" />
                <p>숫자는 따옴표 없이, 글자는 따옴표로 감싸요. 상자 이름표를 잘 보세요!</p>
              </div>
              <p className="mb-type-cap">
                퀘스트 {stage.order}-{q.order} · {q.concept} · {q.xp} XP · 캡션 {TYPE_SCALE.caption}px
              </p>
              <HudSample c={c} />
              <pre className="mb-code" aria-label="코드 견본">
                <code>
                  <span className="tk-c"># 숫자와 글자를 각각 변수에 넣어보세요!</span>
                  {'\n'}
                  <span className="tk-v">name</span> = <span className="tk-s">"파이뱀"</span>
                  {'    '}
                  <span className="tk-c"># 이름 상자</span>
                  {'\n'}
                  <span className="tk-v">age</span>
                  {'  '}= <span className="tk-n">7</span>
                  {'           '}
                  <span className="tk-c"># 나이 상자</span>
                  {'\n'}
                  <span className="tk-k">print</span>(<span className="tk-v">name</span>, <span className="tk-v">age</span>)
                </code>
              </pre>
            </Scope>
          );
        })}
      </div>
    </section>
  );
}

function HudSample({ c }: { c: Concept }) {
  const coins = useRef<HTMLSpanElement | null>(null);
  const [n, setN] = useState(SAMPLE_PLAYER.coins);
  const bump = () => {
    const from = n;
    const to = n + 111;
    const t0 = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / 900);
      const v = Math.round(from + (to - from) * u);
      if (coins.current) coins.current.textContent = v.toLocaleString('ko-KR');
      if (u < 1) requestAnimationFrame(step);
      else setN(to);
    };
    requestAnimationFrame(step);
  };
  return (
    <div className="mb-hud">
      <span className="mb-hud-item">
        <RewardIcon kind="coin" size={24} style={c} />
        <span ref={coins} className="mb-hud-num">
          {n.toLocaleString('ko-KR')}
        </span>
      </span>
      <span className="mb-hud-item">
        <RewardIcon kind="star" size={24} style={c} />
        <span className="mb-hud-num">{SAMPLE_PLAYER.stars}</span>
      </span>
      <span className="mb-hud-item">
        <span className="mb-hud-lv">Lv</span>
        <span className="mb-hud-num">{SAMPLE_PLAYER.level}</span>
      </span>
      <button type="button" className="mb-mini" onClick={bump}>
        숫자 올리기
      </button>
    </div>
  );
}

// ───────────── 캐릭터

export function CharacterSection() {
  const [state, setState] = useState<RigState>('idle');
  const [talking, setTalking] = useState(false);
  const [bug, setBug] = useState<BugBugMood>('searching');
  const [star, setStar] = useState<StarMood>('sparkling');
  return (
    <section id="characters" className="mb-section" aria-labelledby="characters-h">
      <SectionHead
        id="characters"
        no="04"
        title="캐릭터 3인"
        lead="파이뱀은 P0-07 SVG 리그(스프링·레이어 엔진)를 그대로 씁니다. 같은 리그가 스타일만 바꿔 A·B·A×B로 그려집니다. 눌러서 콕 찌르기, 마우스를 움직이면 따라봅니다. 버그버그·별똥이는 지금 SVG에 CSS 모션만 붙인 임시판입니다(정식 리그는 P2-13)."
      />
      <div className="mb-rigbar" role="group" aria-label="파이뱀 상태">
        {RIG_STATES.map((s) => (
          <button key={s} type="button" aria-pressed={state === s} onClick={() => setState(s)}>
            {STATE_LABEL[s]}
          </button>
        ))}
        <label className="mb-check">
          <input type="checkbox" checked={talking} onChange={(e) => setTalking(e.target.checked)} />
          말하기 레이어
        </label>
      </div>
      <div className="mb-grid3">
        {CONCEPTS.map((c) => (
          <Scope key={c} concept={c} as="article" className="mb-char">
            <div className="mb-char-stage">
              <PybaemRig style={c} state={state} talking={talking} size={196} seed={11 + c.length} />
            </div>
            <div className="mb-char-head">
              <span className="mb-ov-tag">{tagOf(c)}</span>
              <h3 className="mb-display">파이뱀 · 튜터</h3>
            </div>
            <p className="mb-char-role">{CHARACTER_ROLES[c].pybaem}</p>
            <div className="mb-friends">
              <div className="mb-friend">
                <BugBug style={c} mood={bug} size={88} motion="bob" />
                <div>
                  <b className="mb-display">버그버그 · 에러·보스 겸 친구</b>
                  <p>{CHARACTER_ROLES[c].bugbug}</p>
                </div>
              </div>
              <div className="mb-friend">
                <Byeolttongi style={c} mood={star} size={88} motion="bob" />
                <div>
                  <b className="mb-display">별똥이 · 보상 요정</b>
                  <p>{CHARACTER_ROLES[c].star}</p>
                </div>
              </div>
            </div>
          </Scope>
        ))}
      </div>
      <div className="mb-rigbar" role="group" aria-label="버그버그·별똥이 표정">
        <span className="mb-rigbar-k">버그버그</span>
        {(['searching', 'found', 'fixed'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={bug === m} onClick={() => setBug(m)}>
            {{ searching: '찾는 중', found: '발견', fixed: '고침' }[m]}
          </button>
        ))}
        <span className="mb-rigbar-k">별똥이</span>
        {(['flying', 'landing', 'sparkling'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={star === m} onClick={() => setStar(m)}>
            {{ flying: '날아옴', landing: '착지', sparkling: '반짝' }[m]}
          </button>
        ))}
      </div>
    </section>
  );
}

// ───────────── 모션

const CURVE_COLORS: Record<SpringName, string> = {
  face: '#2563A8',
  body: '#2F8F4E',
  envelope: '#8A8F98',
  prop: '#D9822B',
  jellyA: '#D6336C',
  jellyAB: '#8E44AD',
  jellyB: '#7A5C3E',
};
const CURVE_USE: Record<SpringName, string> = {
  face: '눌림 복귀·탭 전환 (리그 얼굴)',
  body: '카드 등장·스탬프 안착·팝업 섬 (리그 몸)',
  envelope: '페이드·강조 (리그 레이어 세기)',
  prop: '코인·별·HUD 숫자 팝 (리그 소품)',
  jellyA: 'A 젤리 (리그 착지 출렁임)',
  jellyAB: 'A×B 젤리',
  jellyB: 'B 묵직한 복귀 (리그 B)',
};

function SpringChart() {
  const W = 560;
  const H = 200;
  const T = 1200;
  const y = (v: number) => H - 24 - v * ((H - 48) / 1.35);
  const names = Object.keys(SPRINGS) as SpringName[];
  return (
    <figure className="mb-springs">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="스프링 7종의 0에서 1까지 진행 곡선, 1.2초">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1="36" x2={W - 8} y1={y(v)} y2={y(v)} stroke={v === 1 ? '#9AA1AC' : '#E1E3E7'} strokeDasharray={v === 1 ? '4 4' : undefined} />
            <text x="30" y={y(v) + 4} textAnchor="end" fontSize="11" fill="#5B6270">
              {v}
            </text>
          </g>
        ))}
        {[0, 300, 600, 900, 1200].map((ms) => (
          <text key={ms} x={36 + (ms / T) * (W - 44)} y={H - 6} fontSize="11" fill="#5B6270" textAnchor={ms === T ? 'end' : ms === 0 ? 'start' : 'middle'}>
            {ms}ms
          </text>
        ))}
        {names.map((n) => {
          const { values } = sampleSpring(SPRINGS[n], { maxMs: T });
          const pts = values
            .filter((_, i) => i % 3 === 0)
            .map((v, i) => `${(36 + ((i * 3) / 120 / (T / 1000)) * (W - 44)).toFixed(1)},${y(v).toFixed(1)}`)
            .filter((_, i) => (i * 3) / 120 <= T / 1000);
          return <polyline key={n} points={pts.join(' ')} fill="none" stroke={CURVE_COLORS[n]} strokeWidth="2.4" strokeLinejoin="round" />;
        })}
      </svg>
      <figcaption>
        <ul className="mb-springs-legend">
          {names.map((n) => {
            const s = SPRINGS[n];
            const z = s.c / (2 * Math.sqrt(s.k));
            const settle = sampleSpring(s).durationMs;
            return (
              <li key={n}>
                <i style={{ background: CURVE_COLORS[n] }} />
                <b>{n}</b>
                <span>
                  k{s.k} c{s.c} · ζ {z.toFixed(2)} · {settle}ms
                </span>
                <em>{CURVE_USE[n]}</em>
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}

export function MotionSection() {
  return (
    <section id="motion" className="mb-section" aria-labelledby="motion-h">
      <SectionHead
        id="motion"
        no="05"
        title="모션"
        lead={
          <>
            스프링 값은 마스코트 리그(P0-07 <code>SPRING</code>)와 같습니다. UI 모션도 같은 7개 스프링만 쓰고, CSS <code>linear()</code> easing으로 바꿔 Web Animations·CSS에 그대로 넣습니다. 오른쪽 아래 검토 도구에서 <b>연출 단계</b>와 <b>동작 줄이기</b>를 바꾸면 데모가 그 규칙대로 바뀝니다.
          </>
        }
      />
      <SpringChart />
      {CONCEPTS.map((c) => (
        <Scope key={c} concept={c} className="mb-mo">
          <div className="mb-pal-head">
            <span className="mb-ov-tag">{tagOf(c)}</span>
            <h3 className="mb-display">{CONCEPT_NAME[c]}</h3>
          </div>
          <div className="mb-mo-demos">
            {c === 'A' && (
              <>
                <GameButtonDemo concept="A" />
                <JellyDemo />
                <CoinDemo concept="A" />
              </>
            )}
            {c === 'B' && (
              <>
                <PageTurnDemo />
                <InkDemo />
                <StampDemo />
              </>
            )}
            {c === 'AB' && (
              <>
                <GameButtonDemo concept="AB" />
                <PopupIslandDemo />
                <CoinDemo concept="AB" />
              </>
            )}
          </div>
          <div className="mb-table-wrap">
            <table className="mb-table">
              <thead>
                <tr>
                  <th scope="col">모션</th>
                  <th scope="col">full</th>
                  <th scope="col">lite</th>
                  <th scope="col">minimal</th>
                  <th scope="col">동작 줄이기</th>
                </tr>
              </thead>
              <tbody>
                {MOTION_SPECS[c].map((m) => (
                  <tr key={m.name}>
                    <th scope="row">
                      <b>{m.name}</b>
                      <span>{m.what}</span>
                    </th>
                    <td>{m.full}</td>
                    <td>{m.lite}</td>
                    <td>{m.minimal}</td>
                    <td>{m.reduced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Scope>
      ))}
    </section>
  );
}

// ───────────── 월드

export function WorldSection() {
  return (
    <section id="worlds" className="mb-section" aria-labelledby="worlds-h">
      <SectionHead
        id="worlds"
        no="06"
        title="월드별 비주얼 변화"
        lead="버튼·카드·HUD는 그대로 두고 배경·지도·테마색(w1/w2/w3)만 바꿔 진행 자체가 보상이 되게 합니다. 구름·물결·연기는 앰비언트라 lite부터 멈춥니다."
      />
      {CONCEPTS.map((c) => (
        <Scope key={c} concept={c} className="mb-wo">
          <div className="mb-pal-head">
            <span className="mb-ov-tag">{tagOf(c)}</span>
            <h3 className="mb-display">{CONCEPT_NAME[c]}</h3>
          </div>
          <ol className="mb-wo-list">
            {WORLD_VISUALS[c].map((w, i) => {
              const k = (['w1', 'w2', 'w3'] as const)[i];
              const p = PALETTES[c];
              return (
                <li key={w.name} className="mb-wo-item" style={{ background: p[`${k}Soft`] }}>
                  <WorldScene concept={c} world={i as 0 | 1 | 2} label={w.name} />
                  <div className="mb-wo-text">
                    <b className="mb-display" style={{ color: p[`${k}Ink`] }}>
                      {w.name}
                    </b>
                    <p>{w.desc}</p>
                    <span className="mb-wo-chips">
                      <i style={{ background: p[k] }} title={`${k} ${p[k]}`} />
                      <i style={{ background: p[`${k}Ink`] }} title={`${k}Ink ${p[`${k}Ink`]}`} />
                      <i style={{ background: p[`${k}Soft`] }} title={`${k}Soft ${p[`${k}Soft`]}`} />
                      <code>
                        {p[k]} · {p[`${k}Ink`]}
                      </code>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </Scope>
      ))}
    </section>
  );
}

// ───────────── 일러스트 규칙 + 체크리스트

export function RulesSection() {
  return (
    <section id="rules" className="mb-section" aria-labelledby="rules-h">
      <SectionHead id="rules" no="07" title="일러스트 규칙" lead="새 그림(배경·아이콘·코스튬)을 그릴 때 지킬 규칙. 캐릭터는 리그 코드로 관리합니다(P2-16)." />
      <div className="mb-grid3">
        {CONCEPTS.map((c) => (
          <Scope key={c} concept={c} as="article" className="mb-rules">
            <div className="mb-pal-head">
              <span className="mb-ov-tag">{tagOf(c)}</span>
              <h3 className="mb-display">{CONCEPT_NAME[c]}</h3>
            </div>
            <dl>
              {ILLUSTRATION_RULES[c].map((r) => (
                <div key={r.k}>
                  <dt>{r.k}</dt>
                  <dd>{r.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mb-rules-icons" aria-label="아이콘 견본">
              {(['home', 'map', 'book', 'hint', 'sound', 'settings'] as const).map((n) => (
                <span key={n} className="mb-rules-icon">
                  <Icon name={n} size={24} />
                </span>
              ))}
              {(['coin', 'star', 'starEmpty', 'gem'] as const).map((k) => (
                <RewardIcon key={k} kind={k} size={30} style={c} />
              ))}
            </div>
          </Scope>
        ))}
      </div>
    </section>
  );
}

export function ChecklistSection() {
  return (
    <section id="checklist" className="mb-section" aria-labelledby="checklist-h">
      <SectionHead id="checklist" no="08" title="리뷰 체크리스트 (P2-06)" lead="시안 세 개를 비교할 때 이 질문으로 봐 주세요. 하나를 고르거나, 섞을 부분을 골라도 됩니다." />
      <div className="mb-grid2">
        {CHECKLIST.map((g) => (
          <div key={g.group} className="mb-cl">
            <h3>{g.group}</h3>
            <ul>
              {g.items.map((it) => (
                <li key={it}>
                  <span className="mb-cl-box" aria-hidden />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
