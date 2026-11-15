// turtle shim (P11-02)을 실제 Pyodide 314 + 공용 실행 코어로 검사한다. 실행: npm run test:pyodide
// - 최종 위치·방향이 진짜 CPython turtle(TNavigator)과 같은지: 기대값은 python3 -I scripts/pyodide/turtle/cpython-fixture.py
// - 그리기 명령이 실행 중에 { type: 'turtle' } 청크로 오고, 명령 상한은 Worker 재시작 없이 TurtleLimitError로 끝나는지

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as core from '../../../public/workers/pyodide-core.mjs';
import { TURTLE_MAX_COMMANDS } from '@/lib/pyodide/constants';
import { NodePyodideRunner } from '../nodeRunner';

interface Fixture {
  python: string;
  programs: Record<string, { src: string; final: number[][] }>;
}
const fixture: Fixture = JSON.parse(
  readFileSync('scripts/pyodide/turtle/cpython-final.json', 'utf8'),
);

let runner: NodePyodideRunner;

beforeAll(async () => {
  runner = await NodePyodideRunner.create({ timeoutMs: 5000, graceMs: 1500 });
});

afterAll(async () => {
  await runner?.close();
});

describe('CPython 교차 검증 (완료 기준: 최종 위치·방향이 CPython과 같다)', () => {
  it('명령 상한이 앱 상수와 같음', () => {
    expect(core.TURTLE_MAX_COMMANDS).toBe(TURTLE_MAX_COMMANDS);
  });

  it.each(Object.entries(fixture.programs))(
    // 알고리즘이 같은지는 fixture 스크립트가 같은 CPython에서 비트 단위로 확인한다. 여기서는 Pyodide libm과 차이가 마지막 자리뿐인지
    '%s: x·y·heading이 CPython과 같음 (1e-9 안)',
    async (_name, { src, final }) => {
      // json.dumps는 float를 repr로 적어 왕복해도 값이 그대로다
      const r = await runner.run(
        `${src}\nimport json as _j\nprint(_j.dumps([[t.xcor(), t.ycor(), t.heading()] for t in CHECK]))\n`,
      );
      expect(r.stderr).toBe('');
      const got: number[][] = JSON.parse(r.stdout.trim());
      expect(got).toHaveLength(final.length);
      got.flat().forEach((v, i) => {
        expect(Math.abs(v - final.flat()[i])).toBeLessThan(1e-9);
      });
    },
  );

  it('position()·heading() 출력 글자가 CPython과 같음 (퀴즈·보스 문제, world3 제안 G)', async () => {
    const r = await runner.run(
      'import turtle\nt = turtle.Turtle()\nt.forward(100)\nt.left(90)\nt.forward(50)\nprint(t.position())\nprint(t.heading())\n',
    );
    expect(r.stdout).toBe('(100.00,50.00)\n90.0\n');
  });
});

describe('명령 스트림', () => {
  it('정사각형: 새 거북이 + 이동·회전 명령이 turtle 청크로 옴', async () => {
    const r = await runner.run(
      'import turtle\nt = turtle.Turtle()\nfor i in range(4):\n    t.forward(100)\n    t.left(90)\n',
    );
    expect(r.success).toBe(true);
    expect(r.turtle[0]).toEqual(['n', 0, expect.any(Object)]);
    const moves = r.turtle.filter((c) => c[0] === 'm');
    expect(moves).toEqual([
      ['m', 0, 100, 0],
      ['m', 0, 100, 100],
      ['m', 0, 0, 100],
      ['m', 0, 0, 0],
    ]);
    expect(r.turtle.filter((c) => c[0] === 'r')).toHaveLength(4);
  });

  it('from turtle import * · 한글 색 이름 · 글씨 · 제목', async () => {
    const r = await runner.run(
      'from turtle import *\ncolor("빨강", "하늘색")\nbegin_fill()\ncircle(30)\nend_fill()\nwrite("안녕!", font=("Arial", 16, "bold"))\ntitle("내 그림")\ndone()\n',
    );
    expect(r.stderr).toBe('');
    expect(r.turtle).toContainEqual(['s', 0, { pc: 'red', fc: 'skyblue' }]);
    expect(r.turtle.some((c) => c[0] === 'bf')).toBe(true);
    expect(r.turtle.some((c) => c[0] === 'ef')).toBe(true);
    expect(r.turtle).toContainEqual([
      'w',
      0,
      '안녕!',
      'left',
      'Arial',
      16,
      'bold',
    ]);
    expect(r.turtle).toContainEqual(['t', '내 그림']);
  });

  it('turtle을 안 쓰는 코드는 청크가 없음', async () => {
    const r = await runner.run('print("거북이 없음")');
    expect(r.turtle).toEqual([]);
  });

  it('실행마다 새 모듈: 이전 실행의 거북이·바꾼 속성이 남지 않음', async () => {
    await runner.run(
      'import turtle\nturtle.forward = None\na = turtle.Turtle()\nb = turtle.Turtle()\n',
    );
    const r = await runner.run(
      'import turtle\nt = turtle.Turtle()\nt.forward(10)\nprint(len(turtle.Screen().turtles()))\n',
    );
    expect(r.stderr).toBe('');
    expect(r.stdout).toBe('1\n');
    expect(r.turtle[0]).toEqual(['n', 0, expect.any(Object)]);
  });

  it('예외가 나도 그때까지의 그림은 보냄 + 학생 코드 줄만 traceback', async () => {
    const r = await runner.run(
      'import turtle\nt = turtle.Turtle()\nt.forward(50)\nt.forwrd(10)\n',
    );
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('AttributeError');
    expect(r.stderr).toContain("혹시 'forward'를 쓰려고 했나요?");
    expect(r.stderr).not.toContain('turtle.py');
    expect(r.turtle).toContainEqual(['m', 0, 50, 0]);
  });

  it('지원하지 않는 기능은 친절한 에러', async () => {
    const r = await runner.run('import turtle\nturtle.onkey(None, "Up")\n');
    expect(r.errorType).toBe('TurtleNotSupportedError');
    expect(r.stderr).toContain('이 기능은 아직 지원하지 않아요: onkey()');
  });
});

describe('명령 상한 (§12-Q74 ①: 50,000개)', () => {
  it('그리는 무한 반복은 TurtleLimitError로 끝나고 Worker는 그대로', async () => {
    const restarts = runner.restarts;
    const r = await runner.run(
      'import turtle\nt = turtle.Turtle()\nwhile True:\n    t.forward(1)\n    t.left(1)\n',
    );
    expect(r.outcome).toBe('error');
    expect(r.errorType).toBe('TurtleLimitError');
    expect(r.stderr).toContain('그림 명령이 너무 많아요 (최대 50,000개)');
    expect(r.turtle).toHaveLength(TURTLE_MAX_COMMANDS);
    expect(runner.restarts).toBe(restarts);
    // 같은 Worker로 바로 다음 실행
    const next = await runner.run('print("다음")');
    expect(next.stdout).toBe('다음\n');
  });
});
