// input() 대화형 채널 확인 스크립트 (P11-01, runtime.pyodide.test.ts).
//   node --experimental-wasm-jspi input.mjs jspi  → JSPI: input-request에 answer 메시지로 답 (브라우저 기본)
//   node input.mjs sw                             → JSPI 없음: readLineSync(SW 동기 XHR 대역)로 답
//   node input.mjs none                           → 둘 다 없음: InputUnavailable, 입력 없는 코드는 그대로
// 마지막 줄에 JSON 결과를 찍는다.
import { loadPyodide } from 'pyodide';

import { createRuntime } from '../../../../public/workers/pyodide-core.mjs';

const mode = process.argv[2];
const pyodide = await loadPyodide({ stdout: () => {}, stderr: () => {} });

const log = [];
const waiters = new Map();
/** sw 모드 답 큐: 'stop'이면 멈춤 */
let swAnswers = [];
let runtime;
/** jspi 모드: input-request가 오면 답할 값을 정하는 함수 */
let onRequest = () => {};

runtime = createRuntime(pyodide, {
  interactiveInput: true,
  readLineSync:
    mode === 'sw'
      ? () => {
          const next = swAnswers.shift();
          if (next === undefined) return null;
          return next === 'stop'
            ? { kind: 'stop' }
            : { kind: 'value', value: next };
        }
      : null,
  post: (msg) => {
    if (msg.type === 'stdout' || msg.type === 'stderr') {
      log.push([msg.type, msg.text]);
    } else if (msg.type === 'input-request') {
      log.push(['input-request', msg.channel]);
      onRequest(msg);
    } else if (msg.type === 'done') {
      waiters.get(msg.id)?.(msg);
    }
  },
});
const jspi = await runtime.canRunSync();

async function run(id, code, answers) {
  log.length = 0;
  swAnswers = [...answers];
  const queue = [...answers];
  onRequest = (msg) => {
    const next = queue.shift();
    setTimeout(() => {
      if (next === 'stop' || next === undefined)
        runtime.handle({ type: 'stop', id });
      else
        runtime.handle({
          type: 'answer',
          id,
          requestId: msg.requestId,
          value: next,
        });
    }, 20);
  };
  const t0 = performance.now();
  const done = new Promise((resolve) => waiters.set(id, resolve));
  void runtime.handle({ type: 'run', id, code });
  const msg = await done;
  const out = (kind) =>
    log
      .filter(([k]) => k === kind)
      .map(([, t]) => t)
      .join('');
  return {
    outcome: msg.outcome,
    errorType: msg.errorType,
    stdout: out('stdout'),
    stderr: out('stderr'),
    // 프롬프트가 input-request보다 먼저 왔는지 (스트리밍)
    order: log.map(([k]) => k),
    wall: Math.round(performance.now() - t0),
  };
}

const GREET =
  'name = input("이름? ")\nprint("안녕", name)\nimport sys\nline = sys.stdin.readline()\nprint(repr(line))';
const CLASS =
  'class Pet:\n    def __init__(self):\n        self.name = input("펫 이름: ")\np = Pet()\nprint(p.name + "!")';

const result = { mode, jspi };
result.greet = await run('g', GREET, ['철수', '둘째 줄']);
result.inInit = await run('c', CLASS, ['뭉치']);
result.stopped = await run('s', 'while True:\n    input("? ")', ['a', 'stop']);
result.after = await run('a', 'print("ok")', []);
console.log(JSON.stringify(result));
