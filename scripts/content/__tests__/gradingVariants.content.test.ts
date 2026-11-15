// 맞는 답을 다르게 쓴 코드도 채점을 통과하는지 실제 Pyodide 로 확인한다 (P10-09, `npm run test:content`)
//
// ① 모든 코드 퀘스트·프로젝트 단계의 정답을 기계적으로 바꾼 모양 (뜻은 같음)
//    탭 들여쓰기 · 2칸 들여쓰기 · 기호 옆 띄어쓰기 없앰(`book["x"]="y"`, `x%26`) · 빈 줄 추가 · 작은따옴표
// ② 아이들이 실제로 쓸 만한 다른 정답 (아래 HANDWRITTEN, 퀘스트 키 → 코드 또는 정답 고쳐 쓰기)
// ③ 틀린 코드는 떨어짐 (아래 WRONG — 규칙이 너무 넓어 통과하던 것, P10-10 플레이테스트 L1~L4)
// 각 모양을 시드 0(입력 시나리오마다)으로 실행해 정답과 같은 규칙(프로젝트 마지막 단계는 퀘스트 전체 규칙도)으로 채점한다.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXECUTION_TIMEOUT_MS } from '@/lib/pyodide/constants';
import { blankCommentsAndStrings } from '@/lib/quest/validation';

import { NodePyodideRunner } from '../../pyodide/nodeRunner';
import { CONTENT_DIR } from '../lib/paths';
import {
  judge,
  loadUnits,
  planRuns,
  ruleSummary,
  type CheckUnit,
} from '../lib/solutionCheck';

const IDENT = /[\p{L}\p{N}_]/u;
const isIdent = (c: string | undefined) => !!c && IDENT.test(c);

/** 위치마다 코드인지(문자열·주석 내용이 아닌지). 공백도 구분하려고 잠시 다른 글자로 바꿔 지워 본다 */
function codeMask(code: string): boolean[] {
  const marked = code.replace(/ /g, '\u0001');
  const blanked = blankCommentsAndStrings(marked);
  return Array.from(
    { length: code.length },
    (_, i) => blanked[i] === marked[i],
  );
}

/** 문자열 밖 줄의 처음 4칸 묶음을 `unit` 으로 */
function reindent(code: string, unit: string): string {
  const mask = codeMask(code);
  return code.replace(/^(?: {4})+/gm, (run, at: number) =>
    mask[at] ? unit.repeat(run.length / 4) : run,
  );
}

/** 문자열 밖에서 기호 옆 띄어쓰기를 지움 (들여쓰기·낱말 사이는 둠) */
function squeeze(code: string): string {
  const mask = codeMask(code);
  return code.replace(/ +/g, (run, at: number) => {
    const before = code[at - 1];
    if (!mask[at] || before === undefined || before === '\n') return run;
    return isIdent(before) && isIdent(code[at + run.length]) ? run : '';
  });
}

/** 문자열 밖 줄마다 앞에 빈 줄 */
function spaced(code: string): string {
  const mask = codeMask(code);
  return code.replace(/^(?=[^\n])/gm, (_, at: number) =>
    mask[at] ? '\n' : '',
  );
}

