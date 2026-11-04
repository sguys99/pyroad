// 모든 퀘스트·단계의 정답 코드를 Node Pyodide(브라우저 Worker 와 같은 실행 코어)로 실행해 자기 검증을 확인한다 (P1-13, §2.4)
//
//   npm run test:content                                 # PR 필수 체크: 시드 0~9 + 무시드 1회
//   TEST_CONTENT_UNSEEDED_RUNS=20 npm run test:content   # main 전용: 무시드 20회로 드문 흔들림 찾기
//   TEST_CONTENT_ONLY=7-1,4-7 npm run test:content       # 일부 퀘스트만 (퀘스트 키·단위 키 7-1#3·퀘스트 id)
//   TEST_CONTENT_DIR=<dir> npm run test:content          # 다른 콘텐츠 디렉토리 (기본 content/)
//   TEST_CONTENT_SEEDS=10 · TEST_CONTENT_WORKERS=3       # 고정 시드 개수 · 동시에 띄울 Pyodide 수
//
// 검사: ① 정답 코드·규칙이 있다 ② 정답이 모든 실행에서 통과 ③ 시작 코드는 불합격 ④ 시작 코드가 시간 안에 끝남(B31)
//       ⑤ 프로젝트 마지막 단계 정답이 퀘스트 전체 규칙도 통과
// Pyodide 를 여러 개 띄워(worker_thread 하나씩) 단위를 나눠 돌리고, 각 테스트는 자기 단위의 결과를 기다린다.
// 느려서 `npm test`에서는 뺀다 (vitest.config.ts exclude, vitest.content.config.ts).

import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EXECUTION_TIMEOUT_MS } from '@/lib/pyodide/constants';

import { NodePyodideRunner } from '../../pyodide/nodeRunner';
import { CONTENT_DIR, REPO_ROOT } from '../lib/paths';
import {
  answerProblem,
  checkUnit,
  filterUnits,
  loadUnits,
  planRuns,
  questRuleProblem,
  RunnerPool,
  solutionProblem,
  starterPassesProblem,
  starterTimeoutProblem,
  type UnitReport,
} from '../lib/solutionCheck';

function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name}=${raw}: ${min} 이상의 정수여야 해요`);
  }
  return value;
}

const options = {
  contentDir: resolve(REPO_ROOT, process.env.TEST_CONTENT_DIR || CONTENT_DIR),
  only: (process.env.TEST_CONTENT_ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  seeds: intEnv('TEST_CONTENT_SEEDS', 10, 0),
  unseededRuns: intEnv('TEST_CONTENT_UNSEEDED_RUNS', 1, 0),
  // GitHub ubuntu-latest(4 vCPU)에서 3개. Pyodide 하나가 약 200MB
  workers: intEnv(
    'TEST_CONTENT_WORKERS',
    Math.min(4, Math.max(1, availableParallelism() - 1)),
    1,
  ),
  timeoutMs: EXECUTION_TIMEOUT_MS,
};

const loaded = loadUnits(options.contentDir);
const units = filterUnits(loaded.units, options.only);
const reports = new Map<string, Promise<UnitReport>>();
let pool: RunnerPool | undefined;
const timing = { start: 0, ready: 0 };

/** vitest 는 통과한 파일의 console 출력을 숨기므로 요약은 stderr 로 직접 (CI 로그에서 소요 시간 확인) */
function log(line: string) {
  process.stderr.write(`${line}\n`);
}

/** 문제 메시지가 있으면 그대로 실패 메시지로 (vitest 기본 diff 대신 작성자가 읽을 설명) */
function assertNoProblem(problem: string | null) {
  if (problem) {
    const error = new Error(`\n${problem}`);
    error.stack = error.message; // 테스트 파일 스택 대신 메시지만
    throw error;
  }
}

function reportOf(key: string): Promise<UnitReport> {
  const report = reports.get(key);
  if (!report)
    throw new Error(`${key}: 실행이 예약되지 않았어요 (beforeAll 실패?)`);
  return report;
}

beforeAll(async () => {
  for (const w of loaded.warnings) log(`콘텐츠 경고: ${w}`);
  if (units.length === 0) return;
  timing.start = performance.now();
  const size = Math.min(options.workers, units.length);
  pool = await RunnerPool.create(size, (o) => NodePyodideRunner.create(o), {
    timeoutMs: options.timeoutMs,
  });
  timing.ready = performance.now();
  // 테스트 순서대로 예약해 앞 테스트의 결과가 먼저 나오게 함. checkUnit 은 거부하지 않음(오류는 report 에 담김)
  for (const unit of units) {
    const plan = planRuns(unit.scenarios, options);
    reports.set(
      unit.key,
      pool.use((runner) => checkUnit(runner, unit, plan, options.timeoutMs)),
    );
  }
}, 180_000);

afterAll(async () => {
  if (!pool) return;
  const all = await Promise.all(reports.values());
  const end = performance.now();
  const runs = all.reduce(
    (n, r) => n + r.solution.length + r.starter.length,
    0,
  );
  const slowest = [...all].sort((a, b) => b.ms - a.ms)[0];
  log(
    [
      `test:content: 퀘스트 ${new Set(units.map((u) => u.questId)).size}개 · 검증 단위 ${units.length}개 · 실행 ${runs}회`,
      `(시드 0~${options.seeds - 1} + 무시드 ${options.unseededRuns}회, 정답·시작 코드 각각)`,
      `Pyodide ${pool.runners.length}개 로드 ${((timing.ready - timing.start) / 1000).toFixed(1)}초`,
      `+ 검사 ${((end - timing.ready) / 1000).toFixed(1)}초`,
      `· 가장 느린 단위 ${slowest.unit.key} ${(slowest.ms / 1000).toFixed(1)}초`,
      `· 실행기 재시작 ${pool.restarts}회 · 콘텐츠 해시 ${loaded.hash}`,
    ].join(' '),
  );
  await pool.close();
});

it('검증할 단위가 있음 (TEST_CONTENT_ONLY 가 아무것도 고르지 않았으면 실패)', () => {
  expect(
    units.length,
    `TEST_CONTENT_ONLY=${options.only.join(',')} 와 맞는 퀘스트가 없어요`,
  ).toBeGreaterThan(0);
});

for (const unit of units)
  describe(`${unit.key} ${unit.title}`, () => {
    it('① 정답 코드와 검증 규칙이 있음', () => {
      assertNoProblem(answerProblem(unit));
    });

    it('② 정답이 모든 시드와 무시드 실행에서 통과', async () => {
      assertNoProblem(solutionProblem(await reportOf(unit.key)));
    });

    it('③ 시작 코드를 그대로 실행하면 불합격', async () => {
      assertNoProblem(starterPassesProblem(await reportOf(unit.key)));
    });

    it('④ 시작 코드가 무한 루프 없이 끝남 (B31)', async () => {
      assertNoProblem(starterTimeoutProblem(await reportOf(unit.key)));
    });

    if (unit.questRule) {
      it('⑤ 마지막 단계 정답이 퀘스트 전체 규칙도 통과', async () => {
        assertNoProblem(questRuleProblem(await reportOf(unit.key)));
      });
    }
  });
