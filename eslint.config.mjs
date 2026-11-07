import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // public/pyodide/는 빌드 전에 npm 패키지에서 복사하는 Pyodide 배포 파일 (B26)
  // playwright-report/·test-results/는 e2e 실행 산출물 (P1-21, git 제외)
  // design/은 Phase 2 디자인 프로토타입 (앱 코드 아님, P2-01)
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'spikes/**',
      '.claude/worktrees/**',
      'design/**',
      'public/pyodide/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    files: ['postcss.config.mjs'],
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default eslintConfig;
