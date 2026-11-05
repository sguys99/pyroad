import { describe, it, expect, vi, beforeEach } from 'vitest';

const { reportClientError } = vi.hoisted(() => ({
  reportClientError: vi.fn(),
}));
vi.mock('@/lib/observability/client', () => ({ reportClientError }));

import {
  PyodideWorkerError,
  describeWorkerErrorEvent,
  reportPyodideWorkerError,
  summarizeWorkerError,
} from '../workerErrorReport';

beforeEach(() => reportClientError.mockClear());

describe('summarizeWorkerError', () => {
  it('Python traceback은 마지막 예외 이름만 남긴다 (학생 코드·출력이 섞일 수 있음)', () => {
    const traceback = [
      'Traceback (most recent call last):',
      '  File "<exec>", line 1, in <module>',
      "NameError: name '__stdout_capture' is not defined. 철수의 비밀",
    ].join('\n');
    expect(summarizeWorkerError(traceback)).toBe('PythonError: NameError');
  });

  it('로딩 실패 같은 JS 메시지는 길이만 자른다', () => {
    const message =
      "NetworkError: Failed to execute 'importScripts' on 'WorkerGlobalScope'";
    expect(summarizeWorkerError(message)).toBe(message);
    expect(summarizeWorkerError('x'.repeat(1000))).toHaveLength(300);
  });

  it.each([undefined, null, '', '  ', 42])('%j → unknown', (value) => {
    expect(summarizeWorkerError(value)).toBe('unknown');
  });
});

describe('reportPyodideWorkerError', () => {
  it('단계·요약으로 묶어 보고한다', () => {
    reportPyodideWorkerError('init', 'NetworkError: load failed');
    expect(reportClientError).toHaveBeenCalledTimes(1);
    const [error, context] = reportClientError.mock.calls[0];
    expect(error).toBeInstanceOf(PyodideWorkerError);
    expect(error.message).toBe('init: NetworkError: load failed');
    expect(context).toEqual({
      tags: { area: 'pyodide', phase: 'init' },
      fingerprint: ['pyodide-worker', 'init', 'NetworkError: load failed'],
    });
  });

  it('내부 오류의 traceback 원문은 보내지 않는다', () => {
    reportPyodideWorkerError(
      'internal',
      'Traceback ...\n  File "<exec>"\nprint("비밀")\nSyntaxError: x',
    );
    const [error, context] = reportClientError.mock.calls[0];
    expect(error.message).toBe('internal: PythonError: SyntaxError');
    expect(JSON.stringify(context)).not.toContain('비밀');
  });
});

describe('describeWorkerErrorEvent', () => {
  it('ErrorEvent에서 메시지·파일(쿼리 제거)·줄 번호만 고른다', () => {
    const event = Object.assign(new Event('error'), {
      message: 'Uncaught RangeError',
      filename: 'https://pyroad.vercel.app/workers/pyodide-worker.js?v=1',
      lineno: 12,
    });
    expect(describeWorkerErrorEvent(event)).toEqual({
      message: 'Uncaught RangeError',
      extra: {
        eventType: 'error',
        filename: 'https://pyroad.vercel.app/workers/pyodide-worker.js',
        lineno: 12,
      },
    });
  });

  it('스크립트 로드 실패(메시지 없는 Event)도 처리한다', () => {
    expect(describeWorkerErrorEvent(new Event('error'))).toEqual({
      message: undefined,
      extra: { eventType: 'error' },
    });
  });
});
