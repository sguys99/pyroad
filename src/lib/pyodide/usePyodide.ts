'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  EXECUTION_TIMEOUT_MS,
  PYODIDE_WORKER_URL,
  STOP_GRACE_MS,
} from './constants';
import { isRunSuccessful, truncateOutput } from './runOutcome';
import {
  needsInputServiceWorker,
  registerInputServiceWorker,
} from './inputChannel';
import type {
  InputRequest,
  RunInput,
  PyodideLoadStage,
  RunDoneMessage,
  RunOutcome,
  WorkerRequest,
  WorkerResponse,
  WorkerRuntimeInfo,
} from './types';
import {
  describeWorkerErrorEvent,
  reportPyodideWorkerError,
} from './workerErrorReport';

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Worker를 다시 띄우는 중이면 그 이유. CPU 무한 루프는 Worker를 살린 채 멈출 수 없어서
 * 시간 초과·멈추기 뒤 2~5초 다시 준비한다 (§2.9, P6-05 재준비 연출). 준비가 끝나면 null
 */
export type PyodideRestartReason = 'timeout' | 'stop' | null;

export interface RunResult {
  stdout: string;
  stderr: string;
  success: boolean;
  isTimeout?: boolean;
  /** stop()으로 멈춤 */
  isStopped?: boolean;
  /** 실행이 어떻게 끝났는지 (Worker의 done 메시지) */
  outcome?: RunOutcome;
  /** 학생 코드에서 예외가 났는지 (경고는 예외가 아님) */
  hadException?: boolean;
  errorType?: string | null;
  /** 출력이 Worker 상한(MAX_CAPTURE_LENGTH)을 넘어 잘렸는지 */
  truncated?: boolean;
  /** input()에 학생이 답한 말 (P11-01). stdout의 어느 자리(at = 그때까지 stdout 길이)에 끼는지와 함께 */
  inputs?: RunInput[];
}

export interface RunCodeOptions {
  /** 실행 중 stdout 조각 (Worker가 묶어서 보냄). input() 프롬프트 등을 바로 보여 줄 때 */
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  /** input()이 답을 기다림 (P11-01). 답할 때까지 시간 제한이 멈춘다 */
  onInputRequest?: (request: InputRequest) => void;
  /** turtle 그리기 명령 묶음 (P11-02, JSON 배열 문자열) */
  onTurtle?: (chunk: string) => void;
  timeoutMs?: number;
}

export interface UsePyodideOptions {
  timeoutMs?: number;
  /** stop을 보낸 뒤 Worker를 다시 띄우기 전까지 기다리는 시간 */
  stopGraceMs?: number;
  /** true면 마운트 때 띄우지 않고 start()를 처음 부를 때 띄운다 (퀴즈 화면은 "직접 실행해 보기"를 누를 때만, P7-07) */
  lazy?: boolean;
}

interface ActiveRun {
  id: string;
  generation: number;
  stdout: string;
  stderr: string;
  options: RunCodeOptions;
  resolve: (result: RunResult) => void;
  timer: ReturnType<typeof setTimeout> | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
  stopReason: 'timeout' | 'stop' | null;
  /** 시간 제한 중 아직 쓰지 않은 Python 실행 시간(ms). 입력 대기 동안은 줄지 않는다 (P11-03) */
  budgetMs: number;
  /** 지금 시간을 재고 있는 구간의 시작 (performance.now). 입력 대기 중이면 null */
  clockFrom: number | null;
  inputs: RunInput[];
  /** 답을 기다리는 input() 요청 */
  waiting: Extract<WorkerResponse, { type: 'input-request' }> | null;
}

interface WorkerHandle {
  worker: Worker;
  generation: number;
}

/**
 * 시간 제한 시계 (P11-03): Python이 도는 동안만 잰다. 입력 대기는 pauseClock으로 빼고,
 * turtle 그림은 done 뒤에 화면이 다시 그리는 것이라(그리는 시간은 실행과 따로) 처음부터 들어가지 않는다
 */
function startClock(run: ActiveRun, onTimeout: () => void) {
  run.clockFrom = performance.now();
  run.timer = setTimeout(onTimeout, Math.max(0, run.budgetMs));
}

function pauseClock(run: ActiveRun) {
  if (run.timer) clearTimeout(run.timer);
  run.timer = null;
  if (run.clockFrom !== null) run.budgetMs -= performance.now() - run.clockFrom;
  run.clockFrom = null;
}

const NOT_READY: RunResult = {
  stdout: '',
  stderr: '코드 실행기가 아직 준비되지 않았어요.',
  success: false,
};

