// 로그인 스펙 정리 (P1-21): 이번 실행의 테스트 사용자를 지운다 (진행·뱃지·한도 행은 ON DELETE CASCADE).
// E2E_KEEP_USER=1 이면 남겨 둔다 (실패 화면을 손으로 다시 볼 때).

import { rmSync } from 'node:fs';
import { test as teardown } from '@playwright/test';
import { adminClient, readE2eUser } from './support/admin';
import { STORAGE_STATE, USER_FILE } from './support/env';

teardown('테스트 사용자 지우기', async () => {
  if (process.env.E2E_KEEP_USER === '1') return;
  const user = readE2eUser();
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) throw new Error(`[e2e] 테스트 사용자 삭제 실패: ${error.message}`);
  rmSync(USER_FILE, { force: true });
  rmSync(STORAGE_STATE, { force: true });
});
