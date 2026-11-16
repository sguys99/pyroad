// 키 입력·프레임 루프 (P11-04): get_key() 큐, 키 시나리오, 검증 실행의 잠 건너뛰기, 프레임마다 turtle 보내기·명령 상한.
// 실행: npm run test:pyodide

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { NodePyodideRunner } from '../nodeRunner';

let runner: NodePyodideRunner;

beforeAll(async () => {
  runner = await NodePyodideRunner.create({ timeoutMs: 20_000 });
});

afterAll(async () => {
  await runner?.close();
});

// world3 3-6 `arrow-move`·`star-catcher` 2단계 모양
const ARROW_MOVE = `import turtle, time
from pyroad import get_key
t = turtle.Turtle()
screen = turtle.Screen()
screen.tracer(0)
for frame in range(900):
    key = get_key()
    if key == "Right":
        t.setx(min(t.xcor() + 10, 200))
    elif key == "Left":
        t.setx(max(t.xcor() - 10, -200))
    elif key == "Up":
        t.sety(t.ycor() + 10)
    screen.update()
    time.sleep(1/30)
print(t.position())`;

describe('get_key()와 키 시나리오', () => {
  it('키는 프레임마다 한 칸씩(n번 잔 뒤 keys[n]), 비면 None, 900프레임 게임도 잠 없이 바로 끝남', async () => {
    const r = await runner.run(ARROW_MOVE, {
      keys: ['Right', 'Right', 'Right', 'Up'],
    });
    expect(r).toMatchObject({ outcome: 'ok', stdout: '(30.00,10.00)\n' });
    // 30초 게임이지만 잠을 건너뛰므로 몇 초 안에 (CI 여유)
    expect(r.ms).toBeLessThan(10_000);
  });

  it('벽 조건: 키[Right×30]이면 200에서 멈춤, null은 그 프레임 키 없음', async () => {
    const r = await runner.run(ARROW_MOVE, {
      keys: [...Array(30).fill('Right'), null, 'Left'],
    });
    expect(r.stdout).toBe('(190.00,0.00)\n');
  });

  it('한 프레임에 여러 번 부르면 두 번째는 None, 시나리오가 없으면 늘 None', async () => {
    const code =
      'from pyroad import get_key\nimport time\nprint(get_key(), get_key())\ntime.sleep(1)\nprint(get_key())';
    expect((await runner.run(code, { keys: ['a', 'b'] })).stdout).toBe(
      'a None\nb\n',
    );
    expect((await runner.run(code)).stdout).toBe('None None\nNone\n');
  });

  it('import pyroad도 되고, 실행마다 새 모듈 (바꾼 속성이 남지 않음)', async () => {
    await runner.run('import pyroad\npyroad.get_key = 1');
    const r = await runner.run('import pyroad\nprint(pyroad.get_key())');
    expect(r).toMatchObject({ outcome: 'ok', stdout: 'None\n' });
  });
});

describe('검증 실행의 잠 건너뛰기', () => {
  it('time.time·monotonic은 건너뛴 잠만큼 앞으로 가서 시간으로 끝나는 루프도 끝남', async () => {
    const r = await runner.run(
      'import time\nstart = time.time()\nn = 0\nwhile time.time() - start < 30:\n    n += 1\n    time.sleep(1/30)\nprint(n >= 899, time.monotonic() > 29)',
    );
    expect(r).toMatchObject({ outcome: 'ok', stdout: 'True True\n' });
    expect(r.ms).toBeLessThan(10_000);
  });

  it('skipSleep: false면 진짜로 잠', async () => {
    const r = await runner.run('import time\ntime.sleep(0.3)\nprint("깸")', {
      skipSleep: false,
    });
    expect(r.stdout).toBe('깸\n');
    expect(r.ms).toBeGreaterThanOrEqual(300);
  });
});

describe('프레임 모델 (turtle)', () => {
  it('잘 때마다 그린 게 있으면 프레임 표시 [f], 안 그린 프레임은 표시 없음', async () => {
    const r = await runner.run(
      'import turtle, time\nt = turtle.Turtle()\nfor i in range(3):\n    t.forward(10)\n    time.sleep(0.1)\ntime.sleep(0.1)',
    );
    expect(r.outcome).toBe('ok');
    expect(r.turtle.filter((c) => c[0] === 'f')).toHaveLength(3);
    expect(r.turtle.at(-1)).toEqual(['f']);
  });

  it('명령 상한은 프레임마다: 쉬어 가며 6만 개를 그려도 끝까지, 쉬지 않으면 5만에서 TurtleLimitError', async () => {
    const game = await runner.run(
      'import turtle, time\nt = turtle.Turtle()\nt.speed(0)\nfor frame in range(600):\n    for i in range(100):\n        t.left(1)\n    time.sleep(1/30)\nprint("끝")',
    );
    expect(game).toMatchObject({ outcome: 'ok', stdout: '끝\n' });
    const loop = await runner.run(
      'import turtle\nt = turtle.Turtle()\nwhile True:\n    t.left(1)',
    );
    expect(loop.errorType).toBe('TurtleLimitError');
  });
});

describe('진짜 키 (브라우저와 같은 채널)', () => {
  const runFixture = async (mode: 'jspi' | 'sw') => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        ...(mode === 'jspi' ? ['--experimental-wasm-jspi'] : []),
        'scripts/pyodide/__tests__/fixtures/keys.mjs',
        mode,
      ],
      { timeout: 60_000 },
    );
    return JSON.parse(stdout.trim().split('\n').at(-1)!);
  };

  it.each(['jspi', 'sw'] as const)(
    '%s: get_key()를 처음 부르면 keys(채널) 알림, 누른 키가 차례로 나옴, 잠마다 sleep → wake',
    async (mode) => {
      const r = await runFixture(mode);
      expect(r.jspi).toBe(mode === 'jspi');
      expect(r.game.outcome).toBe('ok');
      // JSPI는 key 메시지를 바로 받고, SW는 잠 답에 실려 와 한 프레임 늦게 보임
      expect(r.game.stdout).toBe(
        mode === 'jspi'
          ? "['Left', 'space', None, None]\n"
          : "[None, 'Left', 'space', None]\n",
      );
      expect(r.game.order).toEqual([
        'keys',
        ...Array(4).fill(['sleep', 'wake']).flat(),
      ]);
    },
  );
});