const BUSY: RunResult = {
  stdout: '',
  stderr: '코드가 아직 실행 중이에요. 잠시 뒤에 다시 해 보세요.',
  success: false,
};

export function usePyodide(hookOptions: UsePyodideOptions = {}) {
  const timeoutMs = hookOptions.timeoutMs ?? EXECUTION_TIMEOUT_MS;
  const stopGraceMs = hookOptions.stopGraceMs ?? STOP_GRACE_MS;
  const lazy = hookOptions.lazy ?? false;

  const [status, setStatus] = useState<PyodideStatus>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [restarting, setRestarting] = useState<PyodideRestartReason>(null);
  const [generation, setGeneration] = useState(0);
  const [loadStage, setLoadStage] = useState<PyodideLoadStage | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<WorkerRuntimeInfo | null>(
    null,
  );

  const workerRef = useRef<WorkerHandle | null>(null);
  // input() 폴백 SW (JSPI 없는 브라우저만, P11-01). SW 채널 답·멈추기는 Worker가 아니라 여기로 보낸다
  const inputSwRef = useRef<ServiceWorkerRegistration | null>(null);
  // SW 등록을 기다리는 중이라 Worker가 아직 없음 (start()가 두 번 띄우지 않게)
  const pendingSpawnRef = useRef(false);
  // 지금 Worker의 세대 번호. 종료된 Worker의 늦은 메시지·에러는 이 값과 달라서 무시된다 (B14)
  const generationRef = useRef(0);
  const statusRef = useRef<PyodideStatus>('idle');
  const runRef = useRef<ActiveRun | null>(null);
  const optionsRef = useRef({ timeoutMs, stopGraceMs });
  optionsRef.current = { timeoutMs, stopGraceMs };

  const updateStatus = useCallback((next: PyodideStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /** 진행 중인 실행을 끝낸다 (타이머 정리 + Promise resolve) */
  const finishRun = useCallback(
    (
      run: ActiveRun,
      result: Omit<RunResult, 'stdout' | 'stderr'> & Partial<RunResult>,
    ) => {
      if (runRef.current !== run) return;
      runRef.current = null;
      if (run.timer) clearTimeout(run.timer);
      if (run.graceTimer) clearTimeout(run.graceTimer);
      setIsRunning(false);
      run.resolve({
        stdout: truncateOutput(result.stdout ?? run.stdout),
        stderr: truncateOutput(result.stderr ?? run.stderr),
        ...(run.inputs.length > 0 && { inputs: run.inputs }),
        ...result,
      });
    },
    [],
  );

  /** 이전 Worker를 끄고 새 Worker를 만든다. 진행 중인 실행이 있으면 먼저 끝내야 한다 */
  const spawnRef = useRef<(reason: PyodideRestartReason) => void>(() => {});

  const disposeWorker = useCallback(() => {
    const prev = workerRef.current;
    workerRef.current = null;
    if (!prev) return;
    prev.worker.onmessage = null;
    prev.worker.onerror = null;
    prev.worker.terminate();
  }, []);

  /** stop·시간 초과에 Worker가 답하지 않을 때(CPU 무한 루프): terminate하고 다시 띄운다 */
  const restartStuckRun = useCallback(
    (run: ActiveRun) => {
      if (runRef.current !== run) return;
      const reason = run.stopReason ?? 'stop';
      finishRun(run, {
        success: false,
        outcome: reason === 'timeout' ? 'timeout' : 'stopped',
        hadException: false,
        errorType: null,
        ...(reason === 'timeout' ? { isTimeout: true } : { isStopped: true }),
      });
      spawnRef.current(reason);
    },
    [finishRun],
  );

  const handleDone = useCallback(
    (run: ActiveRun, msg: RunDoneMessage) => {
      // stop을 보내서 멈춘 경우: 시간 초과였는지 사용자가 멈췄는지는 메인 스레드가 안다
      const stoppedBy = msg.outcome === 'stopped' ? run.stopReason : null;
      const outcome: RunOutcome =
        stoppedBy === 'timeout' ? 'timeout' : msg.outcome;
      finishRun(run, {
        // 경고만 있고 예외가 없으면 성공 (B25). 판정은 Worker가 알려 준 outcome으로
        success: isRunSuccessful({
          success: false,
          stderr: run.stderr,
          outcome,
        }),
        outcome,
        hadException: msg.hadException,
        errorType: msg.errorType,
        truncated: msg.truncated,
        ...(outcome === 'timeout' && { isTimeout: true }),
        ...(outcome === 'stopped' && { isStopped: true }),
      });
    },
    [finishRun],
  );

  const handleInputRequest = useCallback(
    (
      run: ActiveRun,
      msg: Extract<WorkerResponse, { type: 'input-request' }>,
    ) => {
      // 답을 기다리는 시간은 시간 제한에서 뺀다: 시계를 멈추고, 답하면 남은 시간부터 다시 잰다 (P11-03)
      pauseClock(run);
      run.waiting = msg;
      run.options.onInputRequest?.({
        answer: (value) => {
          if (runRef.current !== run || run.waiting !== msg) return;
          run.waiting = null;
          run.inputs.push({ at: run.stdout.length, value });
          if (msg.channel === 'sw') {
            inputSwRef.current?.active?.postMessage({
              id: msg.requestId,
              kind: 'value',
              value,
            });
          } else {
            const answer: WorkerRequest = {
              type: 'answer',
              id: run.id,
              requestId: msg.requestId,
              value,
            };
            workerRef.current?.worker.postMessage(answer);
          }
          startClock(run, () => requestStopRef.current(run, 'timeout'));
        },
        stop: () => requestStopRef.current(run, 'stop'),
      });
    },
    [],
  );
  const requestStopRef = useRef<
    (run: ActiveRun, reason: 'timeout' | 'stop') => void
  >(() => {});

  const createWorker = useCallback(
    (gen: number) => {
      const worker = new Worker(PYODIDE_WORKER_URL, { type: 'module' });
      const isCurrent = () => workerRef.current?.generation === gen;

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (!isCurrent()) return;
        const msg = e.data;
        const run = runRef.current;
        const isRunMsg =
          run !== null &&
          run.generation === gen &&
          'id' in msg &&
          msg.id === run.id;
        switch (msg.type) {
          case 'init-status':
            if (msg.status === 'ready') {
              updateStatus('ready');
              setRestarting(null);
              setLoadStage(null);
              setRuntimeInfo(msg.info ?? null);
            } else if (msg.status === 'loading') {
              updateStatus('loading');
              if (msg.stage) setLoadStage(msg.stage);
            } else if (msg.status === 'error') {
              updateStatus('error');
              setRestarting(null);
              setLoadStage(null);
              // 실행기 로딩 실패만 보고 (학생 코드와 무관)
              reportPyodideWorkerError('init', msg.error);
            }
            break;
          case 'stdout':
            if (isRunMsg) {
              run.stdout += msg.text;
              run.options.onStdout?.(msg.text);
            }
            break;
          case 'stderr':
            if (isRunMsg) {
              run.stderr += msg.text;
              run.options.onStderr?.(msg.text);
            }
            break;
          case 'turtle':
            if (isRunMsg) run.options.onTurtle?.(msg.chunk);
            break;
          case 'done':
            if (isRunMsg) handleDone(run, msg);
            break;
          case 'run-error':
            // Pyodide 내부 오류 (학생 코드의 Python 오류는 stderr + done으로 온다)
            reportPyodideWorkerError('internal', msg.error);
            if (isRunMsg) {
              finishRun(run, { stdout: '', stderr: msg.error, success: false });
            }
            break;
          case 'input-request':
            if (isRunMsg) handleInputRequest(run, msg);
            break;
        }
      };

      worker.onerror = (event) => {
        if (!isCurrent()) return;
        const { message, extra } = describeWorkerErrorEvent(event);
        reportPyodideWorkerError('worker', message, extra);
        updateStatus('error');
        setRestarting(null);
        setLoadStage(null);
        const run = runRef.current;
        if (run && run.generation === gen) {
          finishRun(run, {
            stdout: '',
            stderr: '코드 실행기에 오류가 발생했어요.',
            success: false,
          });
        }
      };

      workerRef.current = { worker, generation: gen };
      const msg: WorkerRequest = { type: 'init' };
      worker.postMessage(msg);
    },
    [finishRun, handleDone, handleInputRequest, updateStatus],
  );

  const spawn = useCallback(
    (reason: PyodideRestartReason) => {
      disposeWorker();
      const gen = ++generationRef.current;
      setGeneration(gen);
      setRestarting(reason);
      setLoadStage('download');
      updateStatus('loading');
      if (needsInputServiceWorker()) {
        // JSPI 없는 브라우저: input() 폴백 SW가 활성화된 뒤에 Worker를 띄운다 (P11-01)
        pendingSpawnRef.current = true;
        void registerInputServiceWorker().then((reg) => {
          inputSwRef.current = reg;
          // 그새 언마운트(pending 해제)됐거나 다시 띄웠으면(세대가 바뀜) 버린다
          if (generationRef.current !== gen || !pendingSpawnRef.current) return;
          pendingSpawnRef.current = false;
          createWorker(gen);
        });
      } else {
        createWorker(gen);
      }
    },
    [disposeWorker, createWorker, updateStatus],
  );

  spawnRef.current = spawn;

  /** Worker가 없으면 띄운다 (lazy). 이미 있으면 아무것도 하지 않음 */
  const start = useCallback(() => {
    if (!workerRef.current && !pendingSpawnRef.current) spawn(null);
  }, [spawn]);

  // 마운트 시 Worker 생성 + Pyodide 초기화(lazy면 start()가), 언마운트 시 종료
  useEffect(() => {
    if (!lazy) spawn(null);
    return () => {
      const run = runRef.current;
      if (run) {
        finishRun(run, { success: false, outcome: 'stopped', isStopped: true });
      }
      // workerRef가 비므로 이 뒤에 오는 이벤트는 모두 이전 세대로 무시된다.
      // SW 등록을 기다리던 Worker 만들기도 세대가 달라져 버려진다
      disposeWorker();
      pendingSpawnRef.current = false;
    };
  }, [lazy, spawn, disposeWorker, finishRun]);

  /** 실행 중인 코드에 stop을 보낸다. 답이 없으면(CPU 루프) 잠시 뒤 Worker를 다시 띄운다 */
  const requestStop = useCallback(
    (run: ActiveRun, reason: 'timeout' | 'stop') => {
      if (runRef.current !== run) return;
      run.stopReason ??= reason;
      // SW 채널로 답을 기다리는 Worker는 동기 XHR에 막혀 stop 메시지를 못 읽는다 → SW가 풀어 준다
      if (run.waiting?.channel === 'sw') {
        inputSwRef.current?.active?.postMessage({
          id: run.waiting.requestId,
          kind: 'stop',
        });
      }
      // time.sleep도 SW 동기 XHR로 자고 있을 수 있다 (JSPI 없음, P11-03). SW가 없으면(JSPI) 아무 일도 없음
      inputSwRef.current?.active?.postMessage({ id: run.id, kind: 'stop-run' });
      run.waiting = null;
      const handle = workerRef.current;
      if (handle && handle.generation === run.generation) {
        const msg: WorkerRequest = { type: 'stop', id: run.id };
        handle.worker.postMessage(msg);
      }
      if (!run.graceTimer) {
        run.graceTimer = setTimeout(
          () => restartStuckRun(run),
          optionsRef.current.stopGraceMs,
        );
      }
    },
    [restartStuckRun],
  );
  requestStopRef.current = requestStop;

  const runCode = useCallback(
    (code: string, options: RunCodeOptions = {}): Promise<RunResult> => {
      return new Promise((resolve) => {
        const handle = workerRef.current;
        if (!handle || statusRef.current !== 'ready') {
          resolve(NOT_READY);
          return;
        }
        if (runRef.current) {
          resolve(BUSY);
          return;
        }

        const run: ActiveRun = {
          id: crypto.randomUUID(),
          generation: handle.generation,
          stdout: '',
          stderr: '',
          options,
          resolve,
          timer: null,
          graceTimer: null,
          stopReason: null,
          budgetMs: options.timeoutMs ?? optionsRef.current.timeoutMs,
          clockFrom: null,
          inputs: [],
          waiting: null,
        };
        runRef.current = run;
        setIsRunning(true);

        // 시간 초과: 먼저 stop(time.sleep 대기 중이면 Worker 유지), 답이 없으면 Worker 재시작
        startClock(run, () => requestStop(run, 'timeout'));

        const msg: WorkerRequest = { type: 'run', id: run.id, code };
        handle.worker.postMessage(msg);
      });
    },
    [requestStop],
  );

  /** 실행 멈추기 (멈추기 버튼). 실행 중이 아니면 아무것도 하지 않는다 */
  const stop = useCallback(() => {
    const run = runRef.current;
    if (run) requestStop(run, 'stop');
  }, [requestStop]);

  const retry = useCallback(() => {
    const run = runRef.current;
    if (run) {
      finishRun(run, { success: false, outcome: 'stopped', isStopped: true });
    }
    spawn(null);
  }, [finishRun, spawn]);

  return {
    status,
    start,
    runCode,
    isRunning,
    retry,
    stop,
    /** Worker를 다시 띄우는 중인 이유 (재준비 연출용). 준비되면 null */
    restarting,
    /** 준비 단계 (P6-05 준비 연출). loading이 아니면 null */
    loadStage,
    /** 지금 Worker의 세대 번호 (Worker를 새로 만들 때마다 1씩 늘어남) */
    generation,
    /** Pyodide 버전·불러온 곳·JSPI 여부 */
    runtimeInfo,
  };
}
