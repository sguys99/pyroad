import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 게시판 API (P1-18, B19): 쓰기는 검사 후 service_role 로만, DB 오류 문구는 응답에 넣지 않음

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const POST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DB_SECRET =
  'new row for relation "board_posts" violates check constraint "board_posts_title_check"';

interface Call {
  table: string;
  op: string;
  values?: unknown;
  filters: [string, unknown][];
}

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  calls: [] as Call[],
  rpcCalls: [] as { fn: string; args: unknown }[],
  /** table → 조회 결과 (select … maybeSingle) */
  rows: {} as Record<string, unknown>,
  /** 다음 쓰기에 돌려줄 오류 */
  writeError: null as {
    code: string;
    message: string;
    details?: string;
  } | null,
  rpcResult: null as unknown,
  rpcError: null as { code: string; message: string } | null,
  userClientWrites: 0,
  captured: [] as unknown[],
}));

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] };
  const result = () => {
    if (call.op === 'select')
      return { data: mocks.rows[table] ?? null, error: null };
    if (mocks.writeError) return { data: null, error: mocks.writeError };
    return {
      data:
        call.op === 'insert'
          ? { id: 'new-id', created_at: '2026-11-04T00:00:00Z' }
          : null,
      error: null,
    };
  };
  const b = {
    select: () => b,
    insert: (values: unknown) => (
      (call.op = 'insert'),
      (call.values = values),
      b
    ),
    update: (values: unknown) => (
      (call.op = 'update'),
      (call.values = values),
      b
    ),
    delete: () => ((call.op = 'delete'), b),
    eq: (col: string, v: unknown) => (call.filters.push([col, v]), b),
    single: async () => result(),
    maybeSingle: async () => result(),
    then: (resolve: (v: unknown) => void) => resolve(result()),
  };
  mocks.calls.push(call);
  return b;
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => builder(table),
    rpc: async (fn: string, args: unknown) => {
      mocks.rpcCalls.push({ fn, args });
      return { data: mocks.rpcResult, error: mocks.rpcError };
    },
  }),
}));
// 사용자 클라이언트: 인증만. 게시판 쓰기에 쓰이면 기록 (쓰면 안 됨, ③ 00015 이후 403)
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    from: () => {
      mocks.userClientWrites++;
      throw new Error('user client must not touch board tables');
    },
  }),
}));
vi.mock('@/lib/observability/server', () => ({
  captureServerError: (error: unknown) => mocks.captured.push(error),
}));

import { POST as createPost } from '../posts/route';
import {
  PATCH as patchPost,
  DELETE as deletePost,
} from '../posts/[postId]/route';
import { POST as createComment } from '../comments/route';
import { DELETE as deleteComment } from '../comments/[commentId]/route';
import { POST as report } from '../reports/route';

function req(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/board', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const postParams = (postId = POST_ID) => ({
  params: Promise.resolve({ postId }),
});
const commentParams = (commentId = COMMENT_ID) => ({
  params: Promise.resolve({ commentId }),
});
const writes = () => mocks.calls.filter((c) => c.op !== 'select');

beforeEach(() => {
  mocks.user = { id: U1 };
  mocks.calls = [];
  mocks.rpcCalls = [];
  mocks.rows = {};
  mocks.writeError = null;
  mocks.rpcResult = null;
  mocks.rpcError = null;
  mocks.userClientWrites = 0;
  mocks.captured = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  expect(mocks.userClientWrites).toBe(0);
  vi.restoreAllMocks();
});

