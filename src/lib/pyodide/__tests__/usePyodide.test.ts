// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePyodide, type RunResult } from '../usePyodide';
import { PYODIDE_WORKER_URL } from '../constants';
import type { WorkerRequest, WorkerResponse } from '../types';
import { reportPyodideWorkerError } from '../workerErrorReport';

vi.mock('../workerErrorReport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../workerErrorReport')>()),
  reportPyodideWorkerError: vi.fn(),
}));

const report = vi.mocked(reportPyodideWorkerError);

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  posted: WorkerRequest[] = [];
  terminated = false;

  constructor(
    readonly url: string,
    readonly options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(msg: WorkerRequest) {
    this.posted.push(msg);
  }

  terminate() {
    this.terminated = true;
  }

  emit(msg: WorkerResponse) {
    act(() => {
      this.onmessage?.({ data: msg } as MessageEvent<WorkerResponse>);
    });
  }

  ready() {
    this.emit({ type: 'init-status', status: 'loading' });
    this.emit({
      type: 'init-status',
      status: 'ready',
      info: {
        pyodide: '314.0.7',
        python: '3.14.2',
        source: 'self',
        jspi: true,
        loadMs: 10,
        removedGlobals: ['fetch'],
      },
    });
  }

  lastRun() {
    const run = [...this.posted].reverse().find((m) => m.type === 'run');
    if (!run || run.type !== 'run') throw new Error('run 메시지 없음');
    return run;
  }
}

const latest = () => FakeWorker.instances.at(-1)!;

function setup() {
  const hook = renderHook(() =>
    usePyodide({ timeoutMs: 1000, stopGraceMs: 200 }),
  );
  latest().ready();
  return hook;
}

