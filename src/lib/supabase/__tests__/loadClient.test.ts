import { describe, it, expect, vi } from 'vitest';

const fakeClient = { auth: {} };
const createClient = vi.fn(() => fakeClient);
vi.mock('../client', () => ({ createClient }));

import { loadBrowserClient } from '../loadClient';

describe('loadBrowserClient', () => {
  it('브라우저 클라이언트 모듈을 동적으로 불러와 createClient 결과를 돌려준다 (B33)', async () => {
    await expect(loadBrowserClient()).resolves.toBe(fakeClient);
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
