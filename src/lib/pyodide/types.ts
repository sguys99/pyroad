// Worker ↔ Main Thread 메시지 프로토콜 (§2.9, P0-05 §6.4)
//
// 실행 로직은 public/workers/pyodide-core.mjs 하나이고, 브라우저 module Worker(pyodide-worker.mjs)와
// Node worker_threads(scripts/pyodide/node-worker.mjs, P1-13)가 같은 메시지를 주고받는다.
//
//   main → worker: init → run → (stop | answer)*
//   worker → main: init-status(loading → ready | error)
//                  stdout* / stderr* (실행 중 스트리밍, 묶어서 보냄) → done
//                  run-error (실행기 내부 오류. 이때는 done이 오지 않음)
//                  input-request (P11-01에서 사용. 지금은 보내지 않음)
// 확장 예정: turtle 명령 청크 `{ type: 'turtle', id, chunk }` (P11-02)

export type WorkerRequest =
  | { type: 'init' }
  | {
      type: 'run';
      id: string;
      code: string;
      /** random.seed(seed)를 실행 전에 부름 (CI 정답 검증용). 없으면 그대로 */
      seed?: number;
      /** 미리 정한 입력 줄 (CI 입력 시나리오, P1-13·P11-05). 다 쓰면 EOFError */
      stdin?: string[];
    }
  /** 실행 멈추기. time.sleep 대기 중이면(JSPI) Worker를 살린 채 끝나고, CPU 루프면 응답이 없음 → terminate */
  | { type: 'stop'; id?: string }
  /** input-request에 대한 답 (P11-01) */
  | { type: 'answer'; id: string; value: string };

/** 실행이 어떻게 끝났는지 */
export type RunOutcome =
  /** 끝까지 실행됨 (경고만 있는 stderr 포함) */
  | 'ok'
  /** Python 예외 (traceback은 stderr로 옴) */
  | 'error'
  /** stop 메시지로 멈춤 (KeyboardInterrupt) */
  | 'stopped'
  /** 출력 상한(MAX_CAPTURE_LENGTH)을 넘어서 멈춤 */
  | 'output-limit'
  /** 다른 스레드가 interrupt buffer로 시간 초과를 알림 (Node 검증 실행기) */
  | 'timeout';

/**
 * 실행기 준비 단계. download = Pyodide 파일 받기·파이썬 띄우기(첫 방문은 수 초~수십 초),
 * setup = 실행기 안전 장치(네트워크 API 지우기 등, 짧음)
 */
export type PyodideLoadStage = 'download' | 'setup';

export interface WorkerRuntimeInfo {
  pyodide: string;
  python: string;
  /** 어디서 Pyodide를 불러왔는지. self = /pyodide/<버전>/, cdn = jsDelivr 폴백, npm = Node */
  source: 'self' | 'cdn' | 'npm';
  /** run_sync를 쓸 수 있는지 (JSPI). true면 time.sleep 중 멈추기가 Worker 재시작 없이 됨 */
  jspi: boolean;
  loadMs: number;
  /** 로딩 뒤 Worker 전역에서 지운 네트워크 API */
  removedGlobals: string[];
}

export interface RunDoneMessage {
  type: 'done';
  id: string;
  outcome: RunOutcome;
  /** 학생 코드에서 예외가 났는지 (차단 모듈 안내 포함). 경고는 예외가 아님 */
  hadException: boolean;
  /** 예외 클래스 이름 (예: NameError). 예외가 없으면 null */
  errorType: string | null;
  /** 출력이 상한을 넘어 잘렸는지 */
  truncated: boolean;
  ms: number;
}

export type WorkerResponse =
  | {
      type: 'init-status';
      status: 'loading' | 'ready' | 'error';
      /** loading 단계 (브라우저 Worker만 보냄, P6-05 준비 연출) */
      stage?: PyodideLoadStage;
      error?: string;
      info?: WorkerRuntimeInfo;
    }
  | { type: 'stdout'; id: string; text: string }
  | { type: 'stderr'; id: string; text: string }
  | { type: 'input-request'; id: string; prompt: string }
  | RunDoneMessage
  | { type: 'run-error'; id: string; error: string };
