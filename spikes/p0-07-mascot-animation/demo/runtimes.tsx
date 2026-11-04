// 비교 런타임 카드 (각 런타임은 동적 import로 지연 로드)
import { useEffect, useRef, useState } from 'react';

const LOTTIES = ['celebrating', 'entrance', 'level-up', 'project-complete'] as const;
export const BAKED_URL = '/assets/generated/pybaem-rig-baked.json';
export const BAKED_SM_URL = '/assets/generated/pybaem-rig-sm.json';
export const BAKED_MARKERS = ['idle', 'talk', 'think', 'happy', 'sad', 'cheer', 'dance'] as const;
const KO: Record<string, string> = {
  idle: '대기', talk: '말하기', think: '생각', happy: '기쁨', sad: '슬픔', cheer: '응원', dance: '춤',
  celebrating: '축하', entrance: '등장', 'level-up': '레벨업', 'project-complete': '완성',
};

function Card({ title, note, children, buttons }: { title: string; note: string; children: React.ReactNode; buttons?: React.ReactNode }) {
  return (
    <div className="rt">
      <div className="rt-stage">{children}</div>
      <div className="rt-title">{title}</div>
      <div className="rt-note">{note}</div>
      {buttons && <div className="rt-buttons">{buttons}</div>}
    </div>
  );
}

/** 저장소 Lottie 4종은 레이어 st·ks.a/r와 키프레임 i/o가 없어 lottie-web 5.13에서 아무것도 그리지 않는다 → 보정본 */
export function patchEasing<T>(d: T): T {
  const fix = (prop: unknown) => {
    const p = prop as { a?: number; k?: { e?: unknown; i?: unknown; o?: unknown }[] };
    if (p && p.a === 1 && Array.isArray(p.k))
      for (const k of p.k) if (k.e) {
        k.i ??= { x: [0.5], y: [0.5] };
        k.o ??= { x: [0.5], y: [0.5] };
      }
  };
  for (const l of (d as unknown as { layers: { st?: number; ks: Record<string, unknown>; shapes?: Record<string, unknown>[] }[] }).layers) {
    // 결함 ①: 레이어 st(시작 시각)와 ks.a/ks.r 기본값 누락 → 레이어가 계속 display:none
    l.st ??= 0;
    l.ks.a ??= { a: 0, k: [0, 0, 0] };
    l.ks.r ??= { a: 0, k: 0 };
    // 결함 ②: 키프레임 i/o(이징) 누락 → 보간 실패
    Object.values(l.ks).forEach(fix);
    for (const sh of l.shapes ?? []) Object.values(sh).forEach(fix);
  }
  return d;
}

export function LottieWebCard() {
  const box = useRef<HTMLDivElement>(null);
  const [name, setName] = useState<(typeof LOTTIES)[number]>('celebrating');
  const [fixed, setFixed] = useState(true);
  useEffect(() => {
    let anim: { destroy(): void } | null = null;
    let cancelled = false;
    (async () => {
      const [mod, data] = await Promise.all([
        import('lottie-web/build/player/lottie_svg'),
        fetch(`/repo-characters/pybaem/lottie/${name}.json`).then((r) => r.json()),
      ]);
      const lottie = ((mod as { default?: unknown }).default ?? mod) as typeof import('lottie-web').default;
      if (cancelled || !box.current) return;
      anim = lottie.loadAnimation({
        container: box.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: fixed ? patchEasing(data) : data,
      });
    })();
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [name, fixed]);
  return (
    <Card
      title="현재: Lottie (lottie-web SVG)"
      note={fixed ? '이징 보정본. 원본은 lottie-web에서 빈 화면이고, 내용도 파이뱀이 아닌 도형' : '원본 그대로: 레이어 st·키프레임 i/o 누락으로 아무것도 안 그려짐'}
      buttons={
        <>
          {LOTTIES.map((l) => (
            <button key={l} className={`mini${l === name ? ' on' : ''}`} onClick={() => setName(l)}>
              {KO[l]}
            </button>
          ))}
          <button className={`mini${!fixed ? ' on' : ''}`} onClick={() => setFixed(!fixed)}>
            원본
          </button>
        </>
      }
    >
      <div ref={box} style={{ width: 150, height: 150 }} />
    </Card>
  );
}

export function DotLottieCard() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState<(typeof LOTTIES)[number]>('level-up');
  useEffect(() => {
    let inst: { destroy(): void } | null = null;
    let cancelled = false;
    (async () => {
      const { DotLottie } = await import('@lottiefiles/dotlottie-web');
      DotLottie.setWasmUrl('/dist/wasm/dotlottie-player.wasm');
      if (cancelled || !canvas.current) return;
      inst = new DotLottie({ canvas: canvas.current, src: `/repo-characters/pybaem/lottie/${name}.json`, loop: true, autoplay: true });
    })();
    return () => {
      cancelled = true;
      inst?.destroy();
    };
  }, [name]);
  return (
    <Card
      title="dotLottie (WASM·캔버스)"
      note="같은 JSON을 ThorVG WASM으로 렌더. 상태머신·테마·슬롯 지원"
      buttons={LOTTIES.map((l) => (
        <button key={l} className={`mini${l === name ? ' on' : ''}`} onClick={() => setName(l)}>
          {KO[l]}
        </button>
      ))}
    >
      <canvas ref={canvas} width={300} height={300} style={{ width: 150, height: 150 }} />
    </Card>
  );
}

