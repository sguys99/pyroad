// P0-07 쇼케이스: SVG 리그 프로토타입 + 런타임 비교 패널
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PybaemRig, type PybaemRigHandle, type Palette } from '../src/rig/PybaemRig';
import { RIG_STATES, STATE_LABEL, type MotionTier, type RigState, type RigStyle } from '../src/rig/params';
import type { Costume, HatKind } from '../src/rig/costumes';
import { PybaemSvg } from '../../../src/components/characters/PybaemSvg';
import { LottieWebCard, DotLottieCard, RiveAvatarCard, RiveBirbCard, BakedLottieCard } from './runtimes';

const STATE_COLOR: Record<RigState, string> = {
  idle: '#81C784',
  talk: '#4DB6AC',
  think: '#B39DDB',
  happy: '#FFD54F',
  sad: '#81D4FA',
  cheer: '#FFB74D',
  dance: '#F48FB1',
};
const Dot = ({ c }: { c: string }) => <span className="swatch" style={{ background: c }} />;
const SKINS: { name: string; pal?: Partial<Palette> }[] = [
  { name: '초록' },
  { name: '하늘', pal: { body: '#4FC3F7', bodyDark: '#0288D1', bodyLight: '#B3E5FC', belly: '#E1F5FE', ink: '#01579B' } },
  { name: '딸기', pal: { body: '#F48FB1', bodyDark: '#D81B60', bodyLight: '#FCE4EC', belly: '#FFF0F5', ink: '#880E4F' } },
  { name: '황금', pal: { body: '#FFD54F', bodyDark: '#FFA000', bodyLight: '#FFF8E1', belly: '#FFFDE7', ink: '#6D4C41' } },
];
const HATS: (HatKind | undefined)[] = [undefined, 'party', 'explorer', 'crown', 'wizard'];
const HAT_LABEL: Record<string, string> = { none: '없음', party: '파티', explorer: '탐험가', crown: '왕관', wizard: '마법사' };

function useFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let n = 0;
    let t0 = performance.now();
    let id = 0;
    const f = (t: number) => {
      n++;
      if (t - t0 > 500) {
        setFps(Math.round((n * 1000) / (t - t0)));
        n = 0;
        t0 = t;
      }
      id = requestAnimationFrame(f);
    };
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, []);
  return fps;
}

function Chip({ on, onClick, children, title }: { on?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button className={`chip${on ? ' on' : ''}`} onClick={onClick} title={title} aria-pressed={on}>
      {children}
    </button>
  );
}

function Playground() {
  const q = new URLSearchParams(location.search);
  const [state, setState] = useState<RigState>((q.get('state') as RigState) ?? 'idle');
  const [talking, setTalking] = useState(q.get('talk') === '1');
  const [style, setStyle] = useState<RigStyle>((q.get('style') as RigStyle) ?? 'A');
  const [tier, setTier] = useState<MotionTier>((q.get('tier') as MotionTier) ?? 'full');
  const [reduced, setReduced] = useState(q.get('reduced') === '1');
  const [skin, setSkin] = useState(Number(q.get('skin') ?? 0));
  const [costume, setCostume] = useState<Costume>({
    hat: (q.get('hat') as HatKind) || undefined,
    glasses: q.get('glasses') === '1' ? 'round' : (q.get('glasses') as Costume['glasses']) || undefined,
    cape: q.get('cape') ? `#${q.get('cape')}` : undefined,
    bg: (q.get('bg') as Costume['bg']) || undefined,
  });
  const rig = useRef<PybaemRigHandle>(null);
  const fps = useFps();
  const timers = useRef<number[]>([]);

  const interruptTest = () => {
    timers.current.forEach(clearTimeout);
    const seq: [number, RigState][] = [
      [0, 'happy'],
      [250, 'sad'],
      [700, 'cheer'],
      [950, 'think'],
      [1700, 'dance'],
      [2300, 'idle'],
    ];
    timers.current = seq.map(([ms, s]) => window.setTimeout(() => setState(s), ms));
  };
  (window as unknown as { __setRig: unknown }).__setRig = { setState, setTalking, setStyle, setTier, setReduced, setCostume, setSkin, poke: () => rig.current?.poke() };

  return (
    <section className="card hero">
      <div className={`stage ${style === 'B' ? 'paper' : 'clay'}`}>
        <div className="stage-badge"><Dot c={STATE_COLOR[state]} /> {STATE_LABEL[state]}{talking && state !== 'talk' ? ' + 말하기' : ''}</div>
        <PybaemRig
          ref={rig}
          state={state}
          talking={talking}
          style={style}
          tier={tier}
          reducedMotion={reduced}
          palette={SKINS[skin].pal}
          costume={costume}
          size={300}
        />
        <div className="stage-tip">마우스를 움직이거나 파이뱀을 콕 찔러 보세요</div>
        <div className="fps" aria-hidden>{fps} fps</div>
      </div>
      <div className="controls">
        <h3>상태</h3>
        <div className="row">
          {RIG_STATES.map((s) => (
            <Chip key={s} on={state === s} onClick={() => setState(s)}>
              <Dot c={STATE_COLOR[s]} /> {STATE_LABEL[s]}
            </Chip>
          ))}
        </div>
        <div className="row">
          <Chip on={talking} onClick={() => setTalking(!talking)} title="말하기는 표정 위에 겹치는 레이어">
            말하면서 (어떤 표정이든)
          </Chip>
          <Chip onClick={interruptTest} title="기쁨→슬픔→응원→생각→춤→대기를 0.25~0.75초 간격으로 끊어 전환">
            끊기 테스트
          </Chip>
          <Chip onClick={() => rig.current?.poke()}>콕 찌르기</Chip>
        </div>
        <h3>시안 스타일</h3>
        <div className="row">
          <Chip on={style === 'A'} onClick={() => setStyle('A')}>A 모험 섬 (클레이·젤리)</Chip>
          <Chip on={style === 'B'} onClick={() => setStyle('B')}>B 마법 그림책 (잉크 떨림·2프레임)</Chip>
        </div>
        <h3>꾸미기 (Phase 9 미리보기)</h3>
        <div className="row">
          {HATS.map((h) => (
            <Chip key={h ?? 'none'} on={costume.hat === h} onClick={() => setCostume({ ...costume, hat: h })}>
              모자 {HAT_LABEL[h ?? 'none']}
            </Chip>
          ))}
        </div>
        <div className="row">
          <Chip on={!!costume.glasses} onClick={() => setCostume({ ...costume, glasses: costume.glasses ? undefined : 'round' })}>안경</Chip>
          <Chip on={costume.glasses === 'sun'} onClick={() => setCostume({ ...costume, glasses: costume.glasses === 'sun' ? undefined : 'sun' })}>선글라스</Chip>
          <Chip on={!!costume.cape} onClick={() => setCostume({ ...costume, cape: costume.cape ? undefined : '#E53935' })}>망토</Chip>
          <Chip on={!!costume.bg} onClick={() => setCostume({ ...costume, bg: costume.bg ? undefined : style === 'B' ? 'paper' : 'island' })}>배경</Chip>
        </div>
        <div className="row">
          {SKINS.map((s, i) => (
            <Chip key={s.name} on={skin === i} onClick={() => setSkin(i)}>
              <span className="swatch" style={{ background: s.pal?.body ?? '#66BB6A' }} /> {s.name}
            </Chip>
          ))}
        </div>
        <h3>연출 단계 (P0-16)</h3>
        <div className="row">
          {(['full', 'lite', 'minimal'] as MotionTier[]).map((t) => (
            <Chip key={t} on={tier === t} onClick={() => setTier(t)}>
              {t === 'full' ? 'full' : t === 'lite' ? 'lite (30fps 상한)' : 'minimal (전환만)'}
            </Chip>
          ))}
          <Chip on={reduced} onClick={() => setReduced(!reduced)} title="움직임 없이 표정과 색으로만 피드백">
            동작 줄이기 (reduced-motion)
          </Chip>
        </div>
      </div>
    </section>
  );
}

