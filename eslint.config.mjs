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
  { ignores: ['.next/**', 'next-env.d.ts', 'spikes/**', 'public/pyodide/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    files: ['postcss.config.mjs'],
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default eslintConfig;
