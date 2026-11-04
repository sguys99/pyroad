// Does the Node harness reproduce the browser sandbox (and its holes)? prod = real worker file, fresh = proposal.
//   npx tsx experiments/sandbox-selftest.ts [--pyodide 0.29.3,0.27.5]

import { parseArgs } from 'node:util';
import { Sandbox, PROPOSED_EXTRA_BLOCKED, type Mode } from '../lib/sandbox.ts';
import { ruleMatches } from '../lib/validators.ts';

const { values: a } = parseArgs({ options: { pyodide: { type: 'string', default: '0.29.3,0.27.5' } } });

const CASES: [string, string, string?][] = [
  ['print', 'print("안녕")'],
  ['blocked import os', 'import os'],
  ['blocked via __import__', 'm = __import__("os")'],
  ['state leak (2nd run)', 'leak_me = 41', 'print(leak_me + 1)'],
  ['bypass __original_import', 'print(__original_import("os").name)'],
  ['bypass hook.__globals__', 'print(__import__.__globals__["_original_import" if "_original_import" in __import__.__globals__ else "__original_import"]("os").name)'],
  ['import js', 'import js; print(type(js).__name__)'],
  ['runtime error format', 'print(1/0)'],
  ['timeout (while True)', 'while True: pass'],
  ['alive after timeout', 'print("ok")'],
];

const short = (s: string) => s.trim().split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 60) ?? '';
for (const version of a.pyodide!.split(',')) {
  for (const mode of ['prod', 'fresh'] as Mode[]) {
    const sb = await Sandbox.create({ version, mode, timeoutMs: 2000, extraBlocked: mode === 'fresh' ? PROPOSED_EXTRA_BLOCKED : [] });
    console.log(`\n== ${version} ${mode}`);
    for (const [name, code, second] of CASES) {
      let r = await sb.run(code);
      if (second) r = await sb.run(second);
      const extra = name === 'runtime error format' ? ` | excepthook noise: ${r.stderr.includes('Error in sys.excepthook')} | source line shown: ${r.stderr.includes('print(1/0)')}` : '';
      const res = r.isTimeout ? `TIMEOUT (${Math.round(r.ms)} ms)` : r.success ? `ok  ${JSON.stringify(r.stdout.trim())}` : `err ${short(r.stderr)}`;
      console.log(`  ${name.padEnd(26)} ${res}${extra}`);
    }
    console.log(`  worker recreated after hang: ${sb.recreated}`);
    await sb.close();
  }
}

// B25: code_check is a plain substring test on the source
console.log('\n== B25 code_check (prod rule vs proposed strict rule)');
const rule = { validation_type: 'code_check', expected_output: 'while' } as const;
for (const code of ['# while 쓰면 돼요\nprint("정답!")', 'print("while")', 'n = 3\nwhile n > 0:\n    n -= 1', 'x = """\nwhile\n"""']) {
  console.log(`  ${JSON.stringify(code).padEnd(42)} prod=${ruleMatches(rule, '', code)} strict=${ruleMatches(rule, '', code, { strictCodeCheck: true })}`);
}
