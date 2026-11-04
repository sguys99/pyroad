// Fixture -> checkable units, and the per-unit check procedure (shared by check.ts and content.test.ts).

import { readFileSync } from 'node:fs';
import type { Rule } from './validators.ts';
import { verdict } from './validators.ts';
import type { RunResult, Sandbox } from './sandbox.ts';

export interface FixtureStep {
  step_number: number;
  validation_type: string;
  expected_output: string;
  starter_code: string | null;
  solution_code: string | null;
}
export interface FixtureQuest {
  id: string;
  key: string; // "<stage>-<order>"
  title: string;
  validation_type: string;
  expected_output: string;
  starter_code: string | null;
  solution_code: string | null;
  steps: FixtureStep[] | null;
}
export interface Fixture {
  meta: Record<string, unknown>;
  quests: FixtureQuest[];
}

export interface Unit {
  key: string; // "1-1" or "7-1#3"
  questKey: string;
  title: string;
  rule: Rule;
  solution: string | null;
  /** code the student sees before typing anything (starter, or previous step + starter for projects) */
  initialCode: string;
  /** project: the quest-level rule the final step must also satisfy */
  questRule?: Rule;
}

export interface Patch {
  key: string; // unit key, e.g. "7-1#3"
  rule: Rule;
  note?: string;
}

export function loadFixture(path: string): Fixture {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const asRule = (validation_type: string, expected_output: string) => ({ validation_type, expected_output }) as Rule;

export function toUnits(fixture: Fixture, patches: Patch[] = []): Unit[] {
  const units: Unit[] = [];
  for (const q of fixture.quests) {
    if (q.steps?.length) {
      let carried = '';
      q.steps.forEach((s, i) => {
        // ProjectQuestShell: step 1 starts from its starter_code; step k = previous code + '\n' + starter_k
        const initialCode = i === 0 ? (s.starter_code ?? '') : s.starter_code ? carried + '\n' + s.starter_code : carried;
        units.push({
          key: `${q.key}#${s.step_number}`,
          questKey: q.key,
          title: `${q.title} (${s.step_number}/${q.steps!.length})`,
          rule: asRule(s.validation_type, s.expected_output),
          solution: s.solution_code,
          initialCode,
          questRule: i === q.steps!.length - 1 ? asRule(q.validation_type, q.expected_output) : undefined,
        });
        carried = s.solution_code ?? initialCode; // golden key / correct answer carried into the next step
      });
    } else {
      units.push({
        key: q.key,
        questKey: q.key,
        title: q.title,
        rule: asRule(q.validation_type, q.expected_output),
        solution: q.solution_code,
        initialCode: q.starter_code ?? '',
      });
    }
  }
  for (const p of patches) {
    const u = units.find((x) => x.key === p.key);
    if (!u) throw new Error(`patch target ${p.key} not found`);
    u.rule = p.rule;
  }
  return units;
}

export interface UnitResult {
  key: string;
  title: string;
  status: 'PASS' | 'FAIL' | 'FLAKY' | 'NO_SOLUTION';
  warnings: string[];
  runs: { passed: number; total: number; reasons: Record<string, number>; distinctStdout: number };
  seeded: { passed: number; total: number; failedSeeds: number[] };
  strict: { solutionPasses: boolean | null; initialPasses: boolean | null };
  initialPasses: boolean | null;
  questRulePasses: boolean | null;
  firstStdout: string | null;
  firstStderr: string | null;
  seededStdout: string[];
  ms: number[];
}

export interface CheckOptions {
  runs: number; // unseeded runs (realistic: like students)
  seeds: number[]; // deterministic seeded runs
}

const isCodeCheck = (r: Rule): boolean =>
  r.validation_type === 'code_check' || (r.validation_type === 'all' && r.rules.some(isCodeCheck));

export async function checkUnit(sb: Sandbox, u: Unit, opts: CheckOptions): Promise<UnitResult> {
  const res: UnitResult = {
    key: u.key, title: u.title, status: 'PASS', warnings: [],
    runs: { passed: 0, total: 0, reasons: {}, distinctStdout: 0 },
    seeded: { passed: 0, total: 0, failedSeeds: [] },
    strict: { solutionPasses: null, initialPasses: null },
    initialPasses: null, questRulePasses: null, firstStdout: null, firstStderr: null, seededStdout: [], ms: [],
  };
  // negative check first, like a student who presses "run" on the untouched editor
  if (u.initialCode.trim()) {
    const r0 = await sb.run(u.initialCode);
    res.initialPasses = verdict(u.rule, r0, u.initialCode).passed;
    if (isCodeCheck(u.rule)) res.strict.initialPasses = verdict(u.rule, r0, u.initialCode, { strictCodeCheck: true }).passed;
    if (res.initialPasses) res.warnings.push('시작 코드 그대로 실행해도 통과');
    if (r0.isTimeout) res.warnings.push('시작 코드 그대로 실행하면 무한 루프(타임아웃)');
  }
  if (!u.solution) {
    res.status = 'NO_SOLUTION';
    return res;
  }
  const stdouts = new Set<string>();
  let last: RunResult | null = null;
  for (let i = 0; i < opts.runs; i++) {
    // explicit entropy reseed: otherwise a previous seeded run leaves `random` deterministic
    const r = await sb.run(u.solution, { seed: 'entropy' });
    last = r;
    res.ms.push(r.ms);
    stdouts.add(r.stdout);
    if (i === 0) { res.firstStdout = r.stdout; res.firstStderr = r.stderr; }
    const v = verdict(u.rule, r, u.solution);
    res.runs.total++;
    if (v.passed) res.runs.passed++;
    else res.runs.reasons[v.reason!] = (res.runs.reasons[v.reason!] ?? 0) + 1;
  }
  res.runs.distinctStdout = stdouts.size;
  for (const seed of opts.seeds) {
    const r = await sb.run(u.solution, { seed });
    res.ms.push(r.ms);
    res.seededStdout.push(r.stdout);
    res.seeded.total++;
    if (verdict(u.rule, r, u.solution).passed) res.seeded.passed++;
    else res.seeded.failedSeeds.push(seed);
  }
  if (last && isCodeCheck(u.rule)) res.strict.solutionPasses = verdict(u.rule, last, u.solution, { strictCodeCheck: true }).passed;
  if (last && u.questRule) {
    res.questRulePasses = verdict(u.questRule, last, u.solution).passed;
    if (!res.questRulePasses) res.warnings.push('마지막 단계 정답이 퀘스트 전체 검증을 통과하지 못함');
  }
  if (res.firstStderr) res.warnings.push('정답 실행 시 stderr 출력');
  if (res.strict.solutionPasses === false) res.warnings.push('엄격 code_check(주석·문자열 제외)에서 정답이 실패');
  if (res.strict.initialPasses) res.warnings.push('엄격 code_check에서도 시작 코드가 통과');

  const allRuns = res.runs.total + res.seeded.total;
  const allPassed = res.runs.passed + res.seeded.passed;
  res.status = allPassed === allRuns ? 'PASS' : allPassed === 0 ? 'FAIL' : 'FLAKY';
  return res;
}
