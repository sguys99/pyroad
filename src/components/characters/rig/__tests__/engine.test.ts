import { describe, it, expect } from 'vitest';
import { RigEngine } from '../core/engine';
import { rigPolicy } from '../core/policy';
import type { Geo, Params, RigDef } from '../core/types';
import { PYBAEM, PYBAEM_STATES, type PybaemState } from '../pybaem';
import { BUGBUG, BUGBUG_STATES } from '../bugbug';
import { BYEOLTTONGI, BYEOLTTONGI_STATES } from '../byeolttongi';
import type { MotionTier } from '../../../../lib/motion/tier';
import type { RigStyle } from '../style';

const DEFS = [
  [PYBAEM, PYBAEM_STATES],
  [BUGBUG, BUGBUG_STATES],
  [BYEOLTTONGI, BYEOLTTONGI_STATES],
] as unknown as [RigDef<string, unknown>, readonly string[]][];

function make<S extends string>(
  def: RigDef<S, unknown>,
  opts: {
    tier?: MotionTier;
    reduced?: boolean;
    style?: RigStyle;
    onCue?: (c: string) => void;
  } = {},
) {
  let geo: Geo | null = null;
  const e = new RigEngine<S>(def, {
    seed: 7,
    style: opts.style ?? 'AB',
    tier: opts.tier,
    reduced: opts.reduced,
    onCue: opts.onCue,
    onRender: (g) => (geo = g),
  });
  return { e, geo: () => geo };
}

/** 프레임마다 출력 파라미터를 모은다 */
function record<S extends string>(
  e: RigEngine<S>,
  seconds: number,
  events: [number, S][] = [],
): Params[] {
  const frames: Params[] = [];
  const n = Math.round(seconds * 60);
  const ev = [...events];
  for (let i = 0; i < n; i++) {
    while (ev.length && ev[0][0] <= i / 60 + 1e-6) e.setState(ev.shift()![1]);
    e.advance(1 / 60);
    frames.push(e.snapshot());
  }
  return frames;
}

const maxStep = (
  frames: Params[],
  key: string,
  from = 0,
  to = frames.length,
) => {
  let m = 0;
  for (let i = Math.max(1, from); i < to; i++)
    m = Math.max(m, Math.abs(frames[i][key] - frames[i - 1][key]));
  return m;
};

/** 스냅샷에 남길 대표 속성 (상태별·시간별 geometry 값) */
const KEYS: Record<string, string[]> = {
  pybaem: [
    'root',
    'head',
    'tail',
    'mouth',
    'eyeL',
    'browL',
    'spark0',
    'zzz0',
    'qmark',
  ],
  bugbug: [
    'root',
    'head',
    'leg0',
    'leg3',
    'shellL',
    'eyeL',
    'pupL',
    'mouth',
    'antL',
    'mag',
    'dz0',
  ],
  byeolttongi: [
    'move',
    'body',
    'star',
    'trailOut',
    'eyeL',
    'mouth',
    'coin',
    'tw0',
    'dust1',
  ],
};
const pick = (g: Geo, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, g[k]]));

describe('리그 정책 (연출 단계 → 리그)', () => {
  it('budget 값을 그대로 읽는다', () => {
    expect(rigPolicy('full', false)).toMatchObject({
      mode: 'live',
      fps: 60,
      secondary: true,
      blink: 'normal',
      filters: true,
      halo: false,
    });
    expect(rigPolicy('lite', false)).toMatchObject({
      mode: 'live',
      fps: 30,
      secondary: false,
      filters: false,
      halo: false,
    });
    expect(rigPolicy('minimal', false)).toMatchObject({
      mode: 'transitions',
      fps: 0,
      blink: 'off',
      halo: true,
    });
    expect(rigPolicy('full', true)).toMatchObject({
      mode: 'still',
      blink: 'slow',
      secondary: false,
      halo: true,
    });
    expect(rigPolicy('minimal', true)).toMatchObject({
      mode: 'still',
      blink: 'off',
    });
  });
});

