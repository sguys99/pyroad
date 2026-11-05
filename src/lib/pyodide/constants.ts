// Pyodide 실행기 상수. 같은 값이 public/workers/pyodide-core.mjs에도 있다(번들 없이 도는 Worker라
// import할 수 없음). 두 곳이 같은지는 scripts/pyodide/__tests__/runtime.pyodide.test.ts가 확인한다.

/** npm `pyodide` 버전 = 자체 호스팅 경로 = CI 버전 (B26, §2.9). package.json과 같아야 함 */
export const PYODIDE_VERSION = '314.0.7';

/** 자체 호스팅 경로 (scripts/pyodide/copy-assets.mjs가 빌드 전에 복사) */
export const PYODIDE_SELF_HOST_PATH = `/pyodide/${PYODIDE_VERSION}/`;

/** 자체 호스팅이 막혔을 때만 쓰는 폴백 */
export const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** module Worker 스크립트 (`new Worker(url, { type: 'module' })`) */
export const PYODIDE_WORKER_URL = '/workers/pyodide-worker.mjs';

export const EXECUTION_TIMEOUT_MS = 5000;

/**
 * stop을 보낸 뒤 Worker가 답할 때까지 기다리는 시간. time.sleep 대기 중이면(JSPI) 수십 ms 안에 끝나고,
 * CPU 무한 루프면 답이 없으므로 이 시간이 지나면 Worker를 terminate하고 다시 띄운다.
 */
export const STOP_GRACE_MS = 500;

/** 화면·튜터에 넘기는 stdout/stderr 최대 길이 */
export const MAX_OUTPUT_LENGTH = 5000;

/** Worker가 실행 한 번에 모으는 출력 최대 길이. 넘으면 자르고 실행을 멈춘다 (B15) */
export const MAX_CAPTURE_LENGTH = 100_000;

export const BLOCKED_MODULES = [
  'os',
  'subprocess',
  'socket',
  'urllib',
  'http',
  'ftplib',
  'smtplib',
  'webbrowser',
  'ctypes',
  'importlib',
  'shutil',
  'pathlib',
  'signal',
  'multiprocessing',
  'threading',
  // JS 다리 모듈 (B15). 실수 방지용이고 보안 경계는 Worker 전역의 네트워크 API 제거
  'js',
  'pyodide',
  'pyodide_js',
  '_pyodide',
  '_pyodide_core',
  'micropip',
] as const;
