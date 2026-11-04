// P0-05 / P11-05 prototype: scripted stdin for validation.
//
// Feeds predefined input lines to a student program with plain `pyodide.setStdin`
// (no SharedArrayBuffer / Service Worker / JSPI needed, because all answers are known
// up front and can be returned synchronously). Works the same way inside the browser
// worker (validation run) and in Node (CI, P0-09 / P1-13).
//
// usage: node node/scripted-stdin.mjs [pyodide-package-dir]
//   default: ../node_modules/pyodide (314.0.7). Pass ../../../node_modules/pyodide for 0.29.3.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(process.argv[2] ?? path.join(here, '../node_modules/pyodide'));
const { loadPyodide } = await import(pathToFileURL(path.join(pkgDir, 'pyodide.mjs')).href);

const t0 = performance.now();
const pyodide = await loadPyodide({ indexURL: pkgDir + path.sep });
const loadMs = performance.now() - t0;

/**
 * Run `code` with scripted stdin.
 * @param {string} code  student program
 * @param {string[]} inputs  lines returned by successive input() calls
 * @param {{ seed?: number, echo?: boolean, maxOutput?: number }} opts
 *   echo=true  -> transcript also shows the answers (like a terminal session)
 *   echo=false -> stdout only (same as `python prog.py < inputs.txt`)
 */
function runScenario(code, inputs, { seed, echo = false, maxOutput = 5000 } = {}) {
  const queue = [...inputs];
  let consumed = 0;
  let out = '';
  let err = '';
  const dec = new TextDecoder();

  pyodide.setStdout({
    write(buf) {
      out += dec.decode(buf, { stream: true });
      if (out.length > maxOutput) throw new Error('output limit');
      return buf.length;
    },
  });
  pyodide.setStderr({ write(buf) { err += dec.decode(buf, { stream: true }); return buf.length; } });
  pyodide.setStdin({
    stdin() {
      if (queue.length === 0) return null; // -> EOFError in Python ("입력이 더 필요해요")
      consumed += 1;
      const line = queue.shift();
      if (echo) out += line + '\n';
      return line; // Pyodide appends "\n" when missing (checked below)
    },
  });

  // fresh namespace per run (B15: no state leaking between runs)
  const ns = pyodide.globals.get('dict')();
  let error = null;
  try {
    if (seed !== undefined) pyodide.runPython(`import random; random.seed(${seed})`, { globals: ns });
    pyodide.runPython(code, { globals: ns, filename: '<student>' });
  } catch (e) {
    // PythonError: keep only the last traceback lines pointing at <student>
    error = { type: e.type, message: String(e.message).trim().split('\n').slice(-3).join('\n') };
  } finally {
    ns.destroy();
    pyodide.setStdin(); // reset to default
  }
  return { out, err, error, consumed, leftover: queue.length };
}

const GUESS = `
import random

def ask_number(prompt):
    while True:
        text = input(prompt)
        try:
            return int(text)
        except ValueError:
            print("숫자로 입력해 주세요!")

def play():
    secret = random.randint(1, 100)
    tries = 0
    while True:
        guess = ask_number("1부터 100 사이 숫자: ")
        tries += 1
        if guess < secret:
            print("더 큰 수예요!")
        elif guess > secret:
            print("더 작은 수예요!")
        else:
            print(f"정답! {tries}번 만에 맞혔어요.")
            return tries

play()
`;

const AGE = `print("나이 계산기")
name = input("이름: ")
age = int(input("나이: "))
print(f"{name}님은 내년에 {age + 1}살!")
`;

const STDIN_API = `import sys
a = sys.stdin.readline()
b = input()
print(repr(a), repr(b))
`;

// 1) find secret for seed 42 first (so the scenario is deterministic) — B09/P11-15
const probe = runScenario('import random; print(random.randint(1, 100))', [], { seed: 42 });
const secret = Number(probe.out.trim());

const cases = [
  ['guess: seed 42, 3 tries incl. non-number', GUESS, ['abc', '50', String(secret > 50 ? 75 : 25), String(secret)], { seed: 42 }],
  ['guess: same, echo transcript', GUESS, ['abc', '50', String(secret)], { seed: 42, echo: true }],
  ['guess: inputs run out -> EOFError', GUESS, ['50'], { seed: 42 }],
  ['age: ok', AGE, ['파이', '10'], {}],
  ['age: int("열살") -> ValueError line 3', AGE, ['파이', '열살'], {}],
  ['sys.stdin.readline vs input (newline handling)', STDIN_API, ['first', 'second'], {}],
];

console.log(`pyodide ${pyodide.version} (python ${pyodide.runPython('import sys; sys.version.split()[0]')}) loaded in ${loadMs.toFixed(0)} ms`);
console.log(`seed 42 -> secret ${secret}\n`);
for (const [name, code, inputs, opts] of cases) {
  const t = performance.now();
  const r = runScenario(code, inputs, opts);
  const ms = performance.now() - t;
  console.log(`### ${name}  (${ms.toFixed(1)} ms, inputs used ${r.consumed}/${inputs.length})`);
  console.log(r.out.trimEnd().split('\n').map((l) => '  | ' + l).join('\n'));
  if (r.error) console.log(`  !! ${r.error.type}: ${r.error.message.replace(/\n/g, ' / ')}`);
  console.log();
}

// 2) state isolation check: a variable from a previous run must not exist in the next run
runScenario('leak = 123', []);
const leak = runScenario('print(leak)', []);
console.log('### fresh namespace per run ->', leak.error ? `${leak.error.type} (ok, no leak)` : 'LEAKED');
