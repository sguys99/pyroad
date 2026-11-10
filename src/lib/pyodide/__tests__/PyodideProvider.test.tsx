// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
import {
  PyodideProvider,
  usePyodideRuntime,
  type PyodideRuntime,
} from '../PyodideProvider';
import type { RunResult } from '../usePyodide';
import type { WorkerRequest, WorkerResponse } from '../types';

vi.mock('../workerErrorReport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../workerErrorReport')>()),
  reportPyodideWorkerError: vi.fn(),
}));

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  posted: WorkerRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(msg: WorkerRequest) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  emit(msg: WorkerResponse) {
    act(() => this.onmessage?.({ data: msg } as MessageEvent<WorkerResponse>));
  }
  ready() {
    this.emit({ type: 'init-status', status: 'ready' });
  }
}

/** 퀘스트 화면 대신: 실행기를 꺼내 바깥에 알려 준다 */
function QuestStub({
  id,
  onRuntime,
}: {
  id: string;
  onRuntime: (id: string, runtime: PyodideRuntime) => void;
}) {
  const runtime = usePyodideRuntime();
  const { start } = runtime;
  // 코드 퀘스트(useQuestSession)처럼 들어오자마자 start (Provider는 lazy, P7-07)
  useEffect(() => start(), [start]);
  useEffect(() => onRuntime(id, runtime));
  return <p>{id}</p>;
}

/** 퀴즈 화면 대신: start 를 부르지 않음 */
function QuizStub() {
  usePyodideRuntime();
  return <p>quiz</p>;
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PyodideProvider (B22: 퀘스트 레이아웃 단위 Worker 싱글톤)', () => {
  it('퀘스트를 옮겨도(자식이 바뀌어도) Worker를 다시 만들지 않고 준비된 상태를 그대로 쓴다', async () => {
    const seen: Record<string, PyodideRuntime> = {};
    const onRuntime = (id: string, runtime: PyodideRuntime) => {
      seen[id] = runtime;
    };
    const { rerender } = render(
      <PyodideProvider>
        <QuestStub key="q1" id="q1" onRuntime={onRuntime} />
      </PyodideProvider>,
    );
    expect(FakeWorker.instances).toHaveLength(1);
    const worker = FakeWorker.instances[0];
    worker.ready();
    expect(seen.q1.status).toBe('ready');

    // 소프트 내비게이션: 레이아웃(Provider)은 그대로, 페이지(key)만 바뀜
    rerender(
      <PyodideProvider>
        <QuestStub key="q2" id="q2" onRuntime={onRuntime} />
      </PyodideProvider>,
    );
    expect(FakeWorker.instances).toHaveLength(1);
    expect(worker.terminated).toBe(false);
    expect(worker.posted.filter((m) => m.type === 'init')).toHaveLength(1);
    expect(seen.q2.status).toBe('ready');
    expect(seen.q2.generation).toBe(seen.q1.generation);

    // 새 퀘스트가 같은 Worker로 바로 실행
    let promise!: Promise<RunResult>;
    act(() => {
      promise = seen.q2.runCode('print(1)');
    });
    const run = worker.posted.at(-1);
    expect(run?.type).toBe('run');
    if (run?.type !== 'run') throw new Error('run 없음');
    worker.emit({ type: 'stdout', id: run.id, text: '1\n' });
    worker.emit({
      type: 'done',
      id: run.id,
      outcome: 'ok',
      hadException: false,
      errorType: null,
      truncated: false,
      ms: 1,
    });
    await expect(promise).resolves.toMatchObject({
      stdout: '1\n',
      success: true,
    });
  });

  it('퀘스트 화면을 벗어나면(레이아웃 언마운트) Worker를 종료하고, 늦은 메시지는 무시한다 (B14 세대 가드)', () => {
    const { unmount } = render(
      <PyodideProvider>
        <QuestStub id="q1" onRuntime={() => {}} />
      </PyodideProvider>,
    );
    const worker = FakeWorker.instances[0];
    const handler = worker.onmessage;
    unmount();
    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
    // 종료된 Worker에 남아 있던 핸들러로 늦게 와도 에러 없이 무시
    expect(() =>
      handler?.({
        data: { type: 'init-status', status: 'ready' },
      } as MessageEvent<WorkerResponse>),
    ).not.toThrow();
  });

  it('lazy: start 를 부르기 전(퀴즈 화면)에는 Worker를 만들지 않고, 그 뒤 코드 퀘스트로 가면 그때 만든다 (P7-07)', () => {
    const { rerender } = render(
      <PyodideProvider>
        <QuizStub key="quiz" />
      </PyodideProvider>,
    );
    expect(FakeWorker.instances).toHaveLength(0);
    rerender(
      <PyodideProvider>
        <QuestStub key="q1" id="q1" onRuntime={() => {}} />
      </PyodideProvider>,
    );
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('Provider 밖에서 쓰면 알아보기 쉬운 에러', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<QuestStub id="q1" onRuntime={() => {}} />)).toThrow(
      /PyodideProvider/,
    );
  });
});
