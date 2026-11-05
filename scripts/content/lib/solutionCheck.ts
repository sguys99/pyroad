// 정답 코드 자동 검증 (P1-13, §2.4): content/ → 검증 JSON(toCheckFixture) → 검증 단위 → Node Pyodide 실행 → 판정
//
// - 판정은 앱과 같은 순서입니다. 실행이 성공(예외 없음, isRunSuccessful)해야 하고, 그다음 DB 저장 형태의 규칙
//   (validation_type + expected_output, `all`·`contains_any`는 JSON 문자열)을 `validateResult`로 봅니다(grade.ts 와 같은 함수).
// - 프로젝트 k단계의 시작 코드는 화면(useQuestSession)과 같게 "k-1단계 정답 + 줄바꿈 + k단계 시작 코드"입니다.
// - 실행마다 시드를 명시합니다. 새 namespace 여도 `random` 같은 모듈 상태는 남아서, 시드를 안 넣으면 앞 실행의 시드가 이어집니다.
//   "무시드" 실행도 JS 에서 뽑은 무작위 시드를 넣고, 실패하면 그 시드를 알려 줘 재현할 수 있게 합니다.
// - 실패 메시지는 콘텐츠 작성자가 바로 고칠 수 있게 파일 위치·시드·규칙·기대값과 실제 출력의 차이를 담습니다.
//
// Pyodide 를 띄우지 않는 부분(단위 펼치기, 실행 계획, 판정 설명)은 순수 함수라 빠른 단위 테스트에서도 씁니다.

import { randomInt } from 'node:crypto';
import { relative } from 'node:path';

import {
  buildRows,
  toCheckFixture,
  type CheckFixture,
} from '@/lib/content/build';
import { loadContent } from '@/lib/content/load';
import type { InputScenario } from '@/lib/content/schema';
import {
  parseStoredRule,
  validateResult,
  validateRule,
  type StoredRule,
  type ValidationRule,
  type ValidationType,
} from '@/lib/quest/validation';

import type {
  NodePyodideRunner,
  NodeRunnerOptions,
  NodeRunResult,
} from '../../pyodide/nodeRunner';
import { REPO_ROOT } from './paths';

// ------------------------------------------------------------
// 검증 단위 (코드 퀘스트 1개 = 1단위, 프로젝트는 단계마다 1단위)
// ------------------------------------------------------------

export interface CheckUnit {
  /** `1-1`(코드 퀘스트) 또는 `7-1#3`(프로젝트 3단계) */
  key: string;
  questKey: string;
  questId: string;
  /** `카운트다운` 또는 `숫자 맞추기 게임 3/5단계` */
  title: string;
  /** 고칠 곳. 예: `content/worlds/…/07-countdown.yaml answer` · `… steps[2].answer`. JSON 만 있으면 null */
  where: string | null;
  /** DB 저장 형태의 규칙 */
  rule: StoredRule;
  solution: string | null;
  /** 학생이 처음 보는 코드 (프로젝트: 이전 단계 정답 + 이 단계 시작 코드) */
  initialCode: string;
  scenarios: InputScenario[] | null;
  /** 프로젝트 마지막 단계: 퀘스트 전체 규칙 (정답이 이것도 통과해야 함) */
  questRule?: StoredRule;
  questRuleWhere?: string | null;
}

/** useQuestSession 의 appendStarter 와 같음: 이전 단계 코드 아래에 다음 단계 시작 코드를 붙인다 */
export function appendStarter(code: string, starter: string): string {
  if (code && starter) return code + '\n' + starter;
  return code || starter;
}

const stored = (validation_type: string, expected_output: string) => ({
  validation_type: validation_type as ValidationType,
  expected_output,
});