describe('파라미터 스냅샷 (상태별·시간별 geometry)', () => {
  for (const [def, states] of DEFS) {
    it(`${def.id}: 정적 포즈`, () => {
      const out: Record<string, unknown> = {};
      for (const s of states) {
        const g = def.geometry(def.staticParams(s), {
          idp: 't',
          style: 'AB',
          haloColor: def.halo[s],
          tuning: {
            hop: 1,
            jellyZeta: null,
            thud: 1,
            talkSpeed: 1,
            look: 1,
            paper: null,
            boilFps: null,
            haloOpacity: 0.55,
            haloColors: {},
          },
        });
        out[s] = pick(g, KEYS[def.id]);
      }
      expect(out).toMatchSnapshot();
    });
    it(`${def.id}: 대기에서 각 상태로 0.25·0.5·1초`, () => {
      const out: Record<string, unknown> = {};
      for (const s of states) {
        const { e } = make(def);
        e.advance(0.5);
        e.setState(s);
        const row: Record<string, unknown> = {};
        for (const [t, dt] of [
          [0.25, 0.25],
          [0.5, 0.25],
          [1, 0.5],
        ]) {
          e.advance(dt);
          row[`${t}s`] = pick(e.geometry(), KEYS[def.id]);
        }
        out[s] = row;
      }
      expect(out).toMatchSnapshot();
    });
  }
});

describe('엔진: 끊기 전환', () => {
  it('점프 도중 슬픔으로 바꿔도 순간이동이 없고, 점프를 마친 뒤 털썩 착지한다', () => {
    const { e } = make(PYBAEM);
    e.advance(1);
    const f = record<PybaemState>(e, 1.6, [
      [0, 'happy'],
      [0.25, 'sad'],
    ]);
    const at = 15; // 0.25초
    // 입력 직후 프레임당 이동이 점프 자체의 움직임보다 크지 않다
    expect(maxStep(f, 'rootY', at, at + 12)).toBeLessThan(
      maxStep(f, 'rootY', 0, at) + 0.5,
    );
    expect(maxStep(f, 'sqY', at, at + 12)).toBeLessThan(0.06);
    // 공중이었으므로 바로 내려오지 않고 이어서 착지한다
    expect(f[at + 2].rootY).toBeLessThan(-4);
    const landed = f.findIndex((p, i) => i > at && p.rootY > -0.01);
    expect(landed).toBeGreaterThan(at);
    expect(landed).toBeLessThan(at + 40);
    // 털썩: 착지 뒤 슬픔 기본(0.955)보다 더 찌그러진다
    const minSq = Math.min(...f.slice(landed, landed + 30).map((p) => p.sqY));
    expect(minSq).toBeLessThan(0.93);
    // 얼굴은 즉시 슬퍼지기 시작한다
    expect(f[at + 6].browSad).toBeGreaterThan(0.3);
  });

  it.each(DEFS.map(([d, s]) => [d.id, d, s] as const))(
    '%s: 무작위로 상태를 끊어도 값이 연속이다',
    (_id, def, states) => {
      const { e } = make(def);
      e.advance(0.3);
      let seed = 3;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const events: [number, string][] = [];
      let t = 0.1;
      while (t < 6) {
        events.push([t, states[Math.floor(rnd() * states.length)]]);
        t += 0.15 + rnd() * 0.6;
      }
      const f = record(e, 6.5, events);
      for (const p of f)
        for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
      // 등장·날아오기는 화면 밖에서 들어오는 연출이라 시작 프레임을 뺀다
      const entries = new Set(
        events
          .filter(([, s]) => s === 'appear' || s === 'flyIn')
          .map(([t]) => Math.round(t * 60)),
      );
      let worst = 0;
      for (let i = 1; i < f.length; i++) {
        if (entries.has(i) || entries.has(i - 1) || entries.has(i + 1))
          continue;
        worst = Math.max(
          worst,
          Math.abs(f[i].rootX - f[i - 1].rootX),
          Math.abs(f[i].rootY - f[i - 1].rootY),
          Math.abs((f[i].flyX ?? 0) - (f[i - 1].flyX ?? 0)),
          Math.abs((f[i].flyY ?? 0) - (f[i - 1].flyY ?? 0)),
        );
      }
      expect(worst).toBeLessThan(12);
    },
  );
});

