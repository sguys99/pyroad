import { describe, expect, it } from 'vitest';
import samples from '@/app/dev/design/_catalog/turtleSamples.json';
import { Scene, moveTicks, turnTicks, usesTurtle } from '../scene';
import { describeDrawing, koColorName, summarizeDrawing } from '../describe';
import { fontString, textWidthGuess } from '../TurtleCanvas';

const NEW = (id = 0) => [
  'n',
  id,
  {
    x: 0,
    y: 0,
    h: 0,
    d: 1,
    pc: 'black',
    fc: 'black',
    w: 1,
    sp: 3,
    v: 1,
    sh: 'classic',
    sz: [1, 1, 1],
  },
];

describe('Scene 리듀서', () => {
  it('이동은 선(펜 내림)·채우기 점을 모으고, tracer(0)이면 속도 0', () => {
    const s = new Scene();
    s.apply(NEW());
    s.apply(['bf', 0]);
    const m = s.apply(['m', 0, 100, 0]);
    expect(m).toMatchObject({
      k: 'move',
      x0: 0,
      x1: 100,
      draw: true,
      speed: 3,
    });
    s.apply(['m', 0, 100, 100]);
    s.apply(['s', 0, { fc: 'gold', x: 999 }]);
    const ef = s.apply(['ef', 0]);
    expect(ef).toMatchObject({
      k: 'endFill',
      color: 'gold',
      points: [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
    });
    expect(s.turtle(0).x).toBe(100); // 's'의 x는 무시 (reset은 'j')
    s.apply(['tr', 0]);
    expect(s.apply(['m', 0, 0, 0])).toMatchObject({ speed: 0 });
  });

  it('circle 안 회전(끝 0)은 즉시, 화면 지우기는 거북이도 비움', () => {
    const s = new Scene();
    s.apply(NEW());
    expect(s.apply(['r', 0, 10, 10, 0])).toMatchObject({ k: 'turn', speed: 0 });
    expect(s.apply(['r', 0, 90, 100])).toMatchObject({ speed: 3, h1: 100 });
    s.apply(['C']);
    expect(s.turtles.size).toBe(0);
  });

  it('CPython 애니메이션 길이 공식', () => {
    expect(moveTicks(100, 0)).toBe(0);
    // speed 3: 1 + int(100 / (3 * 1.1**3 * 3)) = 1 + int(8.35) = 9
    expect(moveTicks(100, 3)).toBe(9);
    expect(turnTicks(90, 3)).toBe(11);
    expect(turnTicks(-90, 10)).toBe(4);
  });
});

describe('usesTurtle', () => {
  it.each([
    ['import turtle', true],
    ['from turtle import *', true],
    ['import random, turtle', true],
    ['  import turtle\n', true],
    ['# import turtle', false],
    ['print("turtle")', false],
    ['import turtles', false],
  ])('%j → %s', (code, want) => {
    expect(usesTurtle(code)).toBe(want);
  });
});

describe('그림 요약 (캔버스 대체 글)', () => {
  it('정사각형', () => {
    expect(describeDrawing(samples.square.commands)).toBe(
      '거북이 1마리가 그린 그림: 선 4개. 쓴 색: 바다 초록',
    );
  });

  it('CSS 색 이름은 쉬운 한글로, 직접 고른 색·모르는 이름은 뭉뚱그림 (P11-03)', () => {
    expect(
      ['dimgray', 'tomato', 'darkred', 'lightblue', 'mediumseagreen'].map(
        koColorName,
      ),
    ).toEqual([
      '어두운 회색',
      '토마토색',
      '진한 빨강',
      '연한 파랑',
      '바다 초록',
    ]);
    expect(koColorName('#ff8800')).toBe('직접 고른 색');
    expect(koColorName('papayawhip')).toBe('그 밖의 색');
    // 같은 이름이 된 색은 한 번만
    expect(
      describeDrawing([
        NEW(),
        ['s', 0, { pc: '#112233' }],
        ['m', 0, 10, 0],
        ['s', 0, { pc: '#445566' }],
        ['m', 0, 20, 0],
      ]),
    ).toMatch(/쓴 색: 직접 고른 색$/);
  });

  it('막대그래프: 색칠·글씨·한글 색 이름', () => {
    const s = summarizeDrawing(samples.bars.commands);
    expect(s).toMatchObject({ turtles: 1, lines: 16, fills: 4 });
    expect(s.texts).toContain('우리 반이 좋아하는 과일');
    expect(describeDrawing(samples.bars.commands)).toContain('금색');
  });

  it('여러 거북이·빈 그림·화면 지우기', () => {
    expect(summarizeDrawing(samples.race.commands).turtles).toBe(3);
    expect(describeDrawing([])).toBe('빈 그림판');
    expect(describeDrawing([NEW()])).toBe(
      '거북이 1마리가 그린 그림. 아직 그린 것이 없어요',
    );
    expect(
      summarizeDrawing([
        NEW(),
        ['m', 0, 10, 0],
        ['C'],
        NEW(1),
        ['t', '새 그림'],
      ]),
    ).toMatchObject({ turtles: 1, lines: 0, title: '새 그림' });
  });
});

describe('캔버스 글씨', () => {
  it('Tk 글꼴 → CSS font, 한글 본문 글꼴을 뒤에 붙임', () => {
    expect(fontString({ family: 'Arial', style: 'bold' }, 20)).toBe(
      'bold 20.0px "Arial", "pyRoad Sans", sans-serif',
    );
    expect(fontString({ family: 'a"b', style: 'normal' }, 0)).toBe(
      '1.0px "ab", "pyRoad Sans", sans-serif',
    );
  });

  it('글자 폭 어림: 한글 1em, 영문 0.56em, 여러 줄은 가장 긴 줄', () => {
    expect(textWidthGuess('안녕', 10)).toBe(20);
    expect(textWidthGuess('ab\n가', 10)).toBeCloseTo(11.2);
  });
});
