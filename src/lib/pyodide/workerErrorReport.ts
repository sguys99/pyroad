import { reportClientError } from '@/lib/observability/client';

/**
 * Pyodide Worker 자체 에러를 Sentry로 보고한다 (P1-16).
 *
 * 보고 대상은 실행기 문제뿐이다: 초기화·로딩 실패(`init`), Worker에서 잡히지 않은 예외(`worker`),
 * 실행 중 Pyodide 내부 오류(`internal`, 워커의 `run-error`).
 * 학생 코드의 정상적인 Python 오류(SyntaxError 등)는 `run-result`의 stderr로 오므로 보고하지 않고,
 * 시간 초과(무한 루프)도 학생 코드 문제라 보고하지 않는다.
 */
export type PyodideWorkerErrorPhase = 'init' | 'worker' | 'internal';

export class PyodideWorkerError extends Error {
  constructor(
    readonly phase: PyodideWorkerErrorPhase,
    readonly summary: string,
  ) {
    super(`${phase}: ${summary}`);
    this.name = 'PyodideWorkerError';
  }
}

const MAX_MESSAGE_LENGTH = 300;
const PYTHON_EXCEPTION = /\b([A-Z]\w*(?:Error|Exception|Exit|Interrupt))\b/g;

/**
 * 워커 에러 메시지를 보낼 수 있는 모양으로 줄인다.
 * Python traceback이 섞인 메시지는 학생 코드·출력이 들어 있을 수 있으므로 마지막 예외 이름만 남긴다.
 */
export function summarizeWorkerError(message: unknown): string {
  if (typeof message !== 'string' || !message.trim()) return 'unknown';
  if (/Traceback|File "|<exec>/.test(message)) {
    const types = [...message.matchAll(PYTHON_EXCEPTION)].map(
      (match) => match[1],
    );
    return `PythonError: ${types.at(-1) ?? 'unknown'}`;
  }
  return message.trim().slice(0, MAX_MESSAGE_LENGTH);
}

export function reportPyodideWorkerError(
  phase: PyodideWorkerErrorPhase,
  message: unknown,
  extra?: Record<string, unknown>,
): void {
  const summary = summarizeWorkerError(message);
  reportClientError(new PyodideWorkerError(phase, summary), {
    tags: { area: 'pyodide', phase },
    fingerprint: ['pyodide-worker', phase, summary],
    ...(extra && { extra }),
  });
}

/** `worker.onerror` 이벤트에서 보낼 값만 고른다 (파일 경로는 쿼리를 뗀 워커 스크립트 경로) */
export function describeWorkerErrorEvent(event: Event): {
  message: unknown;
  extra: Record<string, unknown>;
} {
  const errorEvent = event as Partial<ErrorEvent>;
  return {
    message: errorEvent.message,
    extra: {
      eventType: event.type,
      ...(typeof errorEvent.filename === 'string' &&
        errorEvent.filename && {
          filename: errorEvent.filename.split(/[?#]/)[0],
        }),
      ...(typeof errorEvent.lineno === 'number' && {
        lineno: errorEvent.lineno,
      }),
    },
  };
}