const VARIANTS: [string, (code: string) => string | null][] = [
  ['탭 들여쓰기', (c) => reindent(c, '\t')],
  ['2칸 들여쓰기', (c) => reindent(c, '  ')],
  ['기호 옆 띄어쓰기 없음', squeeze],
  ['빈 줄 추가', spaced],
  // 작은따옴표가 이미 있으면 바꾸면 뜻이 달라질 수 있어 건너뜀
  ['작은따옴표', (c) => (/['\\]/.test(c) ? null : c.replace(/"/g, "'"))],
];

/** 정답 코드에서 [찾을 글자, 바꿀 글자]를 차례로 바꾼 코드 */
type Edit = [from: string, to: string][];

function applyEdit(solution: string, edit: Edit): string {
  return edit.reduce((code, [from, to]) => {
    if (!code.includes(from)) throw new Error(`정답 코드에 없음: ${from}`);
    return code.replace(from, to);
  }, solution);
}

/** 다른 정답 (퀘스트 키 → 코드 또는 정답 고쳐 쓰기). 규칙이 지나치게 좁으면 여기서 걸린다 */
const HANDWRITTEN: Record<string, (string | Edit)[]> = {
  // U4: 1부터 세는 버그를 0으로 바꾸거나, 번호 없이 돌거나, 쉼표로 출력해도 맞는 고침
  'code-sea/5-8': [
    [['range(len(scores))', 'range(0, len(scores))']],
    [
      ['for i in range(len(scores)):', 'for s in scores:'],
      ['total + scores[i]', 'total + s'],
    ],
    [['print(f"평균: {avg}")', 'print("평균:", avg)']],
  ],
  // U5·U6: 다른 번호·글자 그대로
  'code-sea/5-10': [[['{basket[-1]}', '{basket[2]}']]],
  'code-sea/1-2': [[['{len(word)}', "{len('OCEAN')}"]]],
  // 프로젝트 빈칸의 다른 모양
  'code-sea/7-2#4': [[['left = left + record', 'left += record']]],
  'code-sea/7-2#5': [[['money > big_money', 'money >= big_money']]],
  'code-sea/7-4#3': [
    [['if check(word, answer):', 'if check(word, answer) == True:']],
  ],
  'code-sea/3-7': [
    'grid = [\n    [".", ".", ".", "."],\n    [".", "#", "X", "."],\n    ["#", ".", ".", "."],\n]\n\nfor r in range(0, len(grid)):\n    for c in range(0, len(grid[r])):\n        if grid[r][c] == "X":\n            print(f"보물은 {r}줄 {c}칸")\n',
  ],
  'code-sea/2-2': [
    "book = {'제목': '바다 탐험', '쪽수': 120}\nbook['빌린 사람']='하늘'\nbook['쪽수']=130\nprint(book)\nprint(f'이름표 수: {len(book)}')\n",
  ],
  'code-sea/1-10': [
    'abc = "abcdefghijklmnopqrstuvwxyz"\nword = "python"\nsecret = ""\nfor ch in word:\n    secret += abc[(abc.index(ch)+3)%26]\nprint(f"암호: {secret}")\n',
  ],
  'code-sea/5-1': [
    '# 버그버그 진료 기록\npatient = "버그버그"\ntemperature = 38\nfever=temperature-37\nprint(f"환자: {patient}")\nprint(f"체온: {temperature}도")\nprint(f"열이 {fever}도 높아요")\n',
  ],
  'code-sea/3-1': [
    'for r in range(3):\n\trow = ""\n\tfor c in range(4):\n\t\trow += "#"\n\tprint(row)\n',
  ],
};

/** 틀린 코드 (정답 고쳐 쓰기). 출력은 맞거나 비슷해도 떨어져야 함 */
const WRONG: Record<string, Edit[]> = {
  // L1: 한 번 굴린 눈을 100번 셈
  'code-sea/4-2': [[['n = random.randint(1, 6)', 'n = dice']]],
  // L2: 한 번도 안 돌고 "0번 만에 뽑았어요"
  'code-sea/4-8': [
    [['while prize != "황금 열쇠":', 'while prize == "황금 열쇠":']],
  ],
  // L3: 130 이상이 아니라 초과 (키 130인 친구가 빠짐)
  'code-sea/6-4': [[['if h >= 130:', 'if h > 130:']]],
  // L4: 규칙 글자가 시작 코드에 이미 있어 빈칸을 안 채워도 통과하던 단계
  'code-sea/7-2#4': [
    [
      ['left = left + record["금액"]', 'pass'],
      ['return left', 'return 1700'],
    ],
  ],
  'code-sea/7-2#5': [[['if money > big_money:', 'if name == "선물":']]],
  'code-sea/7-4#3': [
    [['if check(word, answer):\n        score = score + 1', 'score = 3']],
  ],
};

const { units } = loadUnits(CONTENT_DIR);
const byKey = new Map(units.map((u) => [u.key, u]));
let runner: NodePyodideRunner;

beforeAll(async () => {
  runner = await NodePyodideRunner.create({ timeoutMs: EXECUTION_TIMEOUT_MS });
}, 180_000);
afterAll(() => runner?.close());

/** 불합격 이유 (통과면 null) */
async function failure(unit: CheckUnit, code: string): Promise<string | null> {
  for (const p of planRuns(unit.scenarios, { seeds: 1, unseededRuns: 0 })) {
    const r = await runner.run(code, {
      seed: p.seed,
      stdin: p.stdin,
      keys: p.keys,
    });
    for (const rule of [unit.rule, unit.questRule]) {
      if (!rule) continue;
      const v = judge(rule, r, code, EXECUTION_TIMEOUT_MS, p.scenario);
      if (!v.passed)
        return [
          `${p.label} · 규칙 ${ruleSummary(rule)}`,
          ...v.detail,
          '--- 코드',
          code,
        ].join('\n');
    }
  }
  return null;
}

it('다른 정답·틀린 코드가 가리키는 퀘스트가 있음', () => {
  const keys = [...Object.keys(HANDWRITTEN), ...Object.keys(WRONG)];
  expect(keys.filter((k) => !byKey.get(k)?.solution)).toEqual([]);
});

describe('정답을 다르게 써도 통과', () => {
  for (const unit of units.filter((u) => u.solution))
    it(`${unit.key} ${unit.title}`, async () => {
      const codes = [
        ...VARIANTS.map(([name, f]) => [name, f(unit.solution!)] as const),
        ...(HANDWRITTEN[unit.key] ?? []).map(
          (c, i) =>
            [
              `다른 정답 ${i + 1}`,
              typeof c === 'string' ? c : applyEdit(unit.solution!, c),
            ] as const,
        ),
      ];
      for (const [name, code] of codes) {
        if (code === null || code === unit.solution) continue;
        const why = await failure(unit, code);
        expect(why, `${unit.where} — ${name}\n${why}`).toBeNull();
      }
    });
});

describe('틀린 코드는 떨어짐', () => {
  for (const [key, edits] of Object.entries(WRONG))
    it(key, async () => {
      const unit = byKey.get(key)!;
      for (const edit of edits) {
        const code = applyEdit(unit.solution!, edit);
        expect(
          await failure(unit, code),
          `${unit.where} — 통과하면 안 되는 코드\n${code}`,
        ).not.toBeNull();
      }
    });
});
