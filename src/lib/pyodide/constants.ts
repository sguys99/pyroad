export const EXECUTION_TIMEOUT_MS = 5000;

export const MAX_OUTPUT_LENGTH = 5000;

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
] as const;
