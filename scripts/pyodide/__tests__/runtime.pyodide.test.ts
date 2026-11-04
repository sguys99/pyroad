// 실제 Pyodide 314.0.7을 Node worker_threads에서 띄워 공용 실행 코어(public/workers/pyodide-core.mjs)를 검사한다.
// 브라우저 Worker와 같은 코어·같은 메시지이므로 여기서 통과하면 B15 샌드박스·P0-09 linecache 문제가 함께 확인된다.
// 실행: npm run test:pyodide (느려서 npm test에서는 뺌)

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as core from '../../../public/workers/pyodide-core.mjs';
import {
  BLOCKED_MODULES,
  MAX_CAPTURE_LENGTH,
  PYODIDE_VERSION,
} from '@/lib/pyodide/constants';
import { NodePyodideRunner } from '../nodeRunner';

let runner: NodePyodideRunner;

beforeAll(async () => {
  runner = await NodePyodideRunner.create({ timeoutMs: 2000, graceMs: 1500 });
});

afterAll(async () => {
  await runner?.close();
});

describe('버전·상수', () => {
  it('npm 패키지·코어·앱 상수가 모두 314.0.7', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const installed = JSON.parse(
      readFileSync('node_modules/pyodide/package.json', 'utf8'),
    );
    expect(pkg.dependencies.pyodide).toBe(PYODIDE_VERSION);
    expect(installed.version).toBe(PYODIDE_VERSION);
    expect(core.PYODIDE_VERSION).toBe(PYODIDE_VERSION);
    expect(runner.info.pyodide).toBe(PYODIDE_VERSION);
    expect(runner.info.python).toMatch(/^3\.14\./);
  });

  it('차단 모듈 목록과 출력 상한이 앱 상수와 같음', () => {
    expect(core.BLOCKED_MODULES).toEqual([...BLOCKED_MODULES]);
    expect(core.MAX_CAPTURE_LENGTH).toBe(MAX_CAPTURE_LENGTH);
  });
});

describe('기본 실행', () => {
  it('stdout을 모으고 성공', async () => {
    const r = await runner.run('print("안녕")\nprint(1 + 2)');
    expect(r).toMatchObject({
      stdout: '안녕\n3\n',
      stderr: '',
      success: true,
      outcome: 'ok',
      hadException: false,
      errorType: null,
    });
  });

  it('출력을 실행 중에 나눠서 보냄 (스트리밍)', async () => {
    const chunks: string[] = [];
    const r = await runner.run(
      'import time\nprint("하나")\ntime.sleep(0.1)\nprint("둘")',
      {
        onOutput: (kind, text) => {
          if (kind === 'stdout') chunks.push(text);
        },
      },
    );
    expect(r.stdout).toBe('하나\n둘\n');
    expect(chunks).toEqual(['하나\n', '둘\n']);
  });

  it('stdout과 stderr 순서가 유지됨', async () => {
    const order: string[] = [];
    await runner.run('print("먼저")\nx = 1 / 0', {
      onOutput: (kind) => order.push(kind),
    });
    expect(order[0]).toBe('stdout');
    expect(order.at(-1)).toBe('stderr');
  });

  it('경고만 있으면 성공 (B25)', async () => {
    const r = await runner.run('x = "\\d"\nprint("ok")');
    expect(r.stderr).toContain('SyntaxWarning');
    expect(r).toMatchObject({
      success: true,
      outcome: 'ok',
      hadException: false,
    });
  });

  it('학생이 직접 stderr에 써도 예외가 없으면 성공', async () => {
    const r = await runner.run('import sys\nprint("e", file=sys.stderr)');
    expect(r).toMatchObject({ stderr: 'e\n', success: true, outcome: 'ok' });
  });

  it('sys.exit(0)은 성공, sys.exit("메시지")는 실패', async () => {
    expect((await runner.run('import sys\nsys.exit(0)')).success).toBe(true);
    const r = await runner.run('import sys\nsys.exit("그만")');
    expect(r).toMatchObject({
      success: false,
      stderr: '그만\n',
      errorType: 'SystemExit',
    });
  });

  it('미리 넣은 입력으로 input()을 실행하고 모자라면 EOFError', async () => {
    const r = await runner.run(
      'a = input("이름? ")\nprint("안녕", a)\nb = input()',
      {
        stdin: ['철수'],
      },
    );
    expect(r.stdout).toBe('이름? 안녕 철수\n');
    expect(r).toMatchObject({ success: false, errorType: 'EOFError' });
  });

  it('seed를 넘기면 random 결과가 같음', async () => {
    const code = 'import random\nprint(random.randint(1, 1000))';
    const a = await runner.run(code, { seed: 3 });
    const b = await runner.run(code, { seed: 3 });
    expect(a.stdout).toBe(b.stdout);
  });
});

