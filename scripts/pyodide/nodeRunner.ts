// Node에서 학생 코드를 브라우저와 같은 실행 코어로 돌리는 클라이언트 (P1-13 정답 자동 검증, B15 테스트).
//
//   const runner = await NodePyodideRunner.create();
//   const r = await runner.run('print(1)', { seed: 0, stdin: ['3'] });
//   // r.stdout, r.stderr, r.success, r.outcome('ok' | 'error' | 'timeout' | ...), r.hadException
//   await runner.close();
//
// - Pyodide는 worker_thread(node-worker.mjs) 하나에 띄우고 실행마다 새 namespace를 쓴다.
// - 시간 초과: SharedArrayBuffer interrupt buffer로 KeyboardInterrupt를 보내고(인스턴스 유지),
//   graceMs 안에 끝나지 않으면 worker를 terminate하고 새로 띄운다(브라우저와 같은 마지막 수단).
// - `random` 등 모듈 상태는 namespace를 새로 만들어도 남으므로 결과를 고정하려면 seed를 넘긴다.

import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

import {
  EXECUTION_TIMEOUT_MS,
  STOP_GRACE_MS,
} from '../../src/lib/pyodide/constants';
import {
  isRunSuccessful,
  truncateOutput as truncate,
} from '../../src/lib/pyodide/runOutcome';
import type {
  RunOutcome,
  WorkerResponse,
  WorkerRuntimeInfo,
} from '../../src/lib/pyodide/types';

const WORKER_FILE = fileURLToPath(
  new URL('./node-worker.mjs', import.meta.url),
);
/** pyodide-core.mjs의 INTERRUPT_REASON_TIMEOUT */
const INTERRUPT_REASON_TIMEOUT = 1;
const SIGINT = 2;

export interface NodeRunOptions {
  /** random.seed(seed)를 실행 전에 부름 */
  seed?: number;
  /** input()에 차례로 들어갈 줄. 다 쓰면 EOFError */
  stdin?: string[];
  timeoutMs?: number;
  /** 실행 중에 오는 출력 조각 (스트리밍 확인용) */
  onOutput?: (kind: 'stdout' | 'stderr', text: string) => void;
}

export interface NodeRunResult {
  /** 브라우저 RunResult처럼 MAX_OUTPUT_LENGTH로 자른 값 (truncateOutput) */
  stdout: string;
  stderr: string;
  /** 자르지 않은 값 (Worker 출력 상한까지) */
  fullStdout: string;
  fullStderr: string;
  success: boolean;
  outcome: RunOutcome;
  hadException: boolean;
  errorType: string | null;
  isTimeout: boolean;
  /** 시간 초과 뒤 interrupt로도 끝나지 않아 worker를 다시 띄웠는지 */
  restarted: boolean;
  truncated: boolean;
  ms: number;
}

export interface NodeRunnerOptions {
  timeoutMs?: number;
  graceMs?: number;
  /** 로딩 뒤 Worker 전역에서 fetch 등을 지울지 (기본 true, 브라우저와 같게) */
  removeNetwork?: boolean;
  maxCaptureLength?: number;
}

export class NodePyodideRunner {
  private worker!: Worker;
  private readonly interrupt = new Int32Array(new SharedArrayBuffer(8));
  private seq = 0;
  private readonly options: Required<
    Omit<NodeRunnerOptions, 'maxCaptureLength'>
  > &
    Pick<NodeRunnerOptions, 'maxCaptureLength'>;
  info!: WorkerRuntimeInfo;
  /** worker를 다시 띄운 횟수 */
  restarts = 0;

  private constructor(options: NodeRunnerOptions) {
    this.options = {
      timeoutMs: EXECUTION_TIMEOUT_MS,
      graceMs: STOP_GRACE_MS * 4,
      removeNetwork: true,
      ...options,
    };
  }

  static async create(
    options: NodeRunnerOptions = {},
  ): Promise<NodePyodideRunner> {
    const runner = new NodePyodideRunner(options);
    await runner.spawn();
    return runner;
  }

