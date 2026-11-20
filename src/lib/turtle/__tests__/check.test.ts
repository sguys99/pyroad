// 그림 검사기 (P11-05). 스파이크 checker.test.mjs 26가지를 옮김 + 집 이어 그리기·개수·match 옵션·견고함.
// fixtures/*.json: 스파이크 shim을 진짜 CPython으로 돌린 명령 스트림
//   (python3 -I spikes/p0-06-turtle-canvas/test/crosscheck.py --fixtures <폴더>, 앱 shim과 같은 명령 형식)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  analyze,
  checkDrawingRule,
  colorsUsed,
  findCircles,
  findShape,
  matchDrawing,
  mergedSegments,
  type DrawingRule,
  type Seg4,
} from '../check';
import type { TurtleCommand } from '../scene';

const FIX = join(__dirname, 'fixtures');
const commands = (name: string): TurtleCommand[] =>
  JSON.parse(readFileSync(join(FIX, `${name}.json`), 'utf8'));
const load = (name: string) => analyze(commands(name));
const segsOf = (name: string): Seg4[] => mergedSegments(load(name).segments);

const SAMPLES: [string, DrawingRule[]][] = [
  ['square', [{ type: 'shape', shape: 'regular', n: 4, side: 150 }]],
  ['star', [{ type: 'shape', shape: 'regular', n: 5, k: 2, filled: true }]],
  [
    'spiral',
    [
      { type: 'colors', min: 6 },
      { type: 'segments', min: 150 },
    ],
  ],
  ['flower', [{ type: 'circles', min: 12, radius: 70 }]],
  ['hangul', [{ type: 'text', includes: '안녕' }]],
  ['race', [{ type: 'turtles', min: 3 }]],
  [
    'bars',
    [
      { type: 'shape', shape: 'rectangle' },
      { type: 'text', includes: '딸기' },
    ],
  ],
];

describe('스파이크 예제 규칙 (P0-06 samples/index.json)', () => {
  it.each(SAMPLES)('%s', (name, rules) => {
    const a = load(name);
    for (const rule of rules) {
      const r = checkDrawingRule(a, rule);
      expect(r.reasons).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });
});

describe('정사각형 판정', () => {
  const sq = { shape: 'regular', n: 4, side: 150 } as const;
  it.each(['pos_square_split', 'pos_square_cw_offset', 'pos_square_midstart'])(
    '통과: %s (나눠 그리기·시계 방향·다른 자리·변 중간 시작)',
    (name) => expect(findShape(load(name), sq).ok).toBe(true),
  );
  it.each(['neg_rectangle', 'neg_open3', 'neg_bad_angle'])(
    '불합격: %s',
    (name) => {
      const r = findShape(load(name), sq);
      expect(r.ok).toBe(false);
      expect(r.reasons[0]).toBe('정사각형을 아직 찾지 못했어요.');
      expect(r.reasons.length).toBeGreaterThan(1);
    },
  );
  it('열린 도형은 닫으라고 알려 준다', () => {
    expect(findShape(load('neg_open3'), sq).reasons.join(' ')).toMatch(
      /닫히지 않았어요|변이 4개/,
    );
  });
});

describe('별: 채우기', () => {
  const star = { shape: 'regular', n: 5, k: 2 } as const;
  it('채운 별 통과', () =>
    expect(findShape(load('star'), { ...star, filled: true }).ok).toBe(true));
  it('안 채운 별은 채우기 규칙에서 떨어지고 이유가 begin_fill', () => {
    const r = findShape(load('neg_star_unfilled'), { ...star, filled: true });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(' ')).toContain('begin_fill()');
  });
  it('채우기 규칙이 없으면 통과', () =>
    expect(findShape(load('neg_star_unfilled'), star).ok).toBe(true));
});

describe('원 찾기', () => {
  it('circle() 두 개 (r=50, 한 바퀴)', () => {
    const c = findCircles(load('pos_circle_r50'));
    expect(c).toHaveLength(2);
    for (const x of c) {
      expect(Math.abs(x.r - 50)).toBeLessThan(0.3);
      expect(x.extent).toBeGreaterThan(350);
    }
  });
  it('반복으로 직접 만든 원', () => {
    const h = findCircles(load('pos_handmade_circle'));
    expect(h).toHaveLength(1);
    expect(
      Math.abs(h[0].r - 10 / (2 * Math.sin((5 * Math.PI) / 180))),
    ).toBeLessThan(0.3);
  });
  it('꽃: r=70 원 12개', () => {
    const f = findCircles(load('flower')).filter(
      (x) => x.extent > 350 && Math.abs(x.r - 70) < 1,
    );
    expect(f).toHaveLength(12);
  });
  it('같은 자리에 두 번 그린 꽃은 원 12개로 셈 (3월드 플레이테스트)', () => {
    const twice = analyze([...commands('flower'), ...commands('flower')]);
    expect(checkDrawingRule(twice, { type: 'circles', min: 12 }).ok).toBe(true);
    const r = checkDrawingRule(twice, { type: 'circles', min: 13 });
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toMatch(/지금 12개\). 같은 자리에 겹친 원은/);
  });
});