/** 리그를 Lottie로 구운 파일 + dotLottie 상태머신 (Tweened 전환) */
export function BakedLottieCard() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const inst = useRef<{
    stateMachineSetStringInput(n: string, v: string): boolean;
    stateMachineGetCurrentState(): string;
    destroy(): void;
  } | null>(null);
  const [cur, setCur] = useState('idle');
  const [err, setErr] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ DotLottie }, data, sm] = await Promise.all([
          import('@lottiefiles/dotlottie-web'),
          fetch(BAKED_URL).then((r) => r.text()),
          fetch(BAKED_SM_URL).then((r) => r.text()),
        ]);
        DotLottie.setWasmUrl('/dist/wasm/dotlottie-player.wasm');
        if (cancelled || !canvas.current) return;
        const d = new DotLottie({ canvas: canvas.current, data, autoplay: true, loop: true, marker: 'idle' });
        d.addEventListener('load', () => {
          const ok = d.stateMachineLoadData(sm) && d.stateMachineStart();
          if (!ok) setErr('상태머신 로드 실패 → setMarker로 전환');
        });
        inst.current = d as unknown as typeof inst.current;
        (window as unknown as { __baked: unknown }).__baked = d;
      } catch (e) {
        setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
      inst.current?.destroy();
    };
  }, []);
  const go = (m: string) => {
    setCur(m);
    const d = inst.current as unknown as { stateMachineSetStringInput?: (n: string, v: string) => boolean; setMarker(m: string): void };
    if (!d) return;
    if (!d.stateMachineSetStringInput?.('state', m)) d.setMarker(m);
  };
  return (
    <Card
      title="리그 → Lottie 굽기 + dotLottie 상태머신"
      note={err || '같은 파이뱀 동작을 프레임별 키로 구워 Tweened 전환으로 연결'}
      buttons={BAKED_MARKERS.map((m) => (
        <button key={m} className={`mini${m === cur ? ' on' : ''}`} onClick={() => go(m)}>
          {KO[m]}
        </button>
      ))}
    >
      <canvas ref={canvas} width={300} height={300} style={{ width: 150, height: 150 }} />
    </Card>
  );
}

type RiveInput = { name: string; value: boolean | number; fire?: () => void };
function useRive(
  file: string,
  artboard: string,
  sm: string,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
): React.RefObject<RiveInput[]> {
  const inputs = useRef<RiveInput[]>([]);
  useEffect(() => {
    let r: { cleanup(): void } | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import('@rive-app/canvas');
      const { Rive, RuntimeLoader } = ((mod as { default?: unknown }).default ?? mod) as typeof import('@rive-app/canvas');
      RuntimeLoader.setWasmUrl('/dist/wasm/rive-canvas.wasm');
      if (cancelled || !canvasRef.current) return;
      const inst = new Rive({
        src: `/assets/third-party/rive/${file}.riv`,
        canvas: canvasRef.current,
        artboard,
        stateMachine: sm,
        autoplay: true,
        onLoad: () => {
          inst.resizeDrawingSurfaceToCanvas();
          inputs.current = inst.stateMachineInputs(sm) as unknown as RiveInput[];
        },
      });
      r = inst;
    })();
    return () => {
      cancelled = true;
      r?.cleanup();
    };
  }, [file, artboard, sm, canvasRef]);
  return inputs;
}

export function RiveAvatarCard() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const inputs = useRive('avatars', 'Avatar 1', 'avatar', canvas);
  const [cur, setCur] = useState('idle');
  const set = (s: 'idle' | 'happy' | 'sad') => {
    setCur(s);
    for (const i of inputs.current) {
      if (i.name === 'isHappy') i.value = s === 'happy';
      if (i.name === 'isSad') i.value = s === 'sad';
    }
  };
  return (
    <Card
      title="Rive 샘플: avatars.riv (14.7KB)"
      note="상태머신 입력 isHappy/isSad. 전환 블렌딩은 에디터에서 정함"
      buttons={(['idle', 'happy', 'sad'] as const).map((s) => (
        <button key={s} className={`mini${s === cur ? ' on' : ''}`} onClick={() => set(s)}>
          {KO[s]}
        </button>
      ))}
    >
      <canvas ref={canvas} width={300} height={300} style={{ width: 150, height: 150 }} />
    </Card>
  );
}

export function RiveBirbCard() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const inputs = useRive('birb', 'birb', 'birb', canvas);
  const [dance, setDance] = useState(false);
  return (
    <Card
      title="Rive 샘플: birb.riv (412KB, PNG 16장)"
      note="클레이 느낌 캐릭터. 래스터 이미지 + 메시 변형"
      buttons={
        <>
          <button
            className={`mini${dance ? ' on' : ''}`}
            onClick={() => {
              const d = !dance;
              setDance(d);
              inputs.current.forEach((i) => i.name === 'dance' && (i.value = d));
            }}
          >
            춤
          </button>
          <button className="mini" onClick={() => inputs.current.forEach((i) => i.name === 'look up' && i.fire?.())}>
            위 보기
          </button>
        </>
      }
    >
      <canvas ref={canvas} width={300} height={300} style={{ width: 150, height: 150 }} />
    </Card>
  );
}