function StaticGallery() {
  const costume: Costume = { hat: 'party', glasses: 'round', cape: '#E53935' };
  return (
    <section className="card">
      <h2>정적 렌더: 같은 리그, 같은 코스튬, 모든 상태</h2>
      <p className="muted">
        엔진 없이 <code>geometry(staticParams(state))</code>만으로 그린 SVG입니다. SSR 첫 화면, 공유 카드(<code>next/og</code>), 프로필
        아바타, reduced-motion이 모두 이 경로를 씁니다. 모자·안경·망토가 표정과 관계없이 같은 자리에 붙습니다.
      </p>
      <div className="gallery">
        {RIG_STATES.map((s) => (
          <figure key={s}>
            <PybaemRig static state={s} costume={costume} size={120} />
            <figcaption>{STATE_LABEL[s]}</figcaption>
          </figure>
        ))}
      </div>
      <div className="gallery small">
        {[24, 32, 48, 64, 96].map((sz) => (
          <figure key={sz}>
            <PybaemRig static state="happy" framing="avatar" costume={{ hat: 'crown' }} size={sz} />
            <figcaption>{sz}px</figcaption>
          </figure>
        ))}
        {(['A', 'B'] as RigStyle[]).map((st) => (
          <figure key={st}>
            <PybaemRig static state="cheer" style={st} costume={{ hat: st === 'A' ? 'explorer' : 'wizard', bg: st === 'A' ? 'island' : 'paper' }} size={96} />
            <figcaption>{st}안</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Runtimes() {
  return (
    <section className="card">
      <h2>같은 자리, 다른 런타임</h2>
      <p className="muted">
        왼쪽부터 지금 앱의 정적 SVG, 지금 쓰는 Lottie(lottie-web), 같은 JSON을 dotLottie(WASM·캔버스)로, 리그를 Lottie로 구워 낸 것, 그리고 Rive 공개
        샘플(MIT 저장소, 제3자 에셋)입니다. Rive 샘플은 우리 캐릭터가 아니라 런타임 동작 비교용입니다.
      </p>
      <div className="runtimes">
        <div className="rt">
          <div className="rt-stage">
            <PybaemSvg expression="happy" size={150} />
          </div>
          <div className="rt-title">현재: PybaemSvg (정적 + SMIL 깜빡임)</div>
          <div className="rt-note">표정 = 컴포넌트 교체, 전환은 페이드만</div>
        </div>
        <LottieWebCard />
        <DotLottieCard />
        <BakedLottieCard />
        <RiveAvatarCard />
        <RiveBirbCard />
      </div>
    </section>
  );
}

function App() {
  return (
    <main>
      <header>
        <div className="kicker">pyRoad · Phase 0 · P0-07</div>
        <h1>파이뱀 SVG 리그 프로토타입</h1>
        <p>
          표정·자세를 숫자 파라미터로 보고, 상태를 바꾸면 그 파라미터들이 스프링으로 이동합니다. 숨쉬기·깜빡임·점프(스쿼시&스트레치)·젤리·춤·말하기·따라보기는
          그 위에 겹치는 레이어라서, 어느 순간에 끊어도 튀지 않습니다.
        </p>
      </header>
      <Playground />
      <Runtimes />
      <StaticGallery />
      <footer>
        Rive 샘플: rive-app/rive-react <code>examples/public/avatars.riv</code>, rive-app/rive-wasm <code>birb.riv</code> (MIT 저장소, 비교용으로만 사용·커밋 안 함)
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
