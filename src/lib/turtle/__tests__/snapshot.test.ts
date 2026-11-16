// 마지막 화면 스트림 (P11-05 저장 정책): 남은 그림·거북이 모습이 같고 명령은 짧다
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze, colorsUsed, mergedSegments, roundSegments } from '../check';
import { Scene, type TurtleCommand } from '../scene';
import { finalFrame } from '../snapshot';

const load = (n: string): TurtleCommand[] =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', `${n}.json`), 'utf8'));
const lines = (c: TurtleCommand[]) =>
  roundSegments(mergedSegments(analyze(c).segments))
    .map((s) => s.join(','))
    .sort();

describe('finalFrame', () => {
  it.each(['flower', 'star', 'bars', 'hangul', 'race', 'spiral'])(
    '%s: 선·채우기·글씨·색·거북이가 같다',
    (name) => {
      const full = load(name);
      const snap = finalFrame(full);
      expect(lines(snap)).toEqual(lines(full));
      const [a, b] = [analyze(full), analyze(snap)];
      expect(b.fills.length).toBe(a.fills.length);
      expect(b.texts.map((t) => t.text)).toEqual(a.texts.map((t) => t.text));
      expect(colorsUsed(b).sort()).toEqual(colorsUsed(a).sort());
      expect(b.turtles).toBe(a.turtles);
      expect(b.bg).toBe(a.bg);
    },
  );

  it('긴 게임 (펜 든 거북이 2마리 × 3만 프레임) → 거북이 마지막 자리만, 아주 짧게', () => {
    const born = (id: number): TurtleCommand => [
      'n',
      id,
      {
        x: 0,
        y: 0,
        h: 90,
        d: 0,
        pc: 'black',
        fc: 'gold',
        w: 1,
        sp: 0,
        v: 1,
        sh: 'turtle',
        sz: [1, 1, 1],
      },
    ];
    const game: TurtleCommand[] = [['tr', 0], born(0), born(1)];
    for (let f = 0; f < 30_000; f++)
      game.push(
        ['m', 0, f % 200, -150],
        ['m', 1, 50, 200 - (f % 400)],
        ['u'],
        ['f'],
      );
    game.push(['w', 0, '게임 끝! 점수: 7', 'left', 'Arial', 16, 'normal']);
    const snap = finalFrame(game);
    expect(game.length).toBeGreaterThan(100_000);
    expect(snap.length).toBeLessThan(20);
    const scene = new Scene();
    for (const c of snap) scene.apply(c);
    expect(
      [...scene.turtles.values()].map((t) => [t.x, t.y, t.h, t.sh]),
    ).toEqual([
      [29_999 % 200, -150, 90, 'turtle'],
      [50, 200 - (29_999 % 400), 90, 'turtle'],
    ]);
    expect(analyze(snap).texts.map((t) => t.text)).toEqual([
      '게임 끝! 점수: 7',
    ]);
  });

  it('지운 그림은 남지 않는다', () => {
    const snap = finalFrame([...load('star'), ['c', 0]]);
    expect(analyze(snap).segments).toHaveLength(0);
  });
});