/** 검증 JSON → 검증 단위. `fileOf`는 퀘스트 id → YAML 경로(실패 메시지용) */
export function toUnits(
  fixture: CheckFixture,
  fileOf: (questId: string) => string | undefined = () => undefined,
): CheckUnit[] {
  const units: CheckUnit[] = [];
  for (const q of fixture.quests) {
    const file = fileOf(q.id);
    const at = (path: string) => (file ? `${file} ${path}` : null);
    if (!q.steps?.length) {
      units.push({
        key: q.key,
        questKey: q.key,
        questId: q.id,
        title: q.title,
        where: at('answer'),
        rule: stored(q.validation_type, q.expected_output),
        solution: q.solution_code,
        initialCode: q.starter_code ?? '',
        scenarios: q.scenarios ?? null,
      });
      continue;
    }
    // 1단계 화면은 단계 시작 코드만, k단계는 k-1단계에서 통과한 코드 + k단계 시작 코드
    let previous = '';
    q.steps.forEach((s, i) => {
      const initialCode = appendStarter(previous, s.starter_code ?? '');
      const isLast = i === q.steps!.length - 1;
      units.push({
        key: `${q.key}#${s.step_number}`,
        questKey: q.key,
        questId: q.id,
        title: `${q.title} ${s.step_number}/${q.steps!.length}단계`,
        where: at(`steps[${i}].answer`),
        rule: stored(s.validation_type, s.expected_output),
        solution: s.solution_code,
        initialCode,
        scenarios: s.scenarios ?? null,
        ...(isLast && {
          questRule: stored(q.validation_type, q.expected_output),
          questRuleWhere: at('answer.validation'),
        }),
      });
      // 정답이 없으면(①에서 실패) 다음 단계는 학생이 이 단계 코드를 그대로 둔 것으로 본다
      previous = s.solution_code ?? initialCode;
    });
  }
  return units;
}

/** content/ 를 메모리에서 빌드해 검증 단위를 만든다 (content:build 와 같은 함수, 파일은 쓰지 않음) */
export function loadUnits(contentDir: string) {
  const tree = loadContent(contentDir);
  const { rows, meta, warnings } = buildRows(tree);
  const fixture = toCheckFixture(rows, {
    generatedBy: 'npm run test:content',
    source: `content/ (${tree.hash})`,
    meta,
  });
  const files = new Map(
    tree.worlds.flatMap((w) =>
      w.stages.flatMap((s) =>
        s.quests.map((q) => [q.quest.id, displayPath(q.file)] as const),
      ),
    ),
  );
  return {
    units: toUnits(fixture, (id) => files.get(id)),
    warnings,
    hash: tree.hash,
    questCount: fixture.quests.length,
  };
}

function displayPath(file: string): string {
  const rel = relative(REPO_ROOT, file);
  return rel.startsWith('..') ? file : rel;
}

/** `TEST_CONTENT_ONLY` 필터: 퀘스트 키(`7-1`), 단위 키(`7-1#3`), 퀘스트 id 중 하나와 같으면 남김 */
export function filterUnits(units: CheckUnit[], only: string[]): CheckUnit[] {
  if (only.length === 0) return units;
  return units.filter(
    (u) =>
      only.includes(u.key) ||
      only.includes(u.questKey) ||
      only.includes(u.questId),
  );
}

// ------------------------------------------------------------
// 실행 계획 (시드 0~N-1 + 무시드 M회, 입력 시나리오마다)
// ------------------------------------------------------------

export interface PlannedRun {
  /** 메시지용 이름. 예: `시드 3`, `무시드(시드 2918734)`, `시나리오 2 · 시드 42` */
  label: string;
  seed: number;
  /** input() 에 들어갈 줄. 없으면 input() 이 EOFError */
  stdin?: string[];
}

export interface PlanOptions {
  /** 고정 시드 개수 (0 ~ seeds-1). CI 기본 10 */
  seeds: number;
  /** 무시드 실행 횟수. PR 기본 1, main 은 20 */
  unseededRuns: number;
  /** 무시드 실행에 넣을 시드 (테스트에서 고정할 때만 바꿈) */
  randomSeed?: () => number;
}

