import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { blankCommentsAndStrings, codeContains } from '../validation';

// seed.sql의 code_check 규칙마다 정답 코드가 엄격 code_check를 통과하는지 확인한다 (B25).
// 정답 코드는 00001 Section 6과 seed.sql 끝의 보정 구간(B08)에서 읽고, 실행 순서대로 나중 것이 이긴다.
// Pyodide 없이 SQL 텍스트만 가볍게 읽는다. P1-11 Content as Code 이후에는 content/ 원본과
// P1-13 자동 검증으로 대체한다.

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const SEED = read('../../../../supabase/seed.sql');
const MIGRATION = read(
  '../../../../supabase/migrations/00001_v0.1.0_initial_schema.sql',
);

// SQL 문자열 리터럴 안의 '' → '
const unquote = (s: string) => s.replace(/''/g, "'");

interface Rule {
  validation_type: string;
  expected_output: string;
}

interface SeedQuest extends Rule {
  id: string;
  steps: Rule[];
}

function parseSeedQuests(sql: string): SeedQuest[] {
  const row =
    /INSERT INTO public\.quests \([^)]*\)\s*VALUES\s*\(\s*'([0-9a-f-]{36})',[\s\S]*?'(\{[\s\S]*?\})'::jsonb,\s*'(\w+)',\s*'((?:[^']|'')*)'/g;
  return [...sql.matchAll(row)].map((m) => {
    const skeleton = JSON.parse(unquote(m[2])) as { steps?: Rule[] };
    return {
      id: m[1],
      validation_type: m[3],
      expected_output: unquote(m[4]),
      steps: skeleton.steps ?? [],
    };
  });
}

/** id → { main?: 정답, steps: 단계별 정답 }. 여러 SQL을 실행 순서대로 받는다 */
function parseSolutions(...sqls: string[]) {
  const solutions = new Map<string, { main?: string; steps: string[] }>();
  const statement =
    /UPDATE public\.quests SET prompt_skeleton = ([\s\S]*?)\nWHERE id = '([0-9a-f-]{36})';/g;
  const value = /'\{(?:steps,(\d+),)?solution_code\}',\s*'((?:[^']|'')*)'/g;
  for (const [, body, id] of sqls.flatMap((sql) => [
    ...sql.matchAll(statement),
  ])) {
    const entry = solutions.get(id) ?? { steps: [] };
    for (const [, step, json] of body.matchAll(value)) {
      const code = JSON.parse(unquote(json)) as string;
      if (step === undefined) entry.main = code;
      else entry.steps[Number(step)] = code;
    }
    solutions.set(id, entry);
  }
  return solutions;
}

const quests = parseSeedQuests(SEED);
const solutions = parseSolutions(MIGRATION, SEED);

const codeCheckUnits = quests.flatMap((q) => {
  const sol = solutions.get(q.id);
  const units = [{ label: q.id, rule: q as Rule, solution: sol?.main }];
  q.steps.forEach((rule, i) =>
    units.push({ label: `${q.id}#${i + 1}`, rule, solution: sol?.steps[i] }),
  );
  return units.filter((u) => u.rule.validation_type === 'code_check');
});

describe('seed.sql code_check 규칙과 정답 코드', () => {
  it('seed.sql의 퀘스트를 빠짐없이 읽음', () => {
    const inserts = SEED.match(/INSERT INTO public\.quests /g) ?? [];
    expect(quests.length).toBeGreaterThan(0);
    expect(quests.length).toBe(inserts.length);
    expect(codeCheckUnits.length).toBeGreaterThan(0);
  });

  it.each(codeCheckUnits)(
    '$label: 정답 코드가 엄격 code_check "$rule.expected_output" 통과',
    ({ rule, solution }) => {
      expect(solution, '정답 코드가 없음').toBeTypeOf('string');
      expect(codeContains(solution!, rule.expected_output)).toBe(true);
    },
  );

  it.each(codeCheckUnits)(
    '$label: 규칙 패턴이 문자열·주석 내용에 기대지 않음',
    ({ rule }) => {
      // 패턴 자체에 문자열 내용이 있으면 엄격 검사로는 절대 통과할 수 없다
      expect(blankCommentsAndStrings(rule.expected_output)).toBe(
        rule.expected_output,
      );
    },
  );
});