function startRun(
  result: { current: ReturnType<typeof usePyodide> },
  code = 'print(1)',
  options?: Parameters<ReturnType<typeof usePyodide>['runCode']>[1],
) {
  let promise!: Promise<RunResult>;
  act(() => {
    promise = result.current.runCode(code, options);
  });
  return promise;
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  report.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('usePyodide: 준비', () => {
  it('module Worker를 만들고 init을 보낸 뒤 ready가 되면 준비 완료', () => {
    const { result } = renderHook(() => usePyodide());
    const worker = latest();
    expect(worker.url).toBe(PYODIDE_WORKER_URL);
    expect(worker.options).toEqual({ type: 'module' });
    expect(worker.posted).toEqual([{ type: 'init' }]);
    expect(result.current.status).toBe('loading');

    worker.ready();
    expect(result.current.status).toBe('ready');
    expect(result.current.generation).toBe(1);
    expect(result.current.restarting).toBeNull();
    expect(result.current.runtimeInfo?.source).toBe('self');
  });

  it('로딩 실패는 error 상태 + Sentry 보고', () => {
    const { result } = renderHook(() => usePyodide());
    latest().emit({
      type: 'init-status',
      status: 'error',
      error: 'self: 404 / cdn: blocked',
    });
    expect(result.current.status).toBe('error');
    expect(report).toHaveBeenCalledWith('init', 'self: 404 / cdn: blocked');
  });

  it('준비 전·실행 중에는 실행하지 않음', async () => {
    const { result } = renderHook(() => usePyodide());
    await expect(startRun(result)).resolves.toMatchObject({ success: false });
    latest().ready();
    void startRun(result);
    await expect(startRun(result)).resolves.toMatchObject({
      success: false,
      stderr: expect.stringContaining('아직 실행 중'),
    });
  });
});

describe('usePyodide: 실행', () => {
  it('stdout을 실행 중에 콜백으로 넘기고 done에서 끝남', async () => {
    const { result } = setup();
    const chunks: string[] = [];
    const promise = startRun(result, 'print(1)', {
      onStdout: (t) => chunks.push(t),
    });
    expect(result.current.isRunning).toBe(true);
    const worker = latest();
    const { id } = worker.lastRun();
    worker.emit({ type: 'stdout', id, text: '1\n' });
    worker.emit({ type: 'stdout', id, text: '2\n' });
    expect(chunks).toEqual(['1\n', '2\n']);
    worker.emit({
      type: 'done',
      id,
      outcome: 'ok',
      hadException: false,
      errorType: null,
      truncated: false,
      ms: 3,
    });
    await expect(promise).resolves.toMatchObject({
      stdout: '1\n2\n',
      stderr: '',
      success: true,
      outcome: 'ok',
      hadException: false,
    });
    expect(result.current.isRunning).toBe(false);
  });

  it('성공 판정은 stderr 추측이 아니라 done의 outcome으로 (B25)', async () => {
    const { result } = setup();
    const worker = latest();

    const warned = startRun(result);
    const a = worker.lastRun().id;
    worker.emit({ type: 'stderr', id: a, text: 'hello\n' });
    worker.emit({
      type: 'done',
      id: a,
      outcome: 'ok',
      hadException: false,
      errorType: null,
      truncated: false,
      ms: 1,
    });
    await expect(warned).resolves.toMatchObject({
      success: true,
      stderr: 'hello\n',
    });

    const failed = startRun(result);
    const b = worker.lastRun().id;
    worker.emit({
      type: 'stderr',
      id: b,
      text: 'Traceback ...\nNameError: x\n',
    });
    worker.emit({
      type: 'done',
      id: b,
      outcome: 'error',
      hadException: true,
      errorType: 'NameError',
      truncated: false,
      ms: 1,
    });
    await expect(failed).resolves.toMatchObject({
      success: false,
      hadException: true,
      errorType: 'NameError',
    });
  });

  it('다른 실행 id의 메시지는 무시', async () => {
    const { result } = setup();
    const promise = startRun(result);
    const worker = latest();
    const { id } = worker.lastRun();
    worker.emit({ type: 'stdout', id: 'other', text: 'x' });
    worker.emit({
      type: 'done',
      id: 'other',
      outcome: 'ok',
      hadException: false,
      errorType: null,
      truncated: false,
      ms: 1,
    });
    expect(result.current.isRunning).toBe(true);
    worker.emit({
      type: 'done',
      id,
      outcome: 'ok',
      hadException: false,
      errorType: null,
      truncated: false,
      ms: 1,
    });
    await expect(promise).resolves.toMatchObject({ stdout: '', success: true });
  });

  it('run-error는 내부 오류로 보고하고 실패로 끝남', async () => {
    const { result } = setup();
    const promise = startRun(result);
    const worker = latest();
    worker.emit({ type: 'run-error', id: worker.lastRun().id, error: 'boom' });
    await expect(promise).resolves.toMatchObject({
      success: false,
      stderr: 'boom',
    });
    expect(report).toHaveBeenCalledWith('internal', 'boom');
  });
});

describe('usePyodide: 시간 초과·멈추기 (B14)', () => {
  it('시간 초과 때 stop을 보내고, Worker가 답하면(time.sleep 중) Worker를 유지', async () => {
    vi.useFakeTimers();
    const { result } = setup();
    const worker = latest();
    const promise = startRun(result);
    const { id } = worker.lastRun();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(worker.posted.at(-1)).toEqual({ type: 'stop', id });
    worker.emit({
      type: 'done',
      id,
      outcome: 'stopped',
      hadException: false,
      errorType: null,
      truncated: false,
      ms: 1000,
    });
    await expect(promise).resolves.toMatchObject({
      isTimeout: true,
      success: false,
      outcome: 'timeout',
    });
    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker.terminated).toBe(false);
  });

  it('CPU 무한 루프처럼 답이 없으면 terminate 후 새 Worker, 재준비 상태 노출', async () => {
    vi.useFakeTimers();
    const { result } = setup();
    const old = latest();
    const promise = startRun(result);
    act(() => {
      vi.advanceTimersByTime(1000 + 200);
    });
    await expect(promise).resolves.toMatchObject({
      isTimeout: true,
      success: false,
    });
    expect(old.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
    expect(result.current.status).toBe('loading');
    expect(result.current.restarting).toBe('timeout');
    expect(result.current.generation).toBe(2);
    expect(result.current.isRunning).toBe(false);

    latest().ready();
    expect(result.current.status).toBe('ready');
    expect(result.current.restarting).toBeNull();
  });

  it('종료된 Worker의 늦은 메시지·에러는 무시하고 Sentry에도 보내지 않음', () => {
    vi.useFakeTimers();
    const { result } = setup();
    const old = latest();
    // terminate 전에 걸어 둔 핸들러 (이미 큐에 들어간 이벤트를 흉내)
    const lateMessage = old.onmessage!;
    const lateError = old.onerror!;
    void startRun(result);
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(old.terminated).toBe(true);
    expect(old.onmessage).toBeNull();
    expect(old.onerror).toBeNull();

    act(() => {
      lateError({ type: 'error', message: 'NoGilError' } as unknown as Event);
      lateMessage({
        data: { type: 'init-status', status: 'error', error: 'late' },
      } as MessageEvent<WorkerResponse>);
    });
    expect(report).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');

    latest().ready();
    act(() => {
      lateMessage({
        data: { type: 'init-status', status: 'error', error: 'late' },
      } as MessageEvent<WorkerResponse>);
    });
    expect(result.current.status).toBe('ready');
  });

  it('stop()은 stop을 보내고 답이 없으면 Worker를 다시 띄움', async () => {
    vi.useFakeTimers();
    const { result } = setup();
    const old = latest();
    const promise = startRun(result);
    act(() => {
      result.current.stop();
    });
    expect(old.posted.at(-1)).toMatchObject({ type: 'stop' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await expect(promise).resolves.toMatchObject({
      isStopped: true,
      success: false,
    });
    expect(old.terminated).toBe(true);
    expect(result.current.restarting).toBe('stop');
  });

  it('stop()에 Worker가 답하면 재시작 없이 isStopped', async () => {
    const { result } = setup();
    const worker = latest();
    const promise = startRun(result);
    act(() => {
      result.current.stop();
    });
    const { id } = worker.lastRun();
    worker.emit({
      type: 'done',
      id,
      outcome: 'stopped',
      hadException: false,
      errorType: null,
      truncated: false,
      ms: 5,
    });
    await expect(promise).resolves.toMatchObject({
      isStopped: true,
      outcome: 'stopped',
    });
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('현재 Worker의 onerror는 보고하고 실행을 실패로 끝냄', async () => {
    const { result } = setup();
    const promise = startRun(result);
    act(() => {
      latest().onerror!({
        type: 'error',
        message: 'crash',
      } as unknown as Event);
    });
    await expect(promise).resolves.toMatchObject({ success: false });
    expect(report).toHaveBeenCalledWith('worker', 'crash', expect.any(Object));
    expect(result.current.status).toBe('error');
  });
});

describe('usePyodide: Worker 정리 (B14)', () => {
  it('언마운트하면 Worker를 terminate하고 진행 중인 실행을 끝냄', async () => {
    const { result, unmount } = setup();
    const worker = latest();
    const promise = startRun(result);
    unmount();
    expect(worker.terminated).toBe(true);
    await expect(promise).resolves.toMatchObject({
      isStopped: true,
      success: false,
    });
  });

  it('retry는 이전 Worker를 terminate하고 새 Worker를 만듦', () => {
    const { result } = renderHook(() => usePyodide());
    const old = latest();
    old.emit({ type: 'init-status', status: 'error', error: 'x' });
    act(() => {
      result.current.retry();
    });
    expect(old.terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
    expect(latest().posted).toEqual([{ type: 'init' }]);
    expect(result.current.status).toBe('loading');
    expect(result.current.generation).toBe(2);
  });

  it('여러 번 재시작해도 살아 있는 Worker는 하나', () => {
    vi.useFakeTimers();
    const { result } = setup();
    for (let i = 0; i < 3; i++) {
      void startRun(result);
      act(() => {
        vi.advanceTimersByTime(1200);
      });
      latest().ready();
    }
    expect(FakeWorker.instances).toHaveLength(4);
    expect(FakeWorker.instances.filter((w) => !w.terminated)).toHaveLength(1);
  });
});