export function planRuns(
  scenarios: InputScenario[] | null,
  options: PlanOptions,
): PlannedRun[] {
  const randomSeed = options.randomSeed ?? (() => randomInt(2 ** 32));
  const list: (InputScenario | null)[] = scenarios?.length ? scenarios : [null];
  return list.flatMap((scenario, i) => {
    const prefix = scenarios?.length ? `시나리오 ${i + 1} · ` : '';
    const stdin = scenario ? { stdin: [...scenario.inputs] } : {};
    // 시나리오의 입력이 특정 시드(예: 비밀 숫자)에 맞춰져 있으면 그 시드로만
    if (scenario?.seed !== undefined) {
      return [
        {
          label: `${prefix}시드 ${scenario.seed}`,
          seed: scenario.seed,
          ...stdin,
        },
      ];
    }
    const seeded = Array.from({ length: options.seeds }, (_, s) => ({
      label: `${prefix}시드 ${s}`,
      seed: s,
      ...stdin,
    }));
    const unseeded = Array.from({ length: options.unseededRuns }, () => {
      const seed = randomSeed();
      return { label: `${prefix}무시드(시드 ${seed})`, seed, ...stdin };
    });
    return [...seeded, ...unseeded];
  });
}

// ------------------------------------------------------------
// 판정 (앱과 같은 순서) + 사람이 읽는 실패 설명
// ------------------------------------------------------------

type RunLike = Pick<
  NodeRunResult,
  'success' | 'outcome' | 'stdout' | 'stderr' | 'isTimeout'
>;

export interface Verdict {
  passed: boolean;
  /** 불합격 이유 (여러 줄). 통과면 빈 배열 */
  detail: string[];
}

export function judge(
  rule: StoredRule,
  run: RunLike,
  code: string,
  timeoutMs = 5000,
): Verdict {
  if (!run.success) {
    return { passed: false, detail: runFailure(run, timeoutMs) };
  }
  // 채점 API(grade.ts)는 기준이 비면 채점하지 않으므로 학생은 절대 통과 못 함
  if (!rule.expected_output) {
    return {
      passed: false,
      detail: ['기준값(expected)이 비어 있어 채점 API 가 채점하지 않아요'],
    };
  }
  const { passed } = validateResult({
    validationType: rule.validation_type,
    expectedOutput: rule.expected_output,
    stdout: run.stdout,
    studentCode: code,
  });
  if (passed) return { passed, detail: [] };
  const parsed = parseStoredRule(rule.validation_type, rule.expected_output);
  if (!parsed) {
    return {
      passed,
      detail: [
        `규칙을 읽을 수 없어요 (validation_type=${rule.validation_type}, expected_output=${JSON.stringify(rule.expected_output)})`,
      ],
    };
  }
  return { passed, detail: explainRule(parsed, run.stdout, code) };
}

function runFailure(run: RunLike, timeoutMs: number): string[] {
  if (run.isTimeout) {
    return [
      `시간 초과: ${timeoutMs / 1000}초 안에 끝나지 않았어요 (무한 루프?)`,
      ...block('끝나기 전까지의 출력 (끝 5줄)', tail(run.stdout, 5)),
    ];
  }
  if (run.outcome === 'output-limit') {
    return ['출력이 너무 많아 실행을 멈췄어요 (출력 상한)'];
  }
  const lines = run.stderr.trimEnd().split('\n');
  return [
    `실행 오류: ${lines[lines.length - 1] || run.outcome}`,
    ...block('stderr (끝 8줄)', tail(run.stderr, 8)),
    ...block('stdout', run.stdout),
  ];
}

/** 규칙 한 줄 요약. 예: `all[code_check "elif", contains_any ["커요","작아요","정답"]]` */
export function ruleSummary(rule: StoredRule): string {
  const parsed = parseStoredRule(rule.validation_type, rule.expected_output);
  return parsed
    ? summarize(parsed)
    : `${rule.validation_type} (읽을 수 없음) ${JSON.stringify(rule.expected_output)}`;
}

function summarize(rule: ValidationRule): string {
  switch (rule.type) {
    case 'all':
      return `all[${rule.rules.map(summarize).join(', ')}]`;
    case 'contains_any':
      return `contains_any ${JSON.stringify(rule.expected)}`;
    case 'code_check':
      return `code_check ${JSON.stringify(rule.expected)}${rule.whole_word ? ' (whole_word)' : ''}`;
    default:
      return `${rule.type} ${JSON.stringify(rule.expected)}`;
  }
}