describe('엔진: 연출 단계·동작 줄이기', () => {
  it.each(DEFS.map(([d, s]) => [d.id, d, s] as const))(
    '%s 동작 줄이기: 위치·크기 변화 0, 표정은 즉시, 느린 눈 깜빡임만',
    (_id, def, states) => {
      const { e } = make(def, { reduced: true });
      const f: Params[] = [];
      for (const s of states) {
        e.setState(s);
        e.advance(1 / 60);
        // 표정은 바로 목표값 (일회성 상태는 곧 다음 상태로 넘어가므로 첫 프레임에 본다)
        const pose = { ...def.neutral, ...def.poses[s] };
        const faceKey = Object.keys(def.poses[s]).find(
          (k) =>
            !def.pinnedKeys.includes(k) &&
            !def.loopKeys.includes(k) &&
            k !== 'halo' &&
            k !== 'eyeOpen',
        );
        if (faceKey)
          expect(e.snapshot()[faceKey]).toBeCloseTo(pose[faceKey], 5);
        for (let i = 0; i < 90; i++) {
          e.advance(1 / 60);
          f.push(e.snapshot());
        }
      }
      for (const p of f) {
        for (const k of def.pinnedKeys)
          expect(p[k]).toBeCloseTo(def.neutral[k], 6);
        expect(p.sqX).toBeCloseTo(1, 6);
        expect(p.sqY).toBeCloseTo(1, 6);
        expect(p.flyX ?? 0).toBe(0);
      }
      // 느린 깜빡임: 7초마다 0.4초
      const blinks = f.map((p) => p.eyeOpen < 0.3);
      const starts = blinks.filter((b, i) => b && !blinks[i - 1]).length;
      expect(starts).toBeGreaterThanOrEqual(Math.floor(f.length / 60 / 7));
      expect(starts).toBeLessThanOrEqual(Math.ceil(f.length / 60 / 7) + 1);
    },
  );

  it('동작 줄이기: 깜빡임 사이에는 잠들고(rAF 없음) 후광 색으로 상태를 알린다', () => {
    const { e, geo } = make(PYBAEM, { reduced: true });
    e.setState('happy');
    e.advance(0.2);
    expect(e.isRunning()).toBe(false);
    expect(Number(geo()!.halo.opacity)).toBeGreaterThan(0.3);
    expect(geo()!.halo.fill).toBe(PYBAEM.halo.happy);
    e.setState('idle');
    e.advance(0.2);
    expect(Number(geo()!.halo.opacity)).toBe(0);
  });

  it('minimal: 전환이 끝나면 루프를 멈추고(대기 CPU 0) 숨쉬기·깜빡임이 없다', () => {
    const { e } = make(PYBAEM, { tier: 'minimal' });
    e.setState('happy');
    e.advance(0.1);
    expect(e.isRunning()).toBe(true);
    e.advance(2.5);
    expect(e.isRunning()).toBe(false);
    const frames = e.stats.frames;
    e.advance(10);
    expect(e.stats.frames).toBe(frames);
    const p = e.snapshot();
    expect(p.rootY).toBeCloseTo(0, 3);
    expect(p.eyeOpen).toBeCloseTo(1, 3);
  });

  it('lite는 30fps 상한, B 스타일은 12fps 계단 렌더, full은 60fps', () => {
    const run = (tier: MotionTier, style: RigStyle) => {
      const { e } = make(PYBAEM, { tier, style });
      e.setState('dance');
      e.advance(0.5);
      const r0 = e.stats.renders;
      e.advance(1);
      return e.stats.renders - r0;
    };
    expect(run('full', 'AB')).toBeGreaterThanOrEqual(59);
    expect(run('lite', 'AB')).toBeLessThanOrEqual(31);
    expect(run('lite', 'AB')).toBeGreaterThanOrEqual(29);
    expect(run('full', 'B')).toBeLessThanOrEqual(13);
  });

  it('조용한 대기는 full에서도 30fps로 그리고(대기 CPU), 콕 찌르면 바로 60fps', () => {
    const { e } = make(PYBAEM);
    e.advance(1);
    let r0 = e.stats.renders;
    e.advance(1);
    expect(e.stats.renders - r0).toBeLessThanOrEqual(31);
    e.poke();
    r0 = e.stats.renders;
    e.advance(0.5);
    expect(e.stats.renders - r0).toBeGreaterThanOrEqual(29);
  });

  it('lite: 두리번·오버래핑·선 떨림이 꺼진다', () => {
    const { e } = make(PYBAEM, { tier: 'lite', style: 'B' });
    e.setState('happy');
    const seeds = new Set<number>();
    let hat = 0;
    for (let i = 0; i < 120; i++) {
      e.advance(1 / 60);
      seeds.add(e.snapshot().boilSeed);
      hat = Math.max(hat, Math.abs(e.snapshot().hatRot));
    }
    expect([...seeds]).toEqual([1]);
    expect(hat).toBeLessThan(0.01);
  });
});