  private spawn(): Promise<void> {
    const worker = new Worker(WORKER_FILE, {
      workerData: {
        interruptBuffer: this.interrupt.buffer,
        removeNetwork: this.options.removeNetwork,
        maxCaptureLength: this.options.maxCaptureLength,
      },
    });
    this.worker = worker;
    return new Promise((resolve, reject) => {
      const onMessage = (msg: WorkerResponse) => {
        if (msg.type !== 'init-status' || msg.status === 'loading') return;
        worker.off('message', onMessage);
        worker.off('error', reject);
        if (msg.status === 'ready' && msg.info) {
          this.info = msg.info;
          resolve();
        } else {
          reject(new Error(`Pyodide 준비 실패: ${msg.error}`));
        }
      };
      worker.on('message', onMessage);
      worker.once('error', reject);
    });
  }

  async run(
    code: string,
    options: NodeRunOptions = {},
  ): Promise<NodeRunResult> {
    const id = `r${++this.seq}`;
    const timeoutMs = options.timeoutMs ?? this.options.timeoutMs;
    const worker = this.worker;
    const t0 = performance.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    Atomics.store(this.interrupt, 0, 0);
    Atomics.store(this.interrupt, 1, 0);

    type Reply =
      | Extract<WorkerResponse, { type: 'done' }>
      | Extract<WorkerResponse, { type: 'run-error' }>;
    const reply = new Promise<Reply>((resolve) => {
      const onMessage = (msg: WorkerResponse) => {
        if (!('id' in msg) || msg.id !== id) return;
        if (msg.type === 'stdout' || msg.type === 'stderr') {
          if (msg.type === 'stdout') stdout += msg.text;
          else stderr += msg.text;
          options.onOutput?.(msg.type, msg.text);
        } else if (msg.type === 'done' || msg.type === 'run-error') {
          worker.off('message', onMessage);
          resolve(msg);
        }
      };
      worker.on('message', onMessage);
    });

    let interruptTimer: NodeJS.Timeout | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    const hang = new Promise<'hang'>((resolve) => {
      interruptTimer = setTimeout(() => {
        timedOut = true;
        Atomics.store(this.interrupt, 1, INTERRUPT_REASON_TIMEOUT);
        Atomics.store(this.interrupt, 0, SIGINT);
        killTimer = setTimeout(() => resolve('hang'), this.options.graceMs);
      }, timeoutMs);
    });

    worker.postMessage({
      type: 'run',
      id,
      code,
      seed: options.seed,
      stdin: options.stdin,
    });
    const msg = await Promise.race([reply, hang]);
    clearTimeout(interruptTimer);
    clearTimeout(killTimer);
    const ms = Math.round(performance.now() - t0);

    const base = {
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      fullStdout: stdout,
      fullStderr: stderr,
      ms,
    };
    if (msg === 'hang') {
      await worker.terminate();
      this.restarts++;
      await this.spawn();
      return {
        ...base,
        success: false,
        outcome: 'timeout',
        hadException: false,
        errorType: null,
        isTimeout: true,
        restarted: true,
        truncated: false,
      };
    }
    if (msg.type === 'run-error') {
      return {
        ...base,
        stderr: msg.error,
        fullStderr: msg.error,
        success: false,
        outcome: 'error',
        hadException: true,
        errorType: 'InternalError',
        isTimeout: false,
        restarted: false,
        truncated: false,
      };
    }
    const outcome: RunOutcome =
      timedOut && msg.outcome !== 'ok' ? 'timeout' : msg.outcome;
    return {
      ...base,
      success: isRunSuccessful({ success: false, stderr, outcome }),
      outcome,
      hadException: msg.hadException,
      errorType: msg.errorType,
      isTimeout: outcome === 'timeout',
      restarted: false,
      truncated: msg.truncated,
    };
  }

  async close(): Promise<void> {
    await this.worker.terminate();
  }
}
