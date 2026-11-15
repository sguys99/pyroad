// 디자인 카탈로그 그림판 견본(P11-02)의 명령 스트림을 실제 Pyodide + shim으로 녹화한다.
//   npx tsx scripts/pyodide/turtle/record-samples.ts
// → src/app/dev/design/_catalog/turtleSamples.json (코드 + 명령). 견본은 실행기 없이 이 명령을 재생한다 (갤러리 재생과 같은 방식, Q74 ①)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { NodePyodideRunner } from '../nodeRunner';

const SAMPLES = fileURLToPath(new URL('./samples/', import.meta.url));
const OUT = fileURLToPath(
  new URL(
    '../../../src/app/dev/design/_catalog/turtleSamples.json',
    import.meta.url,
  ),
);
const NAMES = ['square', 'star', 'flower', 'spiral', 'bars', 'race'] as const;

async function main() {
  const runner = await NodePyodideRunner.create();
  const out: Record<
    string,
    { code: string; stdout: string; commands: unknown[][] }
  > = {};
  for (const name of NAMES) {
    const code = readFileSync(`${SAMPLES}${name}.py`, 'utf8');
    const r = await runner.run(code, { seed: 3 });
    if (!r.success) throw new Error(`${name}: ${r.stderr}`);
    out[name] = { code, stdout: r.stdout, commands: r.turtle };
  }
  await runner.close();
  writeFileSync(OUT, `${JSON.stringify(out)}\n`);
  console.log('wrote', OUT);
}

void main();