describe('예외와 traceback', () => {
  it('예외가 나면 실패하고 학생 코드 줄만 보임', async () => {
    const r = await runner.run('def f():\n    return 1 / 0\n\nf()');
    expect(r).toMatchObject({
      success: false,
      outcome: 'error',
      hadException: true,
      errorType: 'ZeroDivisionError',
    });
    expect(r.stderr).toContain('Traceback (most recent call last):');
    expect(r.stderr).toContain('File "<exec>", line 4, in <module>');
    expect(r.stderr).toContain('File "<exec>", line 2, in f');
    expect(r.stderr).toContain('return 1 / 0');
    expect(r.stderr).toMatch(/ZeroDivisionError: division by zero\n$/);
    expect(r.stderr).not.toMatch(/_pyodide|\/lib\/python|<pyroad>/);
  });

  it('linecache가 표준 모듈 안에서 os를 import해도 sys.excepthook 오류가 붙지 않음 (P0-09)', async () => {
    const r = await runner.run('print(x)');
    expect(r.stderr).toContain("NameError: name 'x' is not defined");
    expect(r.stderr).toContain('    print(x)');
    expect(r.stderr).not.toContain('Error in sys.excepthook');
    expect(r.stderr).not.toContain('사용할 수 없어요');
  });

  it('표준 모듈 안에서 난 예외도 학생 코드 줄만', async () => {
    const r = await runner.run('import random\nrandom.randint(5, 1)');
    expect(r.errorType).toBe('ValueError');
    expect(r.stderr).toContain('File "<exec>", line 2');
    expect(r.stderr).not.toContain('random.py');
  });

  it('SyntaxError는 위치만 보임', async () => {
    const r = await runner.run('print("a"');
    expect(r.errorType).toBe('SyntaxError');
    expect(r.stderr).toContain('File "<exec>", line 1');
    expect(r.stderr).not.toContain('Traceback');
  });
});

describe('실행 격리 (B15)', () => {
  it('실행마다 새 namespace라 이전 실행 변수를 쓸 수 없음', async () => {
    expect((await runner.run('x = 42')).success).toBe(true);
    const r = await runner.run('print(x)');
    expect(r).toMatchObject({ success: false, errorType: 'NameError' });
  });

  it('builtins 이름을 바꿔도 다음 실행에 남지 않음', async () => {
    await runner.run('__builtins__["print"] = None');
    expect((await runner.run('print("ok")')).stdout).toBe('ok\n');
  });

  it('차단 모듈은 실행 전에 안내', async () => {
    const r = await runner.run('import os\nprint("x")');
    expect(r).toMatchObject({
      stdout: '',
      stderr: '이 모듈은 사용할 수 없어요: os. 안전한 모듈만 사용해 주세요!',
      success: false,
      hadException: true,
      errorType: 'ImportError',
    });
  });

  it.each([
    ['__import__("os")'],
    ['exec("import os")'],
    ['exec("import js")'],
    ['m = __import__("pyodide")'],
    ['f = lambda: __import__("micropip")\nf()'],
  ])('실행 중 import도 막음: %s', async (code) => {
    const r = await runner.run(code);
    expect(r.errorType).toBe('ImportError');
    expect(r.stderr).toContain('사용할 수 없어요');
  });

  it('Python 쪽 차단을 우회해도(__import__.__globals__) js 모듈은 없음', async () => {
    const r = await runner.run(
      [
        'import sys',
        'real = __import__.__globals__["_real_import"]',
        'print(real("os").name)', // Python 쪽 차단은 우회됨 (안내 장치일 뿐)
        'print("js" in sys.modules, sorted(vars(sys.modules["pyodide_js"])))',
        'try:',
        '    real("js")',
        'except ImportError as e:',
        '    print(type(e).__name__)',
        '_importhook = real("_pyodide._importhook", None, None, ["x"])',
        'try:',
        '    _importhook.register_js_module("js", None)',
        'except RuntimeError as e:',
        '    print("등록 막힘")',
      ].join('\n'),
    );
    expect(r.stderr).toBe('');
    expect(r.stdout.split('\n')).toEqual([
      'posix',
      "False ['__doc__', '__loader__', '__name__', '__package__', '__spec__', '_api']",
      'ModuleNotFoundError',
      '등록 막힘',
      '',
    ]);
  });

  it('JsProxy로 JS 전역까지 가도 네트워크 API가 지워져 있음', async () => {
    expect(runner.info.removedGlobals).toEqual(
      expect.arrayContaining(['fetch', 'WebSocket']),
    );
    // 진짜 경계는 JS 쪽: Python이 JsProxy를 손에 넣으면 Function 생성자로 globalThis까지 갈 수 있다.
    // (브라우저에서는 CSP가 문자열 → 코드 변환(Function)을 막는다: B27)
    const r = await runner.run(
      [
        'import sys',
        'f = sys.modules["pyodide.webloop"].scheduleCallback',
        'g = f.constructor("return globalThis")()',
        'for name in ["fetch", "WebSocket", "XMLHttpRequest", "EventSource", "Worker"]:',
        '    print(name, getattr(g, name, None))',
      ].join('\n'),
    );
    expect(r.stdout).toBe(
      'fetch None\nWebSocket None\nXMLHttpRequest None\nEventSource None\nWorker None\n',
    );
  });

  it('asyncio.run이 pyodide_js를 떼어 낸 탓에 깨지지 않음 (대역 모듈)', async () => {
    const r = await runner.run(
      'import asyncio\nasync def main():\n    return 5\nprint(asyncio.run(main()))',
    );
    expect(r.stderr).not.toContain('pyodide_js');
    if (runner.info.jspi) {
      expect(r.stdout).toBe('5\n');
    } else {
      // JSPI가 없으면(Node 22) Pyodide 자체가 run_until_complete를 못 한다. 원래 Pyodide와 같은 오류
      expect(r.stderr).toContain('stack switching not supported');
    }
  });
});