function describeRule(rule: ValidationRule): string {
  switch (rule.type) {
    case 'output_match':
      return 'output_match: 출력 전체가 기대 출력과 같아야 해요 (앞뒤 공백·줄바꿈만 무시)';
    case 'contains':
      return `contains: 출력에 ${JSON.stringify(rule.expected)}가 들어 있어야 해요`;
    case 'contains_any':
      return `contains_any: 출력에 ${rule.expected.map((e) => JSON.stringify(e)).join(', ')} 중 하나가 들어 있어야 해요`;
    case 'code_check':
      return `code_check: 코드에 ${JSON.stringify(rule.expected)}가 있어야 해요 (주석·문자열 안은 세지 않음${rule.whole_word ? ', 단어 단위' : ''})`;
    case 'all':
      return 'all: 아래 규칙을 모두 통과해야 해요';
  }
}

/** 어떤 (하위) 규칙이 왜 실패했는지. output_match 는 기대/실제 줄 단위 차이를 붙인다 */
export function explainRule(
  rule: ValidationRule,
  stdout: string,
  code: string,
): string[] {
  const ctx = { stdout, studentCode: code };
  let showOutput = false;
  let showCode = false;
  const walk = (r: ValidationRule, indent: string): string[] => {
    const ok = validateRule(r, ctx);
    const head = `${indent}${ok ? '[통과]' : '[실패]'} ${describeRule(r)}`;
    if (r.type === 'all') {
      return [head, ...r.rules.flatMap((child) => walk(child, indent + '  '))];
    }
    if (ok) return [head];
    if (r.type === 'output_match') {
      return [
        head,
        ...lineDiff(r.expected.trim(), stdout.trim()).map(
          (l) => `${indent}    ${l}`,
        ),
      ];
    }
    if (r.type === 'code_check') showCode = true;
    else showOutput = true;
    return [head];
  };
  const lines = walk(rule, '');
  if (showOutput) lines.push(...block('실제 출력', stdout));
  if (showCode) lines.push(...block('검사한 코드', code));
  return lines;
}

const MAX_DIFF_LINES = 40;

/**
 * 줄 단위 차이 (LCS). `  ` 같음, `- ` 기대에만, `+ ` 실제에만.
 * 앞뒤 공백이 있는 줄은 따옴표로 보여 줌 (output_match 는 줄 안의 공백을 무시하지 않음)
 */
export function lineDiff(expected: string, actual: string): string[] {
  const a = expected.split('\n');
  const b = actual.split('\n');
  // 출력이 아주 길면 LCS 표가 커지므로 앞부분만 비교
  const cap = 400;
  const n = Math.min(a.length, cap);
  const m = Math.min(b.length, cap);
  const lcs = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const show = (line: string) =>
    line !== line.trim() || line === '' ? JSON.stringify(line) : line;
  const out: string[] = ['--- 기대  +++ 실제'];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      out.push(`- ${show(a[i++])}`);
    } else {
      out.push(`+ ${show(b[j++])}`);
    }
  }
  if (a.length > cap || b.length > cap)
    out.push('… (400줄 넘는 부분은 비교하지 않음)');
  return out.length > MAX_DIFF_LINES
    ? [
        ...out.slice(0, MAX_DIFF_LINES),
        `… (${out.length - MAX_DIFF_LINES}줄 더)`,
      ]
    : out;
}

/** 여러 줄 텍스트를 `| ` 들여쓰기 블록으로 (최대 20줄) */
function block(title: string, text: string): string[] {
  const body = text.replace(/\n$/, '');
  if (body === '') return [`${title}: (없음)`];
  const lines = body.split('\n');
  const shown = lines.slice(0, 20).map((l) => `  | ${l}`);
  if (lines.length > 20) shown.push(`  | … (${lines.length - 20}줄 더)`);
  return [`${title}:`, ...shown];
}

function tail(text: string, count: number): string {
  return text.replace(/\n$/, '').split('\n').slice(-count).join('\n');
}

// ------------------------------------------------------------
// 단위 하나 실행
// ------------------------------------------------------------

