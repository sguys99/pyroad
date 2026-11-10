import { describe, it, expect } from 'vitest';

import { CONTENT_DIR } from '../../../../scripts/content/lib/paths';
import { buildRows } from '../../content/build';
import { loadContent } from '../../content/load';
import {
  blankCommentsAndStrings,
  codeContains,
  type ValidationRule,
} from '../validation';

// seed(= content/ 원본)의 code_check 규칙마다 정답 코드가 엄격 code_check를 통과하는지 확인한다 (B25).
// P1-12부터 supabase/seed.sql은 content/ 생성물이므로 SQL 텍스트 대신 content/를 읽는다.
// `all` 안의 code_check(B09·B30)도 포함한다. Pyodide 없이 코드 텍스트만 본다.
// 정답을 실제로 실행해 규칙 전체를 확인하는 것은 P1-13 자동 검증(`npm run test:content`).

const { rows, meta } = buildRows(loadContent(CONTENT_DIR));

type CodeCheckRule = Extract<ValidationRule, { type: 'code_check' }>;

function codeChecksIn(rule: ValidationRule): CodeCheckRule[] {
  if (rule.type === 'code_check') return [rule];
  if (rule.type === 'all') return rule.rules.flatMap(codeChecksIn);
  return [];
}

// 퀴즈는 실행할 코드가 없음 (P7-01)
const codeCheckUnits = rows.quests
  .filter((q) => q.quest_type !== 'quiz')
  .flatMap((q) => {
    const m = meta.get(q.id)!;
    const key = rows.answer_keys.find((k) => k.quest_id === q.id)!;
    const stageOrder = rows.stages.find((s) => s.id === q.stage_id)!.order;
    const label = `${stageOrder}-${q.order}`;
    // 프로젝트 전체 규칙은 마지막 단계 정답이 통과해야 함
    const units = [
      {
        label,
        rule: m.rule,
        solution: key.solution_code ?? key.steps.at(-1)?.solution_code,
      },
      ...m.steps.map((s) => ({
        label: `${label}#${s.step_number}`,
        rule: s.rule,
        solution: key.steps.find((a) => a.step_number === s.step_number)
          ?.solution_code,
      })),
    ];
    return units.flatMap((u) =>
      codeChecksIn(u.rule).map((rule) => ({
        label: u.label,
        rule,
        solution: u.solution,
      })),
    );
  });

describe('content/ code_check 규칙과 정답 코드', () => {
  it('code_check 규칙을 읽음', () => {
    expect(rows.quests.length).toBeGreaterThan(0);
    expect(codeCheckUnits.length).toBeGreaterThan(0);
  });

  it.each(codeCheckUnits)(
    '$label: 정답 코드가 엄격 code_check "$rule.expected" 통과',
    ({ rule, solution }) => {
      expect(solution, '정답 코드가 없음').toBeTypeOf('string');
      expect(
        codeContains(solution!, rule.expected, { wholeWord: rule.whole_word }),
      ).toBe(true);
    },
  );

  it.each(codeCheckUnits)(
    '$label: 규칙 패턴이 문자열·주석 내용에 기대지 않음',
    ({ rule }) => {
      // 패턴 자체에 문자열 내용이 있으면 엄격 검사로는 절대 통과할 수 없다
      expect(blankCommentsAndStrings(rule.expected)).toBe(rule.expected);
    },
  );
});