describe('POST /api/board/posts', () => {
  it('정상 글은 service_role 로 저장 (작성자 = 로그인 사용자)', async () => {
    const res = await createPost(
      req({ title: ' 질문 ', content: '파이썬 재밌어요', user_id: U2 }),
    );
    expect(res.status).toBe(200);
    expect(writes()).toEqual([
      {
        table: 'board_posts',
        op: 'insert',
        values: { user_id: U1, title: '질문', content: '파이썬 재밌어요' },
        filters: [],
      },
    ]);
  });

  it('로그인하지 않으면 401 (아이용 문구)', async () => {
    mocks.user = null;
    const res = await createPost(req({ title: 'a', content: 'b' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('로그인이 필요해요.');
  });

  it('금칙어·개인정보는 저장하지 않고 안내 (어떤 말인지 알려 주지 않음)', async () => {
    const res = await createPost(
      req({ title: '안녕', content: '이거 시 발 어렵네' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'moderation', field: 'content' });
    expect(body.error).toContain('다른 말로 바꿔 볼까요?');
    expect(body.error).not.toContain('시');

    const phone = await createPost(
      req({ title: '내 번호 010-9876-5432', content: '연락해' }),
    );
    expect(await phone.json()).toMatchObject({
      code: 'moderation',
      field: 'title',
    });
    expect(writes()).toEqual([]);
  });

  it('빈 값·공백만·한도 초과는 400 (DB CHECK 와 같은 규칙: 코드 포인트 기준)', async () => {
    const zwsp = String.fromCharCode(0x200b);
    for (const body of [
      { title: '', content: 'x' },
      { title: '   ', content: 'x' },
      { title: zwsp, content: 'x' },
      { title: 'x' },
      { title: 'x'.repeat(101), content: 'x' },
      { title: 'x', content: 'x'.repeat(2001) },
      { title: 1, content: 'x' },
    ]) {
      expect((await createPost(req(body))).status).toBe(400);
    }
    // 이모지 100개 = 100자 (UTF-16 으로는 200)
    expect(
      (await createPost(req({ title: '🐍'.repeat(100), content: 'x' }))).status,
    ).toBe(200);
    expect((await createPost(req('not json'))).status).toBe(400);
    expect((await createPost(req(['x']))).status).toBe(400);
  });

  it('DB 오류: 응답에는 일반 문구만, 로그·Sentry 에는 코드·메시지 (글 내용 details 는 남기지 않음)', async () => {
    mocks.writeError = {
      code: '23514',
      message: DB_SECRET,
      details: 'Failing row contains (…아이가 쓴 글…)',
    };
    const res = await createPost(req({ title: '질문', content: '내용' }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('constraint');
    expect(text).not.toContain('board_posts');
    expect(JSON.parse(text).error).toBe(
      '앗, 지금은 저장하지 못했어요. 잠시 뒤에 다시 해 볼까요?',
    );
    expect(mocks.captured).toHaveLength(1);
    expect(String(mocks.captured[0])).toContain('23514');
    expect(String(mocks.captured[0])).not.toContain('Failing row');
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(logged).toContain('post_create');
    expect(logged).not.toContain('Failing row');
  });
});

describe('PATCH·DELETE /api/board/posts/[postId]', () => {
  it('작성자만 고침, service_role 로 id·user_id 조건을 함께', async () => {
    mocks.rows.board_posts = { user_id: U1 };
    const res = await patchPost(
      req({ content: '고쳤어요' }, 'PATCH'),
      postParams(),
    );
    expect(res.status).toBe(200);
    const [w] = writes();
    expect(w).toMatchObject({
      table: 'board_posts',
      op: 'update',
      filters: [
        ['id', POST_ID],
        ['user_id', U1],
      ],
    });
    expect(w.values).toMatchObject({ content: '고쳤어요' });
    expect(w.values).not.toHaveProperty('is_hidden');
    expect(w.values).not.toHaveProperty('title');
  });

  it('남의 글은 403, 없는 글·이상한 id 는 404', async () => {
    mocks.rows.board_posts = { user_id: U2 };
    expect(
      (await patchPost(req({ content: 'x' }, 'PATCH'), postParams())).status,
    ).toBe(403);
    expect((await deletePost(req({}, 'DELETE'), postParams())).status).toBe(
      403,
    );
    mocks.rows.board_posts = null;
    expect((await deletePost(req({}, 'DELETE'), postParams())).status).toBe(
      404,
    );
    mocks.calls = [];
    expect(
      (await deletePost(req({}, 'DELETE'), postParams('1 or 1=1'))).status,
    ).toBe(404);
    expect(mocks.calls).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it('수정도 금칙어 검사', async () => {
    mocks.rows.board_posts = { user_id: U1 };
    const res = await patchPost(
      req({ title: '카톡 아이디 알려줘' }, 'PATCH'),
      postParams(),
    );
    expect(await res.json()).toMatchObject({
      code: 'moderation',
      field: 'title',
    });
    expect(writes()).toEqual([]);
  });

  it('삭제', async () => {
    mocks.rows.board_posts = { user_id: U1 };
    expect((await deletePost(req({}, 'DELETE'), postParams())).status).toBe(
      200,
    );
    expect(writes()).toMatchObject([
      {
        op: 'delete',
        filters: [
          ['id', POST_ID],
          ['user_id', U1],
        ],
      },
    ]);
  });
});

describe('/api/board/comments', () => {
  it('정상 댓글 저장 + 작성자 표시 이름(닉네임 → 모험가NNNN)·아바타 스킨', async () => {
    mocks.rows.board_posts = { user_id: U2, is_hidden: false };
    mocks.rows.user_profiles_public = {
      display_name: '모험가1234',
      avatar_skin: 'violet',
    };
    const res = await createComment(
      req({ post_id: POST_ID, content: '저도 궁금해요' }),
    );
    expect(res.status).toBe(200);
    const { comment } = await res.json();
    expect(comment.author_name).toBe('모험가1234');
    expect(comment.author_skin).toBe('violet');
    expect(writes()).toMatchObject([
      {
        table: 'board_comments',
        op: 'insert',
        values: { post_id: POST_ID, user_id: U1, content: '저도 궁금해요' },
      },
    ]);
  });

  it('숨긴 남의 글·없는 글에는 댓글 404, 금칙어·501자는 400', async () => {
    mocks.rows.board_posts = { user_id: U2, is_hidden: true };
    expect(
      (await createComment(req({ post_id: POST_ID, content: '안녕' }))).status,
    ).toBe(404);
    mocks.rows.board_posts = null;
    expect(
      (await createComment(req({ post_id: POST_ID, content: '안녕' }))).status,
    ).toBe(404);
    mocks.rows.board_posts = { user_id: U2, is_hidden: false };
    expect(
      (await createComment(req({ post_id: POST_ID, content: 'ㅂㅅ' }))).status,
    ).toBe(400);
    expect(
      (await createComment(req({ post_id: POST_ID, content: 'x'.repeat(501) })))
        .status,
    ).toBe(400);
    expect(
      (await createComment(req({ post_id: 'nope', content: '안녕' }))).status,
    ).toBe(400);
    expect(writes()).toEqual([]);
  });

  it('댓글 삭제: 남의 댓글 403, 내 댓글은 service_role 로', async () => {
    mocks.rows.board_comments = { user_id: U2 };
    expect(
      (await deleteComment(req({}, 'DELETE'), commentParams())).status,
    ).toBe(403);
    mocks.rows.board_comments = { user_id: U1 };
    expect(
      (await deleteComment(req({}, 'DELETE'), commentParams())).status,
    ).toBe(200);
    expect(writes()).toMatchObject([
      {
        table: 'board_comments',
        op: 'delete',
        filters: [
          ['id', COMMENT_ID],
          ['user_id', U1],
        ],
      },
    ]);
  });
});

describe('POST /api/board/reports', () => {
  it('report_board_content 를 로그인 사용자 id 로 부름', async () => {
    mocks.rpcResult = { result: 'reported', hidden: false };
    const res = await report(
      req({
        target_type: 'post',
        target_id: POST_ID,
        reason: 'abuse',
        reporter_id: U2,
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      status: 'reported',
      message: '알려 줘서 고마워요! 어른이 살펴볼게요.',
    });
    expect(mocks.rpcCalls).toEqual([
      {
        fn: 'report_board_content',
        args: {
          p_reporter_id: U1,
          p_target_type: 'post',
          p_target_id: POST_ID,
          p_reason: 'abuse',
        },
      },
    ]);
  });

  it('이미 신고·본인 글·없는 대상', async () => {
    mocks.rpcResult = { result: 'already', hidden: true };
    const already = await report(
      req({ target_type: 'comment', target_id: COMMENT_ID, reason: 'other' }),
    );
    expect(await already.json()).toMatchObject({ ok: true, status: 'already' });
    // 숨김 여부(신고 수)는 신고한 사람에게 알려 주지 않음
    mocks.rpcResult = { result: 'reported', hidden: true };
    expect(
      await (
        await report(
          req({ target_type: 'post', target_id: POST_ID, reason: 'abuse' }),
        )
      ).json(),
    ).not.toHaveProperty('hidden');
    mocks.rpcResult = { result: 'own', hidden: false };
    expect(
      (
        await report(
          req({ target_type: 'post', target_id: POST_ID, reason: 'abuse' }),
        )
      ).status,
    ).toBe(400);
    mocks.rpcResult = { result: 'not_found', hidden: false };
    expect(
      (
        await report(
          req({ target_type: 'post', target_id: POST_ID, reason: 'abuse' }),
        )
      ).status,
    ).toBe(404);
  });

  it('잘못된 사유·대상은 DB 에 보내지 않음, DB 오류는 일반 문구', async () => {
    expect(
      (
        await report(
          req({ target_type: 'post', target_id: POST_ID, reason: 'spam' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await report(
          req({ target_type: 'user', target_id: POST_ID, reason: 'abuse' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await report(
          req({ target_type: 'post', target_id: 'x', reason: 'abuse' }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.rpcCalls).toEqual([]);

    mocks.rpcError = {
      code: '42883',
      message: 'function public.report_board_content does not exist',
    };
    const res = await report(
      req({ target_type: 'post', target_id: POST_ID, reason: 'abuse' }),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('report_board_content');
    expect(mocks.captured).toHaveLength(1);

    mocks.user = null;
    expect(
      (
        await report(
          req({ target_type: 'post', target_id: POST_ID, reason: 'abuse' }),
        )
      ).status,
    ).toBe(401);
  });
});

describe('제한 모드 (P3-15): 만 14세 미만 + 보호자 동의 전', () => {
  const pending = {
    age_band: 'under14',
    guardian_consented_at: null,
    consent_deadline: '2026-12-06T00:00:00Z',
  };

  it('글·고치기·댓글은 403 guardian_consent, DB 에 쓰지 않음', async () => {
    mocks.rows.users = pending;
    mocks.rows.board_posts = { id: POST_ID, user_id: U1, is_hidden: false };
    const responses = [
      await createPost(req({ title: '질문', content: '내용' })),
      await patchPost(req({ title: '고침' }, 'PATCH'), postParams()),
      await createComment(req({ post_id: POST_ID, content: '댓글' })),
    ];
    for (const res of responses) {
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('guardian_consent');
      expect(json.error).toContain('보호자');
    }
    expect(writes()).toEqual([]);
    expect(mocks.rpcCalls).toEqual([]);
  });

  it('신고는 제한 모드에서도 받음 (공개되지 않고, 해로운 글을 알릴 수 있어야 함)', async () => {
    mocks.rows.users = pending;
    mocks.rpcResult = { result: 'reported', hidden: false };
    const res = await report(
      req({ target_type: 'post', target_id: POST_ID, reason: 'abuse' }),
    );
    expect(res.status).toBe(200);
    expect(mocks.rpcCalls.map((c) => c.fn)).toContain('report_board_content');
  });

  it('내 글 지우기는 제한 모드에서도 됨 (개인정보를 지울 수 있게)', async () => {
    mocks.rows.users = pending;
    mocks.rows.board_posts = { id: POST_ID, user_id: U1, is_hidden: false };
    const res = await deletePost(req(undefined, 'DELETE'), postParams());
    expect(res.status).toBe(200);
  });

  it('나이 확인 결과가 없어도 제한(안전한 쪽), 만 14세 이상·동의 마침은 그대로', async () => {
    mocks.rows.users = {
      age_band: null,
      guardian_consented_at: null,
      consent_deadline: null,
    };
    expect(
      (await createPost(req({ title: '질문', content: '내용' }))).status,
    ).toBe(403);
    mocks.rows.users = {
      age_band: 'under14',
      guardian_consented_at: '2026-11-06T00:00:00Z',
      consent_deadline: null,
    };
    expect(
      (await createPost(req({ title: '질문', content: '내용' }))).status,
    ).toBe(200);
  });
});
