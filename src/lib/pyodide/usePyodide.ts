'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  EXECUTION_TIMEOUT_MS,
  PYODIDE_WORKER_URL,
  STOP_GRACE_MS,
} from './constants';
import { isRunSuccessful, truncateOutput } from './runOutcome';
import type {
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
}

export interface RunCodeOptions {
  /** 실행 중 stdout 조각 (Worker가 묶어서 보냄). input() 프롬프트 등을 바로 보여 줄 때 */
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  timeoutMs?: number;
}

export interface UsePyodideOptions {
  timeoutMs?: number;
  /** stop을 보낸 뒤 Worker를 다시 띄우기 전까지 기다리는 시간 */
  stopGraceMs?: number;
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
}

interface WorkerHandle {
  worker: Worker;
  generation: number;
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

  const [status, setStatus] = useState<PyodideStatus>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [restarting, setRestarting] = useState<PyodideRestartReason>(null);
  const [generation, setGeneration] = useState(0);
  const [runtimeInfo, setRuntimeInfo] = useState<WorkerRuntimeInfo | null>(
    null,
  );

  const workerRef = useRef<WorkerHandle | null>(null);
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

  const spawn = useCallback(
    (reason: PyodideRestartReason) => {
      disposeWorker();
      const gen = ++generationRef.current;
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
              setRuntimeInfo(msg.info ?? null);
            } else if (msg.status === 'loading') {
              updateStatus('loading');
            } else if (msg.status === 'error') {
              updateStatus('error');
              setRestarting(null);
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
            // P11-01에서 입력 박스를 붙인다. 지금 Worker는 이 메시지를 보내지 않는다
            break;
        }
      };

      worker.onerror = (event) => {
        if (!isCurrent()) return;
        const { message, extra } = describeWorkerErrorEvent(event);
        reportPyodideWorkerError('worker', message, extra);
        updateStatus('error');
        setRestarting(null);
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
      setGeneration(gen);
      setRestarting(reason);
      updateStatus('loading');
      const msg: WorkerRequest = { type: 'init' };
      worker.postMessage(msg);
    },
    [disposeWorker, finishRun, handleDone, updateStatus],
  );
  spawnRef.current = spawn;

  // 마운트 시 Worker 생성 + Pyodide 초기화, 언마운트 시 종료
  useEffect(() => {
    spawn(null);
    return () => {
      const run = runRef.current;
      if (run) {
        finishRun(run, { success: false, outcome: 'stopped', isStopped: true });
      }
      // workerRef가 비므로 이 뒤에 오는 이벤트는 모두 이전 세대로 무시된다
      disposeWorker();
    };
  }, [spawn, disposeWorker, finishRun]);

  /** 실행 중인 코드에 stop을 보낸다. 답이 없으면(CPU 루프) 잠시 뒤 Worker를 다시 띄운다 */
  const requestStop = useCallback(
    (run: ActiveRun, reason: 'timeout' | 'stop') => {
      if (runRef.current !== run) return;
      run.stopReason ??= reason;
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
        };
        runRef.current = run;
        setIsRunning(true);

        // 시간 초과: 먼저 stop(time.sleep 대기 중이면 Worker 유지), 답이 없으면 Worker 재시작
        run.timer = setTimeout(
          () => requestStop(run, 'timeout'),
          options.timeoutMs ?? optionsRef.current.timeoutMs,
        );

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
    runCode,
    isRunning,
    retry,
    stop,
    /** Worker를 다시 띄우는 중인 이유 (재준비 연출용). 준비되면 null */
    restarting,
    /** 지금 Worker의 세대 번호 (Worker를 새로 만들 때마다 1씩 늘어남) */
    generation,
    /** Pyodide 버전·불러온 곳·JSPI 여부 */
    runtimeInfo,
  };
}
