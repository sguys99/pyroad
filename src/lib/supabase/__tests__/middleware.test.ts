import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROTECTED_PATHS } from '../middleware';

// B120 (P12-05 L2): 미들웨어 보호 목록이 (protected) 폴더와 어긋나면 비로그인 요청이 200 + 화면 안 리다이렉트로 감
describe('PROTECTED_PATHS', () => {
  it('(protected) 아래 모든 라우트 폴더가 보호 목록에 있음', () => {
    const dir = join(process.cwd(), 'src/app/(protected)');
    const routes = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !/^[_(@[]/.test(d.name))
      .map((d) => `/${d.name}`);
    expect(routes.length).toBeGreaterThan(5);
    expect(routes.filter((r) => !PROTECTED_PATHS.includes(r))).toEqual([]);
  });
});
