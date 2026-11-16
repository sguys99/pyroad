// 키 입력·프레임 루프 확인 스크립트 (P11-04, game.pyodide.test.ts).
//   node --experimental-wasm-jspi keys.mjs jspi  → JSPI: 페이지처럼 `key` 메시지를 보냄 (자는 동안 받음)
//   node keys.mjs sw                             → JSPI 없음: sleepSync(SW 동기 XHR 대역)의 답에 키가 실려 옴
// 마지막 줄에 JSON 결과를 찍는다.
import { loadPyodide } from 'pyodide';

import { createRuntime } from '../../../../public/workers/pyodide-core.mjs';

const mode = process.argv[2];
const pyodide = await loadPyodide({ stdout: () => {}, stderr: () => {} });

const log = [];
const waiters = new Map();
/** 보낼 키 (페이지에서 누른 키) */
let toSend = [];
let runtime;

runtime = createRuntime(pyodide, {
  sleepSync:
    mode === 'sw'
      ? (_runId, _ms, onKeys) => {
          // SW는 자는 동안 쌓인 키를 답에 싣는다: 잠마다 하나씩
          const key = toSend.shift();
          if (key) onKeys([key]);
          return 'ok';
        }
      : null,
  post: (msg) => {
    if (msg.type === 'stdout') log.push(['stdout', msg.text]);
    else if (msg.type === 'keys') {
      log.push(['keys', msg.channel]);
      if (mode === 'jspi') {
        // 페이지: 조종판이 나오면 누른 키를 Worker로 (Python은 다음 잠에서 받음)
        for (const key of toSend.splice(0))
          runtime.handle({ type: 'key', id: msg.id, key });
      }
    } else if (msg.type === 'sleep' || msg.type === 'wake')
      log.push([msg.type]);
    else if (msg.type === 'done') waiters.get(msg.id)?.(msg);
  },
});
const jspi = await runtime.canRunSync();

async function run(id, code, keys) {
  log.length = 0;
  toSend = [...keys];
  const done = new Promise((resolve) => waiters.set(id, resolve));
  void runtime.handle({ type: 'run', id, code });
  const msg = await done;
  return {
    outcome: msg.outcome,
    stdout: log
      .filter(([k]) => k === 'stdout')
      .map(([, t]) => t)
      .join(''),
    order: log.map(([k]) => k).filter((k) => k !== 'stdout'),
  };
}

const GAME = [
  'from pyroad import get_key',
  'import time',
  'got = []',
  'for frame in range(4):',
  '    key = get_key()',
  '    got.append(key)',
  '    time.sleep(0.01)',
  'print(got)',
].join('\n');

const result = { mode, jspi };
result.game = await run('g', GAME, ['Left', 'space']);
console.log(JSON.stringify(result));
