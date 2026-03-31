/* eslint-disable no-restricted-globals */

// Pyodide Web Worker
// Pyodide WASM을 CDN에서 로드하고, 사용자 Python 코드를 실행한다.

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';

const BLOCKED_MODULES = new Set([
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
]);

let pyodide = null;

/**
 * import 문에서 차단 모듈을 검사한다.
 * @returns 차단된 모듈 이름 또는 null
 */
function checkBlockedImports(code) {
  const importRegex = /^\s*(?:import|from)\s+(\w+)/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    if (BLOCKED_MODULES.has(match[1])) {
      return match[1];
    }
  }
  return null;
}

async function initPyodide() {
  self.postMessage({ type: 'init-status', status: 'loading' });
  try {
    importScripts(PYODIDE_CDN + 'pyodide.js');
    pyodide = await self.loadPyodide({ indexURL: PYODIDE_CDN });
    self.postMessage({ type: 'init-status', status: 'ready' });
  } catch (err) {
    self.postMessage({
      type: 'init-status',
      status: 'error',
      error: err.message || String(err),
    });
  }
}

async function runCode(id, code) {
  if (!pyodide) {
    self.postMessage({
      type: 'run-error',
      id,
      error: 'Pyodide가 아직 준비되지 않았어요.',
    });
    return;
  }

  // 차단 모듈 사전 검사
  const blocked = checkBlockedImports(code);
  if (blocked) {
    self.postMessage({
      type: 'run-result',
      id,
      stdout: '',
      stderr: `이 모듈은 사용할 수 없어요: ${blocked}. 안전한 모듈만 사용해 주세요!`,
      success: false,
    });
    return;
  }

  try {
    // stdout/stderr 캡처 설정
    pyodide.runPython(`
import sys, io
__stdout_capture = io.StringIO()
__stderr_capture = io.StringIO()
sys.stdout = __stdout_capture
sys.stderr = __stderr_capture
`);

    // __builtins__.__import__ 오버라이드로 런타임 모듈 차단
    const blockedList = JSON.stringify([...BLOCKED_MODULES]);
    pyodide.runPython(`
__blocked_modules = set(${blockedList.replace(/"/g, "'")})
__original_import = __builtins__.__import__
def __safe_import(name, *args, **kwargs):
    top_level = name.split('.')[0]
    if top_level in __blocked_modules:
        raise ImportError(f"이 모듈은 사용할 수 없어요: {top_level}")
    return __original_import(name, *args, **kwargs)
__builtins__.__import__ = __safe_import
`);

    // 사용자 코드 실행
    try {
      pyodide.runPython(code);
    } catch (execErr) {
      // Python 실행 에러는 stderr로 캡처
      pyodide.runPython(
        `sys.stderr.write(${JSON.stringify(String(execErr))})`
      );
    }

    // 결과 수집
    const stdout = pyodide.runPython('__stdout_capture.getvalue()');
    const stderr = pyodide.runPython('__stderr_capture.getvalue()');

    // stdout/stderr 복원 및 정리
    pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
__builtins__.__import__ = __original_import
del __stdout_capture, __stderr_capture, __blocked_modules, __original_import, __safe_import
`);

    self.postMessage({
      type: 'run-result',
      id,
      stdout: stdout || '',
      stderr: stderr || '',
      success: !stderr,
    });
  } catch (err) {
    // Pyodide 내부 에러 (예상 외)
    try {
      pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);
    } catch {
      // 복원 실패 시 무시
    }
    self.postMessage({
      type: 'run-error',
      id,
      error: err.message || String(err),
    });
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      await initPyodide();
      break;
    case 'run':
      await runCode(msg.id, msg.code);
      break;
  }
};
