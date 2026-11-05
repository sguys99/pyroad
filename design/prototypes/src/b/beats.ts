// 시안 B 시그니처 모션 비트 (P2-05): 스테이지 해제 · 퀘스트 성공 · 레벨업
// 장면마다 build(els, m) → SceneSpec. 같은 빌더를 #motion 무대와 실제 흐름(퀘스트 보상·월드맵 해제)이 함께 쓴다.
// 스프링은 무드보드 7종만: body(도장 안착·이름표·카드), prop(별·코인·HUD 숫자), jellyB(버튼 복귀), face(lite 복귀). 새 스프링 없음.
import { springTiming } from '../shared/motion';
import { EASING } from '../shared/tokens';
import { anim, easeOut3, fade, snap, type BeatInfo, type Cue, type M, type SceneSpec } from './timeline';
import { BLOT } from './fx';

const ROUND = 'radial-gradient(circle, #000 49%, transparent 50%)';
type Fac = () => Animation | null | (Animation | null)[];

/** 장면 빌더 공통: 애니메이션 공장·비트 기록·큐 */
class Builder {
  facs: Fac[] = [];
  beats: BeatInfo[] = [];
  cues: Cue[] = [];
  resets: (() => void)[] = [];
  constructor(public m: M) {}
  get lite() {
    return !this.m.reduced && this.m.tier === 'lite';
  }
  get minimal() {
    return !this.m.reduced && this.m.tier === 'minimal';
  }
  get still() {
    return this.m.reduced;
  }
  /** 단계별 길이: lite 70% */
  d(ms: number) {
    return this.lite ? Math.round(ms * 0.7) : ms;
  }
  beat(id: string, label: string, start: number, dur: number, ease: string, lane = 0) {
    this.beats.push({ id, label, start: Math.round(start), dur: Math.round(dur), ease, lane });
  }
  a(f: Fac) {
    this.facs.push(f);
  }
  cue(at: number, apply: (p: number) => void, dur?: number) {
    this.cues.push({ at, apply, dur });
  }
  reset(f: () => void) {
    this.resets.push(f);
  }
  spec(total: number): SceneSpec {
    return {
      total: Math.round(total),
      beats: this.beats,
      reset: () => this.resets.forEach((r) => r()),
      animate: () => this.facs.flatMap((f) => [f()].flat()).filter((x): x is Animation => !!x),
      cues: this.cues,
    };
  }
}

// ───────────── 공통 비트