describe('엔진: 상호작용·신호', () => {
  it('콕 찌르기: 눈웃음 + 볼 빨개짐', () => {
    const { e } = make(PYBAEM);
    e.advance(0.5);
    e.poke();
    e.advance(0.1);
    expect(e.snapshot().eyeHappy).toBeGreaterThan(0.5);
    expect(e.snapshot().blush).toBeGreaterThan(0.5);
    e.advance(1.5);
    expect(e.snapshot().eyeHappy).toBeLessThan(0.05);
  });

  it('따라보기: 포인터 쪽으로 눈이 가고(150ms에 절반 이상) 터치는 2.5초 뒤 돌아온다', () => {
    const { e } = make(PYBAEM);
    e.setPointer(0, 0, false);
    e.advance(1);
    // 포인터가 순간 이동 (P0-07 §4.5: 50%에 150ms, 90%에 300ms)
    e.setPointer(1, 0, false);
    e.advance(0.15);
    expect(e.snapshot().lookX).toBeGreaterThan(0.45);
    e.advance(0.25);
    expect(e.snapshot().lookX).toBeGreaterThan(0.9);
    // 터치: 탭한 곳을 2.5초 보고 돌아온다
    e.setPointer(1, 0, true);
    e.advance(0.3);
    expect(e.snapshot().lookX).toBeGreaterThan(0.9);
    e.advance(3.5);
    expect(Math.abs(e.snapshot().lookX)).toBeLessThan(0.15);
  });

  it('말하기 레이어는 어떤 상태 위에도 입을 움직인다', () => {
    const { e } = make(PYBAEM);
    e.setState('sad');
    e.setTalking(true);
    const f = record(e, 2);
    const mouth = f.slice(60).map((p) => p.mouthOpen);
    expect(Math.max(...mouth) - Math.min(...mouth)).toBeGreaterThan(0.3);
    expect(f[f.length - 1].browSad).toBeGreaterThan(0.9);
  });

  it('별똥이 보상 건네기: 코인 팝 순간에 reward 신호 (동작 줄이기면 즉시)', () => {
    const cues: [string, number][] = [];
    const frames = { n: 0 };
    const { e } = make(BYEOLTTONGI, {
      onCue: (c) => cues.push([c, frames.n]),
    });
    const advance = e.advance.bind(e);
    e.advance = (s: number) => {
      for (let i = 0; i < Math.round(s * 60); i++) {
        advance(1 / 60);
        frames.n = e.stats.frames;
      }
    };
    e.advance(0.2);
    const f0 = e.stats.frames;
    e.setState('give');
    e.advance(1.2);
    expect(cues.map((c) => c[0])).toEqual(['reward']);
    expect((cues[0][1] - f0) / 60).toBeCloseTo(0.75, 1);
    e.advance(1);
    expect(e.state).toBe('idle');

    const rc: string[] = [];
    const r = make(BYEOLTTONGI, { reduced: true, onCue: (c) => rc.push(c) });
    r.e.setState('give');
    expect(rc).toEqual(['reward']);
  });

  it('일회성 상태는 끝나면 다음 상태로: 버그버그 등장 → 대기, 별똥이 날아오기 → 착지 → 떠 있기', () => {
    const b = make(BUGBUG);
    b.e.setState('appear');
    b.e.advance(1.3);
    expect(b.e.state).toBe('idle');
    expect(Math.abs(b.e.snapshot().rootX)).toBeLessThan(3);

    const s = make(BYEOLTTONGI);
    s.e.setState('flyIn');
    s.e.advance(0.5);
    expect(s.e.snapshot().flyX).toBeLessThan(-5);
    s.e.advance(0.5);
    expect(s.e.state).toBe('land');
    expect(s.e.snapshot().flyX).toBe(0);
    s.e.advance(1);
    expect(s.e.state).toBe('idle');
  });

  it('버그버그 패배는 뒤집히고, 동작 줄이기에서는 똑바로 선 채 표정만', () => {
    const { e } = make(BUGBUG);
    e.setState('defeat');
    e.advance(1.5);
    expect(Math.abs(e.snapshot().rootRot)).toBeGreaterThan(150);
    const r = make(BUGBUG, { reduced: true });
    r.e.setState('defeat');
    r.e.advance(0.1);
    expect(r.e.snapshot().rootRot).toBe(0);
    expect(r.e.snapshot().eyeSleep).toBeCloseTo(1, 5);
  });
});
