import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// 공지 API (B36): DB 오류 문구는 응답에 넣지 않고 로그·Sentry 로만. 관리자 판별은 B37

const NOTICE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DB_SECRET =
  'new row for relation "notices" violates check constraint "notices_title_check"';
const DB_ERROR = {
  code: '23514',
  message: DB_SECRET,
  details: 'Failing row contains (공지 본문)',
};

const mocks = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  /** 사용자 클라이언트 목록 조회 결과 */
  listError: null as unknown,
  /** service_role 조회(select … maybeSingle) 결과 */
  lookupRow: null as unknown,
  lookupError: null as unknown,
  /** service_role 쓰기 오류 */
  writeError: null as unknown,
  writes: [] as { op: string; values?: unknown }[],
  captured: [] as { error: unknown; context: unknown }[],
}));

function adminBuilder() {
  let op = 'select';
  const result = () => {
    if (op === 'select')
      return { data: mocks.lookupRow, error: mocks.lookupError };
    if (mocks.writeError) return { data: null, error: mocks.writeError };
    return { data: { id: NOTICE_ID }, error: null };
  };
  const b = {
    select: () => b,
    insert: (values: unknown) => (
      (op = 'insert'),
      mocks.writes.push({ op, values }),
      b
    ),
    update: (values: unknown) => (
      (op = 'update'),
      mocks.writes.push({ op, values }),
      b
    ),
    delete: () => ((op = 'delete'), mocks.writes.push({ op }), b),
    eq: () => b,
    single: async () => result(),
    maybeSingle: async () => result(),
    then: (resolve: (v: unknown) => void) => resolve(result()),
  };
  return b;
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: () => adminBuilder() }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: () => {
      const b = {
        select: () => b,
        order: () => b,
        range: async () =>
          mocks.listError
            ? { data: null, count: null, error: mocks.listError }
            : { data: [], count: 0, error: null },
      };
      return b;
    },
  }),
}));
vi.mock('@/lib/observability/server', () => ({
  captureServerError: (error: unknown, context: unknown) =>
    mocks.captured.push({ error, context }),
}));

import { GET as listNotices, POST as createNotice } from '../route';
import {
  PATCH as patchNotice,
  DELETE as deleteNotice,
} from '../[noticeId]/route';
import { NOTICE_MESSAGES } from '@/lib/notice/server';

const ADMIN = {
  id: '11111111-1111-4111-8111-111111111111',
  app_metadata: { role: 'admin' },
  user_metadata: {},
};
const KID = {
  id: '22222222-2222-4222-8222-222222222222',
  app_metadata: { provider: 'kakao' },
  user_metadata: { role: 'admin' },
};

function req(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/notice', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const params = (noticeId = NOTICE_ID) => ({
  params: Promise.resolve({ noticeId }),
});

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.user = ADMIN;
  mocks.listError = null;
  mocks.lookupRow = { id: NOTICE_ID };
  mocks.lookupError = null;
  mocks.writeError = null;
  mocks.writes = [];
  mocks.captured = [];
  vi.stubEnv('ADMIN_EMAIL', '');
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

/** 응답에 DB 문구가 없고, 로그·Sentry 에는 코드·메시지(details 제외)가 남았는지 */
async function expectHiddenServerError(
  res: Response,
  message: string,
  op: string,
) {
  expect(res.status).toBe(500);
  const text = await res.clone().text();
  expect(text).not.toContain('notices_title_check');
  expect(text).not.toContain('23514');
  expect(await res.json()).toEqual({ error: message });

  expect(consoleError).toHaveBeenCalledWith(
    `[notice] ${op} 실패:`,
    `23514 ${DB_SECRET}`,
  );
  expect(JSON.stringify(consoleError.mock.calls)).not.toContain('공지 본문');
  expect(mocks.captured).toHaveLength(1);
  expect(mocks.captured[0].context).toEqual({
    tags: { area: 'notice', op },
  });
}

describe('GET /api/notice', () => {
  it('목록을 돌려줌', async () => {
    mocks.user = null;
    const res = await listNotices(
      new NextRequest('http://localhost/api/notice'),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notices: [], total: 0 });
  });

  it('DB 오류는 아이용 문구로', async () => {
    mocks.user = null;
    mocks.listError = DB_ERROR;
    const res = await listNotices(
      new NextRequest('http://localhost/api/notice'),
    );
    await expectHiddenServerError(res, NOTICE_MESSAGES.listFailed, 'list');
  });
});