/** 스탬프 쾅: 가속 내려찍기 220ms(stampIn) → body 스프링 안착 + 종이 흔들림 120ms steps(3) + 잉크 튐 */
function stamp(b: Builder, el: Element | null, at: number, rot: number, opt: { paper?: Element | null; splats?: Element[]; label?: string; lane?: number } = {}) {
  const lane = opt.lane ?? 0;
  const label = opt.label ?? '스탬프 쾅';
  const hidden = { opacity: 0, transform: `rotate(${rot}deg)` };
  const shown = { opacity: 1, transform: `rotate(${rot}deg)` };
  if (b.still) {
    b.a(() => snap(el, at, shown, hidden));
    b.beat('stamp', `${label} (즉시)`, at, 0, '즉시', lane);
    return at;
  }
  if (b.minimal) {
    b.a(() => fade(el, at, shown, hidden));
    b.beat('stamp', `${label} (페이드)`, at, 150, 'linear', lane);
    return at + 150;
  }
  const d1 = b.lite ? 160 : 220;
  const sp = springTiming('body');
  b.a(() => anim(el, [{ transform: `scale(2.3) rotate(${rot - 14}deg)`, opacity: 0 }, { transform: `scale(0.9) rotate(${rot - 2}deg)`, opacity: 1 }], at, d1, EASING.stampIn, 'backwards'));
  b.a(() => anim(el, [{ transform: `scale(0.9) rotate(${rot - 2}deg)`, opacity: 1 }, shown], at + d1, sp.duration, sp.easing, 'forwards'));
  b.beat('stamp', label, at, d1, 'stampIn', lane);
  b.beat('stamp-settle', '안착', at + d1, sp.duration, 'body', lane);
  if (!b.lite) {
    if (opt.paper)
      b.a(() =>
        anim(opt.paper, [{ transform: 'translate(0,0)' }, { transform: 'translate(2px,1px)' }, { transform: 'translate(-2px,0)' }, { transform: 'translate(0,0)' }], at + d1, 120, 'steps(3, end)', 'none'),
      );
    opt.splats?.forEach((s, i) => {
      const a = (i / Math.max(1, opt.splats!.length)) * Math.PI * 2 + 0.5;
      const dist = 46 + (i % 3) * 12;
      b.a(() =>
        anim(
          s,
          [
            { transform: 'translate(0,0) scale(0.4)', opacity: 1 },
            { transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) scale(1)`, opacity: 1, offset: 0.6 },
            { transform: `translate(${Math.cos(a) * dist * 1.06}px, ${Math.sin(a) * dist * 1.06}px) scale(1)`, opacity: 0 },
          ],
          at + d1,
          620,
          EASING.out,
          'none',
        ),
      );
    });
    if (opt.splats?.length) b.beat('splat', '잉크 튐', at + d1, 620, 'out', lane + 1);
  }
  return at + d1 + sp.duration;
}

/** 팝 등장 (body 스프링). lite는 face(덜 튐), minimal 페이드, 동작 줄이기 즉시 */
function pop(b: Builder, el: Element | null, at: number, id: string, label: string, lane = 0, spring: 'body' | 'prop' = 'body') {
  if (b.still) {
    b.a(() => snap(el, at, { opacity: 1, transform: 'none' }, { opacity: 0, transform: 'none' }));
    b.beat(id, `${label} (즉시)`, at, 0, '즉시', lane);
    return at;
  }
  if (b.minimal) {
    b.a(() => fade(el, at, { opacity: 1, transform: 'none' }, { opacity: 0, transform: 'none' }));
    b.beat(id, label, at, 150, 'linear', lane);
    return at + 150;
  }
  const sp = springTiming(b.lite ? 'face' : spring);
  b.a(() =>
    anim(el, [{ transform: 'translateY(10px) scale(0.55) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1, offset: 0.2 }, { transform: 'none', opacity: 1 }], at, sp.duration, sp.easing, 'both'),
  );
  b.beat(id, label, at, sp.duration, b.lite ? 'face' : spring, lane);
  return at + sp.duration;
}

/** 잉크 번짐 (마스크 크기 0 → size). full 얼룩 모양, lite 동그라미, minimal 페이드, 동작 줄이기 즉시 */
function ink(b: Builder, el: HTMLElement | null, at: number, origin: string, size: string, id: string, label: string, lane = 0, ms = 800) {
  if (!el) return at;
  const s = el.style as CSSStyleDeclaration & Record<string, string>;
  b.reset(() => {
    s.maskImage = s.webkitMaskImage = b.lite ? ROUND : BLOT;
    s.maskPosition = s.webkitMaskPosition = origin;
    s.maskRepeat = s.webkitMaskRepeat = 'no-repeat';
    s.maskSize = s.webkitMaskSize = size;
    if (b.still || b.minimal) s.maskImage = s.webkitMaskImage = 'none';
  });
  if (b.still) {
    b.a(() => snap(el, at, { opacity: 1 }, { opacity: 0 }));
    b.beat(id, `${label} (즉시)`, at, 0, '즉시', lane);
    return at;
  }
  if (b.minimal) {
    b.a(() => fade(el, at));
    b.beat(id, label, at, 150, 'linear', lane);
    return at + 150;
  }
  const d = b.lite ? 360 : ms;
  b.a(() => anim(el, [{ maskSize: '0px 0px', webkitMaskSize: '0px 0px' } as Keyframe, { maskSize: size, webkitMaskSize: size } as Keyframe], at, d, EASING.ink, 'both'));
  b.beat(id, label, at, d, b.lite ? 'ink (동그라미)' : 'ink', lane);
  return at + d;
}

/** 잉크 방울 떨어짐 280ms (full만) */
function drop(b: Builder, el: Element | null, at: number, lane = 0) {
  if (b.still || b.minimal || b.lite || !el) return at;
  b.a(() =>
    anim(
      el,
      [
        { transform: 'translateY(-90px) rotate(-45deg)', opacity: 1 },
        { transform: 'translateY(0) rotate(-45deg)', opacity: 1, offset: 0.85 },
        { transform: 'translateY(0) rotate(-45deg) scale(1.8)', opacity: 0 },
      ],
      at,
      280,
      'cubic-bezier(0.5,0,1,0.6)',
      'none',
    ),
  );
  b.beat('drop', '잉크 방울', at, 280, '가속', lane);
  return at + 280;
}

/** 길 그리기 (stroke-dashoffset) */
function road(b: Builder, path: SVGPathElement | null, at: number, lane = 0) {
  if (!path) return at;
  const len = path.getTotalLength();
  b.reset(() => {
    path.style.strokeDasharray = `${len} ${len}`;
  });
  if (b.still) {
    b.a(() => snap(path, at, { strokeDashoffset: 0, opacity: 1 }, { strokeDashoffset: len, opacity: 1 }));
    b.beat('road', '잉크 길 (즉시)', at, 0, '즉시', lane);
    return at;
  }
  if (b.minimal) {
    b.a(() => anim(path, [{ strokeDashoffset: 0, opacity: 0 }, { strokeDashoffset: 0, opacity: 1 }], at, 150, 'linear'));
    b.beat('road', '잉크 길 (페이드)', at, 150, 'linear', lane);
    return at + 150;
  }
  const d = b.lite ? 400 : 900;
  b.a(() => anim(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], at, d, EASING.ink));
  b.beat('road', '잉크 길 그리기', at, d, 'ink', lane);
  return at + d;
}

/** 큐로 글자 바꾸기 (숫자 올리기 포함) */
function countCue(b: Builder, el: Element | null, at: number, from: number, to: number, dur: number, fmt = (v: number) => v.toLocaleString('ko-KR')) {
  if (!el) return;
  b.reset(() => (el.textContent = fmt(from)));
  const d = b.still || b.minimal ? 0 : dur;
  b.cue(at, (p) => (el.textContent = fmt(Math.round(from + (to - from) * easeOut3(p)))), d || undefined);
}

/** 화면 위 두 점 사이 포물선 비행 (코인·스티커). 단계별 개수 상한: full n, lite 30%, minimal·동작 줄이기 0 */
function flyCount(b: Builder, n: number) {
  if (b.still || b.minimal) return 0;
  return b.lite ? Math.max(1, Math.round(n * 0.3)) : n;
}
function fly(b: Builder, el: Element, at: number, from: { x: number; y: number }, to: { x: number; y: number }, dur: number, arc = 70, spin = 0) {
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - arc };
  b.a(() =>
    anim(
      el,
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(0.6) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${from.x}px, ${from.y - 18}px) scale(1.15) rotate(${spin * 0.2}deg)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${mid.x}px, ${mid.y}px) scale(1) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(0.7) rotate(${spin}deg)`, opacity: 1, offset: 0.97 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(0.6) rotate(${spin}deg)`, opacity: 0 },
      ],
      at,
      dur,
      EASING.inOut,
      'none',
    ),
  );
}

/** HUD 칩 팝 (prop 스프링, 살짝 기울며) */
function hudPop(b: Builder, el: Element | null, at: number, lane: number) {
  if (!el || b.still || b.minimal) return;
  // 실제 HUD는 자기 숫자가 바뀌면 스스로 팝하므로 장면 HUD에서만
  const sp = springTiming('prop');
  b.a(() => anim(el, [{ transform: 'scale(1.25) rotate(-5deg)' }, { transform: 'none' }], at, sp.duration, sp.easing, 'none'));
  b.beat('hud', 'HUD 팝', at, sp.duration, 'prop', lane);
}

function rel(el: Element, host: Element) {
  const r = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
}

// ═════════════ 1. 스테이지 해제

export interface UnlockEls {
  paper: HTMLElement;
  stamp: HTMLElement;
  splats: HTMLElement[];
  path: SVGPathElement;
  inkLayer: HTMLElement;
  inkOrigin: string; // 마스크 위치 (잉크 상자 기준 %)
  inkSize: string; // 번진 뒤 마스크 크기
  drop: HTMLElement;
  lock: HTMLElement;
  py: HTMLElement;
  /** 파이뱀이 지나갈 길 위의 점들 (py의 처음 자리 기준 px 이동량) */
  pyPts: { x: number; y: number }[];
  plate: HTMLElement;
  banner: HTMLElement;
  onRig: (s: 'idle' | 'happy' | 'cheer' | 'talk') => void;
  onOpen: (open: boolean) => void;
}

export function buildUnlock(e: UnlockEls, m: M): SceneSpec {
  const b = new Builder(m);
  b.reset(() => {
    e.onOpen(false);
    e.onRig('idle');
  });
  // ① 지금 스테이지 통과 도장
  stamp(b, e.stamp, 0, -12, { paper: e.paper, splats: e.splats, label: '통과 도장 쾅' });
  // ② 다음 스테이지까지 잉크 길
  const roadAt = b.still ? 300 : b.minimal ? 200 : b.lite ? 350 : 450;
  const roadEnd = road(b, e.path, roadAt, 1);
  // ③ 잉크 방울 → 연필 스케치였던 스테이지가 잉크·물감으로 깨어남 + 자물쇠 떨어짐
  const dropEnd = drop(b, e.drop, roadEnd - 100, 2);
  const wakeAt = b.still ? 600 : b.minimal ? 400 : b.lite ? roadEnd : dropEnd - 20;
  const wakeEnd = ink(b, e.inkLayer, wakeAt, e.inkOrigin, e.inkSize, 'wake', '스테이지가 깨어남 (잉크 번짐)', 2);
  if (b.still) b.a(() => snap(e.lock, wakeAt, { opacity: 0 }, { opacity: 1 }));
  else if (b.minimal) b.a(() => fade(e.lock, wakeAt, { opacity: 0 }, { opacity: 1 }));
  else {
    const d = b.d(520);
    b.a(() =>
      anim(
        e.lock,
        [
          { transform: 'none', opacity: 1 },
          { transform: 'translateY(-10px) rotate(-12deg)', opacity: 1, offset: 0.25 },
          { transform: 'translateY(34px) rotate(38deg)', opacity: 0 },
        ],
        wakeAt,
        d,
        'cubic-bezier(0.5, 0, 0.9, 0.5)',
      ),
    );
    b.beat('lock', '자물쇠 툭', wakeAt, d, '가속', 3);
  }
  // ④ 파이뱀이 새 스테이지로 (full 깡충 3번, lite 미끄러짐, minimal·동작 줄이기 순간 이동)
  const pyAt = b.still ? 600 : b.minimal ? 550 : b.lite ? wakeEnd - 100 : wakeEnd - 200;
  const pts = e.pyPts;
  const last = pts[pts.length - 1];
  let pyEnd = pyAt;
  if (b.still || b.minimal) {
    b.a(() => snap(e.py, pyAt, { transform: `translate(${last.x}px, ${last.y}px)` }, { transform: 'translate(0px, 0px)' }));
    b.beat('py', '파이뱀 이동 (순간)', pyAt, 0, '즉시', 3);
  } else if (b.lite) {
    const d = 500;
    b.a(() => anim(e.py, [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${last.x}px, ${last.y}px)` }], pyAt, d, EASING.out));
    b.beat('py', '파이뱀 미끄러져 이동', pyAt, d, 'out', 3);
    pyEnd = pyAt + d;
  } else {
    const d = 960;
    const hops = 3;
    const kf: Keyframe[] = pts.map((p, i) => {
      const t = i / (pts.length - 1);
      const hop = Math.abs(Math.sin(t * Math.PI * hops)) * 26;
      const squash = i === pts.length - 1 ? 'scale(1.12, 0.88)' : 'scale(1)';
      return { transform: `translate(${p.x}px, ${p.y - hop}px) ${squash}`, offset: t * 0.92 };
    });
    kf.push({ transform: `translate(${last.x}px, ${last.y}px) scale(1)`, offset: 1 });
    b.a(() => anim(e.py, kf, pyAt, d, 'linear'));
    b.beat('py', '파이뱀 깡충 이동 (3번)', pyAt, d, 'linear + 착지 눌림', 3);
    pyEnd = pyAt + d;
  }
  b.cue(pyAt, () => e.onRig('happy'));
  b.cue(pyEnd, () => e.onRig('cheer'));
  // ⑤ 이름표·별 진행 등장 + "열렸어요!" 도장
  b.cue(pyEnd - (b.still || b.minimal ? 0 : 120), () => e.onOpen(true));
  const plateEnd = pop(b, e.plate, pyEnd - (b.still || b.minimal ? 0 : 120), 'plate', '이름표·별 진행 팝', 0);
  const bannerEnd = stamp(b, e.banner, pyEnd + (b.still ? 0 : b.minimal ? 100 : 120), -5, { label: '"열렸어요!" 도장', lane: 4 });
  return b.spec(Math.max(plateEnd, bannerEnd) + (b.still ? 400 : 250));
}

// ═════════════ 2. 퀘스트 성공

export interface SuccessEls {
  host: HTMLElement; // 비행 좌표 기준
  btnFace: HTMLElement | null;
  slip: HTMLElement | null;
  stamp: HTMLElement | null;
  paper: HTMLElement | null;
  splats: HTMLElement[];
  leaf: HTMLElement | null; // 넘어가는 공책 장 (없으면 넘김 생략: 실제 흐름)
  stars: HTMLElement[]; // 채워질 별 (n개만)
  coinFrom: HTMLElement;
  coins: HTMLElement[]; // 미리 만든 코인 (최대 개수)
  coinChip: HTMLElement; // HUD 코인 칩
  coinNum: HTMLElement | null; // 장면 HUD 숫자 (실제 흐름은 onCoins)
  xpFill: HTMLElement | null;
  xpFrom: number;
  xpTo: number; // 0~1
  plus: HTMLElement | null; // "+25" 배지
  cta: HTMLElement | null;
  coinsFrom: number;
  coinsTo: number;
  onRig?: (s: 'idle' | 'cheer' | 'happy' | 'talk') => void;
  onCoins?: (v: number) => void;
  onXp?: () => void;
}

export function buildSuccess(e: SuccessEls, m: M, nStars: number): SceneSpec {
  const b = new Builder(m);
  b.reset(() => e.onRig?.('talk'));
  let t = 0;
  const stageMode = !!e.leaf;
  if (stageMode) {
    // ① 실행 버튼 꾹 (누름 70ms press → jellyB 복귀)
    if (!b.still && !b.minimal && e.btnFace) {
      b.a(() => anim(e.btnFace, [{ transform: 'none' }, { transform: 'translateY(5px)' }], 0, 70, EASING.press, 'none'));
      const sp = springTiming(b.lite ? 'face' : 'jellyB');
      b.a(() => anim(e.btnFace, [{ transform: b.lite ? 'translateY(3px)' : 'translateY(4px) scale(1.03, 0.96)' }, { transform: 'none' }], 70, sp.duration, sp.easing, 'none'));
      b.beat('press', '실행 버튼 꾹', 0, 70 + sp.duration, b.lite ? 'press → face' : 'press → jellyB', 0);
    }
    // ② 결과 쪽지에 잉크 번짐
    const slipAt = b.still ? 0 : 150;
    const slipEnd = ink(b, e.slip, slipAt, '10% 30%', '320% 320%', 'out', '나온 글자 잉크 번짐', 1, 700);
    // ③ 판정 도장
    const stAt = b.still ? 0 : b.minimal ? 300 : Math.min(slipEnd, b.lite ? 550 : 800);
    stamp(b, e.stamp, stAt, -9, { paper: e.paper, splats: e.splats, label: '"통과!" 도장 쾅', lane: 2 });
    // ④ 쪽 넘김 → 보상 쪽
    const turnAt = b.still ? 300 : b.minimal ? 600 : b.lite ? 900 : 1350;
    if (b.still) {
      b.a(() => snap(e.leaf, turnAt, { opacity: 0 }, { opacity: 1 }));
      b.beat('turn', '보상 쪽 (즉시)', turnAt, 0, '즉시', 0);
      t = turnAt;
    } else if (b.minimal) {
      b.a(() => fade(e.leaf, turnAt, { opacity: 0 }, { opacity: 1 }));
      b.beat('turn', '보상 쪽 (페이드)', turnAt, 150, 'linear', 0);
      t = turnAt + 150;
    } else if (b.lite) {
      b.a(() => anim(e.leaf, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-24px)', opacity: 0 }], turnAt, 260, EASING.out));
      b.beat('turn', '공책 밀어내기 (넘김 대신)', turnAt, 260, 'out', 0);
      t = turnAt + 260;
    } else {
      b.a(() => anim(e.leaf, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], turnAt, 700, EASING.page));
      const shade = e.leaf?.querySelector('.bm-leaf-shade');
      b.a(() => anim(shade, [{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }], turnAt, 700, 'linear', 'none'));
      b.beat('turn', '쪽 넘김 → 보상 쪽', turnAt, 700, 'page', 0);
      t = turnAt + 450;
    }
  }
  // ⑤ 파이뱀 반응
  b.cue(t, () => e.onRig?.('cheer'));
  b.beat('py', '파이뱀 환호', t, b.still ? 0 : 900, '리그 cheer', 3);
  // ⑥ 별이 하나씩 도장처럼
  const gap = b.still ? 0 : b.minimal ? 120 : b.lite ? 240 : 340;
  const starAt = t + (b.still ? 0 : 250);
  e.stars.slice(0, nStars).forEach((s, i) => {
    const at = starAt + i * gap;
    if (b.still) b.a(() => snap(s, at, { opacity: 1, transform: 'none' }, { opacity: 0, transform: 'none' }));
    else if (b.minimal) b.a(() => fade(s, at, { opacity: 1, transform: 'none' }, { opacity: 0, transform: 'none' }));
    else {
      const d1 = b.lite ? 150 : 200;
      const sp = springTiming(b.lite ? 'face' : 'prop');
      b.a(() => anim(s, [{ transform: 'scale(2.4) rotate(-30deg)', opacity: 0 }, { transform: 'scale(0.85) rotate(4deg)', opacity: 1 }], at, d1, EASING.stampIn, 'backwards'));
      b.a(() => anim(s, [{ transform: 'scale(0.85) rotate(4deg)' }, { transform: 'none' }], at + d1, sp.duration, sp.easing, 'forwards'));
    }
  });
  const starsEnd = starAt + Math.max(0, nStars - 1) * gap + (b.still ? 0 : b.minimal ? 150 : 200);
  b.beat('stars', `별 ${nStars}개 하나씩`, starAt, starsEnd - starAt + (b.still || b.minimal ? 0 : 400), b.still ? '즉시' : b.minimal ? 'linear' : 'stampIn → prop', 1);
  // ⑦ 코인이 HUD로 (포물선 520ms inOut, 60ms 간격) → HUD 팝 + 숫자 올리기, XP 바 채움
  const coinAt = starsEnd + (b.still ? 0 : 150);
  const n = flyCount(b, e.coins.length);
  const from = rel(e.coinFrom, e.host);
  const to = rel(e.coinChip, e.host);
  const flyD = b.lite ? 420 : 520;
  for (let i = 0; i < n; i++) fly(b, e.coins[i], coinAt + i * 60, { x: from.x + (i - n / 2) * 6, y: from.y }, to, flyD, 80 + i * 8, 0);
  if (n) b.beat('coins', `코인 ${n}개 → HUD`, coinAt, flyD + (n - 1) * 60, 'inOut 포물선', 2);
  const arrive = n ? coinAt + flyD : coinAt;
  if (e.coinNum) hudPop(b, e.coinChip, arrive, 3);
  if (e.coinNum) countCue(b, e.coinNum, arrive, e.coinsFrom, e.coinsTo, 600);
  if (e.onCoins) {
    const cb = e.onCoins;
    b.cue(arrive, () => cb(e.coinsTo));
    b.reset(() => cb(e.coinsFrom));
  }
  if (e.plus) pop(b, e.plus, arrive, 'plus', '"+코인" 배지', 4, 'prop');
  // XP 바
  if (e.xpFill) {
    const f = e.xpFill;
    if (b.still) b.a(() => snap(f, arrive, { transform: `scaleX(${e.xpTo})` }, { transform: `scaleX(${e.xpFrom})` }));
    else b.a(() => anim(f, [{ transform: `scaleX(${e.xpFrom})` }, { transform: `scaleX(${e.xpTo})` }], arrive, b.minimal ? 150 : b.d(600), EASING.out));
    b.beat('xp', 'XP 바 채움', arrive, b.still ? 0 : b.minimal ? 150 : b.d(600), 'out', 4);
  }
  if (e.onXp) b.cue(arrive, e.onXp);
  // ⑧ 다음 행동
  const ctaAt = arrive + (b.still ? 0 : b.minimal ? 200 : b.lite ? 450 : 650);
  const end = pop(b, e.cta, ctaAt, 'cta', '"다음 퀘스트" 버튼', 0);
  b.cue(ctaAt + 300, () => e.onRig?.('happy'));
  return b.spec(end + 200);
}

// ═════════════ 3. 레벨업

export interface LevelUpEls {
  host: HTMLElement;
  xpFill: HTMLElement;
  xpNum: HTMLElement;
  drip: HTMLElement;
  seal: HTMLElement;
  sealNum: HTMLElement;
  ring: HTMLElement;
  title: HTMLElement;
  confetti: HTMLElement[];
  star: HTMLElement; // 별똥이 감싼 요소
  starFrom: { x: number; y: number }; // star 처음 자리 기준 이동량 (px)
  bubble: HTMLElement;
  titleCard: HTMLElement;
  sticker: HTMLElement;
  cta: HTMLElement;
  from: { lv: number; xp: number; next: number };
  gain: number;
  onRig: (s: 'idle' | 'dance' | 'happy' | 'cheer') => void;
  onStar: (mood: 'flying' | 'landing' | 'sparkling') => void;
}

export function buildLevelUp(e: LevelUpEls, m: M): SceneSpec {
  const b = new Builder(m);
  const over = e.from.xp + e.gain - e.from.next; // 넘친 XP
  const nextNext = 600;
  b.reset(() => {
    e.sealNum.textContent = String(e.from.lv);
    e.onRig('idle');
    e.onStar('flying');
  });
  // ① XP 바가 차서 넘침
  const fillD = b.still ? 0 : b.minimal ? 150 : b.d(700);
  const p0 = e.from.xp / e.from.next;
  if (b.still) b.a(() => snap(e.xpFill, 0, { transform: 'scaleX(1)' }, { transform: `scaleX(${p0})` }));
  else b.a(() => anim(e.xpFill, [{ transform: `scaleX(${p0})` }, { transform: 'scaleX(1)' }], 0, fillD, EASING.inOut, 'backwards'));
  countCue(b, e.xpNum, 0, e.from.xp, e.from.next, fillD, (v) => `${v} / ${e.from.next}`);
  b.beat('fill', 'XP 바 가득', 0, fillD, 'inOut', 0);
  // 넘침: 바 끝에서 잉크 한 방울이 도장으로 (full)
  let t = fillD;
  if (!b.still && !b.minimal && !b.lite) {
    const a0 = rel(e.drip, e.host);
    const a1 = rel(e.seal, e.host);
    const dx = `${a1.x - a0.x}px`;
    const dy = `${a1.y - a0.y}px`;
    b.a(() =>
      anim(
        e.drip,
        [
          { transform: 'translate(0,0) scale(0.6)', opacity: 1 },
          { transform: 'translate(0, 6px) scale(1.1, 1.3)', opacity: 1, offset: 0.3 },
          { transform: `translate(${dx}, ${dy}) scale(1)`, opacity: 1, offset: 0.92 },
          { transform: `translate(${dx}, ${dy}) scale(1.6)`, opacity: 0 },
        ],
        t - 60,
        420,
        'cubic-bezier(0.5, 0, 0.9, 0.6)',
        'none',
      ),
    );
    b.beat('drip', '넘친 잉크 방울', t - 60, 420, '가속', 1);
    t += 360;
  } else if (b.lite) t += 80;
  // ② 레벨 도장 변신: 책장처럼 뒤집히며 숫자 교체 → 잉크 고리
  const lv2 = e.from.lv + 1;
  if (b.still || b.minimal) {
    b.cue(t, () => (e.sealNum.textContent = String(lv2)));
    if (b.minimal) b.a(() => anim(e.seal, [{ opacity: 0.3 }, { opacity: 1 }], t, 150, 'linear', 'none'));
    b.beat('seal', `레벨 도장 ${e.from.lv} → ${lv2} (${b.still ? '즉시, 색 바뀜' : '페이드'})`, t, b.still ? 0 : 150, b.still ? '즉시' : 'linear', 2);
    if (b.still) b.a(() => snap(e.seal, t, { boxShadow: '0 0 0 6px var(--c-highlight)' }, { boxShadow: '0 0 0 0 transparent' }));
    t += b.still ? 0 : 150;
  } else {
    const half = b.lite ? 160 : 220;
    b.a(() => anim(e.seal, [{ transform: 'none' }, { transform: 'scale(1.18) rotateY(90deg)' }], t, half, EASING.inOut, 'none'));
    b.cue(t + half, () => (e.sealNum.textContent = String(lv2)));
    b.reset(() => (e.sealNum.textContent = String(e.from.lv)));
    const sp = springTiming('body');
    b.a(() => anim(e.seal, [{ transform: 'scale(1.18) rotateY(-90deg)' }, { transform: 'none' }], t + half, sp.duration, sp.easing, 'none'));
    b.beat('seal', `레벨 도장 뒤집기 ${e.from.lv} → ${lv2}`, t, half * 2, 'inOut → body', 2);
    if (!b.lite) {
      b.a(() => anim(e.ring, [{ transform: 'scale(0.5)', opacity: 0.9 }, { transform: 'scale(2.6)', opacity: 0 }], t + half, 760, EASING.ink, 'none'));
      b.beat('ring', '잉크 고리 번짐', t + half, 760, 'ink', 3);
    }
    t += half + 120;
  }
  // ③ "레벨 5!" 잉크 번짐 + 종이 조각
  const titleEnd = ink(b, e.title, t, '50% 50%', '360% 360%', 'title', '"레벨 업!" 잉크 번짐', 0, 800);
  b.cue(t, () => e.onRig('dance'));
  const nConf = b.still || b.minimal ? 0 : b.lite ? Math.round(e.confetti.length * 0.3) : e.confetti.length;
  for (let i = 0; i < nConf; i++) {
    const c = e.confetti[i];
    const a = -Math.PI / 2 + ((i / nConf) - 0.5) * Math.PI * 1.5;
    const dist = 120 + ((i * 37) % 90);
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist;
    const rot = ((i * 73) % 360) - 180;
    b.a(() =>
      anim(
        c,
        [
          { transform: 'translate(0,0) rotate(0deg) scale(0.4)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx * 1.1}px, ${dy + 70}px) rotate(${rot * 1.6}deg) scale(0.9)`, opacity: 0 },
        ],
        t + (i % 4) * 25,
        b.lite ? 800 : 1100,
        EASING.out,
        'none',
      ),
    );
  }
  if (nConf) b.beat('confetti', `종이 조각 ${nConf}개`, t, b.lite ? 875 : 1175, 'out', 1);
  // ④ 별똥이 날아옴 (보상 안내 요정)
  const starAt = b.still ? t : b.minimal ? t + 150 : titleEnd - 300;
  let starEnd = starAt;
  if (b.still) {
    b.a(() => snap(e.star, starAt, { transform: 'none', opacity: 1 }, { transform: 'none', opacity: 0 }));
    b.beat('star', '별똥이 등장 (즉시)', starAt, 0, '즉시', 3);
  } else if (b.minimal) {
    b.a(() => fade(e.star, starAt, { transform: 'none', opacity: 1 }, { transform: 'none', opacity: 0 }));
    b.beat('star', '별똥이 등장 (페이드)', starAt, 150, 'linear', 3);
    starEnd = starAt + 150;
  } else {
    const d = b.lite ? 500 : 760;
    const f = e.starFrom;
    b.a(() =>
      anim(
        e.star,
        b.lite
          ? [{ transform: `translate(${f.x}px, ${f.y}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }]
          : [
              { transform: `translate(${f.x}px, ${f.y}px) rotate(-30deg) scale(0.6)`, opacity: 0 },
              { transform: `translate(${f.x * 0.55}px, ${f.y * 0.2 - 40}px) rotate(-10deg) scale(1)`, opacity: 1, offset: 0.45 },
              { transform: 'translate(0px, -10px) rotate(8deg) scale(1)', opacity: 1, offset: 0.85 },
              { transform: 'translate(0, 0) rotate(0deg) scale(1.1, 0.9)', opacity: 1, offset: 0.93 },
              { transform: 'none', opacity: 1 },
            ],
        starAt,
        d,
        b.lite ? EASING.out : EASING.inOut,
        'both',
      ),
    );
    b.beat('star', '별똥이 날아와 착지', starAt, d, b.lite ? 'out' : 'inOut 곡선', 3);
    starEnd = starAt + d;
  }
  b.cue(starAt, () => e.onStar('flying'));
  b.cue(starEnd, () => e.onStar('landing'));
  b.cue(starEnd + 500, () => e.onStar('sparkling'));
  // ⑤ 별똥이 말풍선 → 새 칭호 카드 도장 → 새 꾸미기 스티커
  const bubEnd = pop(b, e.bubble, starEnd + (b.still ? 0 : 60), 'bubble', '별똥이 말풍선', 4);
  const cardAt = b.still ? starEnd : bubEnd - (b.minimal ? 0 : 450);
  const cardEnd = stamp(b, e.titleCard, cardAt, -3, { label: '새 칭호 카드 도장', lane: 0 });
  const stkAt = b.still ? cardAt : cardAt + (b.minimal ? 150 : b.lite ? 300 : 420);
  pop(b, e.sticker, stkAt, 'sticker', '새로 열린 꾸미기 (스티커)', 2, 'prop');
  // ⑥ XP 바 새 레벨로 비우고 다시 채움
  const resetAt = b.still ? cardAt : cardEnd - 200;
  const p1 = over / nextNext;
  if (b.still) b.a(() => snap(e.xpFill, resetAt, { transform: `scaleX(${p1})` }, { transform: 'scaleX(1)' }));
  else
    b.a(() =>
      anim(e.xpFill, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)', offset: 0.35 }, { transform: `scaleX(${p1})` }], resetAt, b.minimal ? 150 : b.d(700), EASING.out, 'forwards'),
    );
  b.cue(resetAt, () => (e.xpNum.textContent = `${over} / ${nextNext}`));
  b.beat('xp-reset', `새 레벨 XP ${over}/${nextNext}`, resetAt, b.still ? 0 : b.minimal ? 150 : b.d(700), 'out', 4);
  b.cue(resetAt + 200, () => e.onRig('happy'));
  const ctaEnd = pop(b, e.cta, resetAt + (b.still ? 0 : b.minimal ? 150 : 500), 'cta', '"좋아!" 버튼', 1);
  return b.spec(ctaEnd + 200);
}