describe('정답 그림 견주기 (matchDrawing)', () => {
  const ref = segsOf('house_ref');
  it('다른 순서로 그린 집 == 집', () =>
    expect(matchDrawing(load('house_other_order'), ref, { tol: 1 }).ok).toBe(
      true,
    ));
  it('지붕 없는 집: 빠진 선 2개', () => {
    const m = matchDrawing(load('house_missing_roof'), ref, { tol: 1 });
    expect(m.ok).toBe(false);
    expect(m.missing).toBe(2);
    expect(m.reasons).toEqual(['정답 그림의 선 2개가 아직 없어요.']);
  });
  it('반씩 나눠 그린 정사각형 == 정사각형', () =>
    expect(
      matchDrawing(load('pos_square_split'), segsOf('square'), { tol: 1 }).ok,
    ).toBe(true));
  it('다른 자리 정사각형: 평행이동 옵션이면 같음, 아니면 다름', () => {
    expect(
      matchDrawing(load('pos_square_cw_offset'), segsOf('square'), {
        tol: 1,
        translate: true,
      }).ok,
    ).toBe(true);
    expect(
      matchDrawing(load('pos_square_cw_offset'), segsOf('square'), { tol: 1 })
        .ok,
    ).toBe(false);
  });
  it('남는 선: 기본은 실패, extraOk(덧붙이기 프로젝트)면 통과', () => {
    const roofless = segsOf('house_missing_roof');
    const m = matchDrawing(load('house_ref'), roofless, { tol: 1 });
    expect(m.ok).toBe(false);
    expect(m.reasons).toEqual(['정답 그림에 없는 선이 2개 있어요.']);
    expect(
      matchDrawing(load('house_ref'), roofless, { tol: 1, extraOk: true }).ok,
    ).toBe(true);
  });
});

describe('기타', () => {
  it('나선: 색 6가지 이상', () =>
    expect(colorsUsed(load('spiral')).length).toBeGreaterThanOrEqual(6));
  it('한글 글씨', () =>
    expect(load('hangul').texts.some((t) => t.text.includes('안녕'))).toBe(
      true,
    ));
});

describe('P11-05 더함', () => {
  it('펜을 안 들고 벽 → 지붕을 이어 그린 집에서 정사각형·정삼각형을 찾는다', () => {
    const a = load('house_ref');
    expect(findShape(a, { shape: 'regular', n: 4, side: 100 }).ok).toBe(true);
  });

  it('count: 도형 개수 (같은 자리 선·채우기는 한 번)', () => {
    const star = load('star'); // 채운 별 하나 = 선 + 채우기
    expect(findShape(star, { shape: 'regular', n: 5, k: 2, count: 1 }).ok).toBe(
      true,
    );
    const r = findShape(star, { shape: 'regular', n: 5, k: 2, count: 2 });
    expect(r.ok).toBe(false);
    expect(r.reasons).toEqual([
      '꼭짓점 5개 별이 2개 있어야 하는데 지금은 1개예요.',
    ]);
    // 정사각형을 두 자리에 그리면 2개
    const two = analyze([
      ...commands('square'),
      ['j', 0, 300, 0],
      ['m', 0, 450, 0],
      ['m', 0, 450, 150],
      ['m', 0, 300, 150],
      ['m', 0, 300, 0],
    ]);
    expect(findShape(two, { shape: 'regular', n: 4, count: 2 }).ok).toBe(true);
  });

  it('text: 글씨 수 · 포함 글자', () => {
    const a = load('hangul');
    expect(checkDrawingRule(a, { type: 'text' }).ok).toBe(true);
    expect(checkDrawingRule(a, { type: 'text', includes: '없는 말' })).toEqual({
      ok: false,
      reasons: ['write()로 “없는 말”를 써야 해요.'],
    });
    expect(checkDrawingRule(load('square'), { type: 'text', min: 1 }).ok).toBe(
      false,
    );
  });

  it('turtles · segments 문장', () => {
    expect(
      checkDrawingRule(load('square'), { type: 'turtles', min: 2 }),
    ).toEqual({
      ok: false,
      reasons: ['거북이가 2마리 이상 필요해요 (지금 1마리).'],
    });
    expect(
      checkDrawingRule(load('square'), { type: 'segments', min: 12 }).reasons,
    ).toEqual(['선이 12개 이상여야 하는데 지금 4개예요.']);
  });

  it('빈 그림은 "아직 아무것도"', () => {
    expect(findShape(analyze([]), { shape: 'rectangle' }).reasons[0]).toContain(
      '아직 아무것도 그리지 않았어요',
    );
  });

  it('지우기(clear) 뒤 그림은 사라진다', () => {
    const a = analyze([...commands('square'), ['c', 0]]);
    expect(a.segments).toHaveLength(0);
  });

  it('남이 보낸 이상한 명령은 던지지 않고 건너뛴다', () => {
    const a = analyze([
      ['m', 99, 1, 2],
      'x' as unknown as TurtleCommand,
      ['zz'],
      ...commands('square'),
      ['m', 0, Number.NaN, 0],
    ]);
    expect(a.segments).toHaveLength(4);
  });

  it('같은 직선 위 선분 합치기: 0°·180° 방향이 같은 선, 선이 많아도 빠름', () => {
    expect(
      mergedSegments([
        { x0: 0, y0: 5, x1: 10, y1: 5 },
        { x0: 20, y0: 5, x1: 10, y1: 5 },
      ]),
    ).toHaveLength(1);
    // 서로 다른 직선 2만 개 (서버가 받는 크기)
    const many = Array.from({ length: 20000 }, (_, i) => ({
      x0: 0,
      y0: i * 3,
      x1: 1 + (i % 7),
      y1: i * 3 + 1 + (i % 5),
    }));
    const t0 = performance.now();
    expect(mergedSegments(many).length).toBeGreaterThan(1000);
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