describe('POST /api/notice', () => {
  it('관리자는 공지를 만듦', async () => {
    const res = await createNotice(req({ title: ' 제목 ', content: '내용' }));
    expect(res.status).toBe(200);
    expect(mocks.writes).toEqual([
      {
        op: 'insert',
        values: { user_id: ADMIN.id, title: '제목', content: '내용' },
      },
    ]);
  });

  it('로그인 안 함 401, user_metadata.role 만 admin 이면 403 (쓰기 없음)', async () => {
    mocks.user = null;
    expect((await createNotice(req({ title: 't', content: 'c' }))).status).toBe(
      401,
    );
    mocks.user = KID;
    const res = await createNotice(req({ title: 't', content: 'c' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: NOTICE_MESSAGES.forbidden });
    expect(mocks.writes).toEqual([]);
  });

  it('잘못된 본문은 400 (문자열이 아닌 값 포함)', async () => {
    expect((await createNotice(req('{'))).status).toBe(400);
    expect((await createNotice(req({ title: 1, content: 'c' }))).status).toBe(
      400,
    );
    expect((await createNotice(req(null))).status).toBe(400);
    expect(mocks.writes).toEqual([]);
  });

  it('DB 오류는 관리자용 일반 문구로', async () => {
    mocks.writeError = DB_ERROR;
    const res = await createNotice(req({ title: '제목', content: '내용' }));
    await expectHiddenServerError(res, NOTICE_MESSAGES.saveFailed, 'create');
  });
});

describe('PATCH /api/notice/[noticeId]', () => {
  it('관리자는 공지를 고침', async () => {
    const res = await patchNotice(req({ title: '새 제목' }, 'PATCH'), params());
    expect(res.status).toBe(200);
    expect(mocks.writes).toHaveLength(1);
    expect(mocks.writes[0].values).toMatchObject({ title: '새 제목' });
  });

  it('관리자가 아니면 403', async () => {
    mocks.user = KID;
    const res = await patchNotice(req({ title: 't' }, 'PATCH'), params());
    expect(res.status).toBe(403);
    expect(mocks.writes).toEqual([]);
  });

  it('없는 공지·uuid 가 아닌 id 는 404 (DB 에 보내지 않음)', async () => {
    mocks.lookupRow = null;
    expect(
      (await patchNotice(req({ title: 't' }, 'PATCH'), params())).status,
    ).toBe(404);
    mocks.lookupError = {
      code: '22P02',
      message: 'invalid input syntax for type uuid',
    };
    const res = await patchNotice(req({ title: 't' }, 'PATCH'), params('nope'));
    expect(res.status).toBe(404);
    expect(mocks.captured).toEqual([]);
  });

  it('조회 DB 오류는 404 가 아니라 500 일반 문구', async () => {
    mocks.lookupError = DB_ERROR;
    const res = await patchNotice(req({ title: 't' }, 'PATCH'), params());
    await expectHiddenServerError(
      res,
      NOTICE_MESSAGES.saveFailed,
      'update.lookup',
    );
    expect(mocks.writes).toEqual([]);
  });

  it('수정 DB 오류는 관리자용 일반 문구로', async () => {
    mocks.writeError = DB_ERROR;
    const res = await patchNotice(req({ content: '내용' }, 'PATCH'), params());
    await expectHiddenServerError(res, NOTICE_MESSAGES.saveFailed, 'update');
  });
});

describe('DELETE /api/notice/[noticeId]', () => {
  it('관리자는 공지를 지움', async () => {
    const res = await deleteNotice(req(undefined, 'DELETE'), params());
    expect(res.status).toBe(200);
    expect(mocks.writes).toEqual([{ op: 'delete' }]);
  });

  it('로그인 안 함 401', async () => {
    mocks.user = null;
    const res = await deleteNotice(req(undefined, 'DELETE'), params());
    expect(res.status).toBe(401);
    expect(mocks.writes).toEqual([]);
  });

  it('삭제 DB 오류는 관리자용 일반 문구로', async () => {
    mocks.writeError = DB_ERROR;
    const res = await deleteNotice(req(undefined, 'DELETE'), params());
    await expectHiddenServerError(res, NOTICE_MESSAGES.deleteFailed, 'delete');
  });
});