export interface RunRecord {
  label: string;
  seed: number;
  passed: boolean;
  detail: string[];
  stdout: string;
  isTimeout: boolean;
  /** 출력 상한(무한 출력 루프 등)에 걸려 실행기가 멈춤 */
  isOutputLimit: boolean;
  ms: number;
  /** 프로젝트 마지막 단계 정답: 퀘스트 전체 규칙 판정 */
  questRule?: Verdict;
}

export interface UnitReport {
  unit: CheckUnit;
  solution: RunRecord[];
  starter: RunRecord[];
  /** 계획한 실행 수 (시간 초과로 건너뛴 것 포함) */
  planned: number;
  /** 실행기 자체 오류 (Pyodide 문제, 콘텐츠 문제 아님) */
  internalError?: string;
  ms: number;
}

export async function checkUnit(
  runner: NodePyodideRunner,
  unit: CheckUnit,
  plan: PlannedRun[],
  timeoutMs: number,
): Promise<UnitReport> {
  const t0 = performance.now();
  const report: UnitReport = {
    unit,
    solution: [],
    starter: [],
    planned: plan.length,
    ms: 0,
  };
  const series = async (
    code: string,
    out: RunRecord[],
    questRule?: StoredRule,
  ) => {
    for (const p of plan) {
      const r = await runner.run(code, {
        seed: p.seed,
        stdin: p.stdin,
        timeoutMs,
      });
      out.push({
        label: p.label,
        seed: p.seed,
        ...judge(unit.rule, r, code, timeoutMs),
        stdout: r.stdout,
        isTimeout: r.isTimeout,
        isOutputLimit: r.outcome === 'output-limit',
        ms: r.ms,
        ...(questRule && { questRule: judge(questRule, r, code, timeoutMs) }),
      });
      // 무한 루프는 시드와 상관없는 경우가 대부분이라 같은 코드로 또 기다리지 않는다
      if (r.isTimeout || r.outcome === 'output-limit') break;
    }
  };
  try {
    // 학생이 아무것도 고치지 않고 실행 버튼을 누른 경우 (빈 시작 코드도 그대로 실행)
    await series(unit.initialCode, report.starter);
    if (unit.solution)
      await series(unit.solution, report.solution, unit.questRule);
  } catch (error) {
    report.internalError =
      error instanceof Error ? error.message : String(error);
  }
  report.ms = Math.round(performance.now() - t0);
  return report;
}

// ------------------------------------------------------------
// 검사 ①~⑤: 문제가 있으면 작성자용 메시지, 없으면 null
// ------------------------------------------------------------

function header(u: CheckUnit, where = u.where): string {
  return `[${u.key}] ${u.title} — ${where ?? '(파일 위치 모름)'} (퀘스트 id ${u.questId})`;
}

function reproduce(u: CheckUnit): string {
  return `재현: TEST_CONTENT_ONLY=${u.questKey} npm run test:content   (시드 N = 실행 전에 random.seed(N))`;
}

