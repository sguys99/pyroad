// Worker ↔ Main Thread 메시지 프로토콜

export type WorkerRequest =
  | { type: 'init' }
  | { type: 'run'; id: string; code: string };

export type WorkerResponse =
  | {
      type: 'init-status';
      status: 'loading' | 'ready' | 'error';
      error?: string;
    }
  | {
      type: 'run-result';
      id: string;
      stdout: string;
      stderr: string;
      success: boolean;
    }
  | { type: 'run-error'; id: string; error: string };