describe('출력 상한 (B15)', () => {
  it('끝없는 print는 상한에서 자르고 Worker 재시작 없이 멈춤', async () => {
    const before = runner.restarts;
    const r = await runner.run('while True:\n    print("x" * 50)');
    expect(r).toMatchObject({
      outcome: 'output-limit',
      success: false,
      truncated: true,
      hadException: false,
      isTimeout: false,
    });
    expect(r.fullStdout.length + r.fullStderr.length).toBeLessThanOrEqual(
      MAX_CAPTURE_LENGTH + core.OUTPUT_LIMIT_NOTICE.length,
    );
    expect(r.fullStderr).toContain('출력이 너무 많아서');
    expect(r.ms).toBeLessThan(1500);
    expect(runner.restarts).toBe(before);
    expect((await runner.run('print("다음")')).stdout).toBe('다음\n');
  });
});

describe('시간 제한', () => {
  it('CPU 무한 루프는 interrupt로 끊고 인스턴스를 유지', async () => {
    const before = runner.restarts;
    const r = await runner.run('n = 0\nwhile True:\n    n += 1', {
      timeoutMs: 500,
    });
    expect(r).toMatchObject({
      outcome: 'timeout',
      isTimeout: true,
      success: false,
      restarted: false,
    });
    expect(r.stderr).toBe('');
    expect(runner.restarts).toBe(before);
    expect((await runner.run('print("살아 있음")')).stdout).toBe('살아 있음\n');
  });

  it('KeyboardInterrupt를 삼키는 코드는 Worker를 다시 띄움', async () => {
    const before = runner.restarts;
    const r = await runner.run(
      'while True:\n    try:\n        while True:\n            pass\n    except KeyboardInterrupt:\n        pass',
      { timeoutMs: 300 },
    );
    expect(r).toMatchObject({
      outcome: 'timeout',
      isTimeout: true,
      restarted: true,
    });
    expect(runner.restarts).toBe(before + 1);
    expect((await runner.run('print("새 Worker")')).stdout).toBe('새 Worker\n');
  });
});

describe('JSPI (브라우저와 같은 조건)', () => {
  it('time.sleep 대기 중 stop은 Worker를 살린 채 stopped로 끝남', async () => {
    // worker_threads는 V8 플래그를 받지 않으므로 JSPI를 켠 Node 프로세스를 따로 띄운다
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        '--experimental-wasm-jspi',
        'scripts/pyodide/__tests__/fixtures/jspi-stop.mjs',
      ],
      { timeout: 60_000 },
    );
    const r = JSON.parse(stdout.trim().split('\n').at(-1)!);
    expect(r.jspi).toBe(true);
    expect(r.stopped).toMatchObject({
      outcome: 'stopped',
      hadException: false,
    });
    expect(r.stopped.wall).toBeLessThan(1000);
    expect(r.after.outcome).toBe('ok');
  });
});