/** `시드 0, 시드 1, 시드 2, 시드 5` → `시드 0~2, 5` (시나리오 접두어별로 묶음) */
export function labels(runs: Pick<RunRecord, 'label'>[]): string {
  const parts: string[] = [];
  let group: { prefix: string; ranges: [number, number][] } | null = null;
  const flush = () => {
    if (!group) return;
    const text = group.ranges
      .map(([a, b]) =>
        a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}~${b}`,
      )
      .join(', ');
    parts.push(`${group.prefix}시드 ${text}`);
    group = null;
  };
  for (const { label } of runs) {
    // `무시드(시드 N)`은 괄호로 끝나서 묶지 않고 그대로 둔다
    const m = /^(.*?)시드 (\d+)$/.exec(label);
    if (!m) {
      flush();
      parts.push(label);
      continue;
    }
    const [, prefix, seedText] = m;
    const seed = Number(seedText);
    if (group && group.prefix !== prefix) flush();
    group ??= { prefix, ranges: [] };
    const last = group.ranges[group.ranges.length - 1];
    if (last && last[1] === seed - 1) last[1] = seed;
    else group.ranges.push([seed, seed]);
  }
  flush();
  return parts.length > 12
    ? `${parts.slice(0, 12).join(', ')} 외 ${parts.length - 12}개`
    : parts.join(', ');
}

/** 실패한 실행을 최대 2개까지 자세히 (설명이 같은 실행은 하나만) */
function failureDetails(
  runs: RunRecord[],
  pick: (r: RunRecord) => Verdict,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let shown = 0;
  for (const r of runs) {
    const v = pick(r);
    if (v.passed) continue;
    const key = v.detail.join('\n');
    if (seen.has(key)) continue;
    seen.add(key);
    if (shown === 2) {
      out.push('(다른 모양의 실패는 생략)');
      break;
    }
    out.push(`--- ${r.label} ---`, ...v.detail);
    shown++;
  }
  return out;
}

/** ① 정답 코드와 읽을 수 있는 규칙이 있다 */
export function answerProblem(u: CheckUnit): string | null {
  const problems: string[] = [];
  if (!u.solution?.trim()) {
    problems.push('정답 코드(solution_code)가 없어요. 황금키 정답을 쓰세요');
  }
  if (!u.rule.expected_output) {
    problems.push('검증 기준값이 비어 있어요');
  } else if (!parseStoredRule(u.rule.validation_type, u.rule.expected_output)) {
    problems.push(`검증 규칙을 읽을 수 없어요: ${ruleSummary(u.rule)}`);
  }
  return problems.length ? [header(u), ...problems].join('\n') : null;
}

/** ② 정답이 모든 시드(0~9)와 무시드 실행에서 통과한다 */
export function solutionProblem(r: UnitReport): string | null {
  const u = r.unit;
  if (r.internalError) return internalProblem(r);
  if (!u.solution) return null; // ①에서 알림
  const failed = r.solution.filter((x) => !x.passed);
  if (failed.length === 0) return null;
  const skipped = r.planned - r.solution.length; // 무한 루프로 멈춘 뒤 건너뛴 실행
  const someSeeds = failed.length < r.solution.length;
  return [
    header(u),
    `정답 코드가 자기 규칙을 통과하지 못했어요: ${r.solution.length}회 중 ${failed.length}회 실패 (${labels(failed)})` +
      (skipped ? `, 멈춘 뒤 나머지 ${skipped}회는 건너뜀` : ''),
    `규칙: ${ruleSummary(u.rule)}`,
    ...failureDetails(r.solution, (x) => x),
    ...(someSeeds
      ? [
          '안내: 일부 시드에서만 실패하면 출력이 무작위인 퀘스트예요. random.seed 고정 대신 contains_any·all 같은 넓은 규칙을 쓰세요 (content/README.md §3)',
        ]
      : []),
    reproduce(u),
  ].join('\n');
}

/** ③ 시작 코드(프로젝트: 이전 단계 정답 + 시작 코드)는 불합격이다 */
export function starterPassesProblem(r: UnitReport): string | null {
  const u = r.unit;
  if (r.internalError) return internalProblem(r);
  const passed = r.starter.filter((x) => x.passed);
  if (passed.length === 0) return null;
  return [
    header(u),
    `시작 코드를 그대로 실행해도 통과해요: ${r.starter.length}회 중 ${passed.length}회 (${labels(passed)})`,
    '학생이 아무것도 안 해도 통과합니다. 규칙을 더 좁히거나(예: all 로 code_check + 출력 묶기) 시작 코드에서 답을 빼세요',
    `규칙: ${ruleSummary(u.rule)}`,
    ...block(
      u.key.includes('#')
        ? '시작 코드 (이전 단계 정답 + 이 단계 starter_code)'
        : '시작 코드',
      u.initialCode,
    ),
    ...block(`실제 출력 (${passed[0].label})`, passed[0].stdout),
    reproduce(u),
  ].join('\n');
}

/**
 * ④ 시작 코드가 무한 루프 없이 끝난다 (B31). 시간 초과뿐 아니라 출력 상한에 걸려 멈춘 것도 무한 루프로 본다
 * (`print`가 든 무한 루프는 5초 전에 출력 상한으로 멈춤: 예전 4-7 시작 코드)
 */
export function starterTimeoutProblem(r: UnitReport): string | null {
  const u = r.unit;
  if (r.internalError) return internalProblem(r);
  const stuck = r.starter.find((x) => x.isTimeout || x.isOutputLimit);
  if (!stuck) return null;
  const why = stuck.isTimeout
    ? '시간 안에 끝나지 않아요. 학생이 그대로 실행하면 한참 기다린 뒤 실행기를 다시 준비해요'
    : '출력이 끝없이 나와 출력 상한에서 멈춰요. 학생 화면에는 "출력이 너무 많아요"만 보여요';
  return [
    header(u),
    `시작 코드가 무한 루프예요 (${stuck.label}): ${why} (B31)`,
    '반복 조건을 바꾸는 줄을 빈칸(예: count = count - ___)으로 넣으면 실행하자마자 오류로 멈춰요',
    ...block('시작 코드', u.initialCode),
    ...block('멈추기 전까지의 출력 (끝 5줄)', tail(stuck.stdout, 5)),
    reproduce(u),
  ].join('\n');
}

/** ⑤ 프로젝트 마지막 단계 정답이 퀘스트 전체 규칙도 통과한다 */
export function questRuleProblem(r: UnitReport): string | null {
  const u = r.unit;
  if (!u.questRule || !u.solution) return null;
  if (r.internalError) return internalProblem(r);
  const failed = r.solution.filter((x) => x.questRule && !x.questRule.passed);
  if (failed.length === 0) return null;
  return [
    header(u, u.questRuleWhere),
    `마지막 단계 정답이 퀘스트 전체 규칙을 통과하지 못했어요: ${r.solution.length}회 중 ${failed.length}회 실패 (${labels(failed)})`,
    `퀘스트 전체 규칙: ${ruleSummary(u.questRule)}`,
    ...failureDetails(r.solution, (x) => x.questRule!),
    reproduce(u),
  ].join('\n');
}

function internalProblem(r: UnitReport): string {
  return [
    header(r.unit),
    `실행기 오류(콘텐츠 문제가 아닐 수 있어요): ${r.internalError}`,
  ].join('\n');
}

// ------------------------------------------------------------
// 실행기 묶음 (worker_thread 하나 = Pyodide 하나, 단위 하나를 통째로 맡김)
// ------------------------------------------------------------

export class RunnerPool {
  private readonly idle: NodePyodideRunner[];
  private readonly waiting: ((runner: NodePyodideRunner) => void)[] = [];

  private constructor(readonly runners: NodePyodideRunner[]) {
    this.idle = [...runners];
  }

  static async create(
    size: number,
    create: (options: NodeRunnerOptions) => Promise<NodePyodideRunner>,
    options: NodeRunnerOptions = {},
  ): Promise<RunnerPool> {
    const settled = await Promise.allSettled(
      Array.from({ length: size }, () => create(options)),
    );
    const ready = settled.flatMap((s) =>
      s.status === 'fulfilled' ? [s.value] : [],
    );
    const failed = settled.find((s) => s.status === 'rejected');
    if (failed) {
      await Promise.all(ready.map((r) => r.close()));
      throw (failed as PromiseRejectedResult).reason;
    }
    return new RunnerPool(ready);
  }

  async use<T>(task: (runner: NodePyodideRunner) => Promise<T>): Promise<T> {
    const runner =
      this.idle.pop() ??
      (await new Promise<NodePyodideRunner>((resolve) =>
        this.waiting.push(resolve),
      ));
    try {
      return await task(runner);
    } finally {
      const next = this.waiting.shift();
      if (next) next(runner);
      else this.idle.push(runner);
    }
  }

  /** 시간 초과 뒤 interrupt 로도 안 멈춰 worker 를 다시 띄운 횟수 */
  get restarts(): number {
    return this.runners.reduce((n, r) => n + r.restarts, 0);
  }

  async close(): Promise<void> {
    await Promise.all(this.runners.map((r) => r.close()));
  }
}
