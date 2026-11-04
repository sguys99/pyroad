import 'server-only';

import { NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/server';
import { MODERATION_MESSAGES, moderateFields } from '@/lib/moderation/filter';
import { hasVisibleText } from '@/lib/moderation/normalize';
import { BOARD_LIMITS, charCount } from './limits';

/**
 * 게시판 API 공용 (P1-18, B19).
 *
 * - 응답 문구는 아이용 쉬운 말. DB `error.message`(제약 이름·SQL·글 내용이 들어 있음)는 응답에 넣지 않고
 *   서버 로그와 Sentry 로만 보냄 (`boardServerError`).
 * - 글·댓글 쓰기는 이 검사(길이·빈 값·금칙어)를 통과한 뒤 service_role 로만 함. 클라이언트 직접 쓰기는 ③ 00015 가 막음.
 */

export const BOARD_MESSAGES = {
  unauthorized: '로그인이 필요해요.',
  badRequest:
    '보낸 내용을 이해하지 못했어요. 화면을 새로 고치고 다시 해 볼까요?',
  postNotFound: '글을 찾을 수 없어요. 지워졌거나 숨겨졌을 수 있어요.',
  commentNotFound: '댓글을 찾을 수 없어요. 지워졌거나 숨겨졌을 수 있어요.',
  notPostOwner: '내가 쓴 글만 고치거나 지울 수 있어요.',
  notCommentOwner: '내가 쓴 댓글만 지울 수 있어요.',
  titleContentRequired: '제목과 내용을 모두 써 주세요.',
  titleTooLong: `제목은 ${BOARD_LIMITS.title}자까지 쓸 수 있어요.`,
  contentTooLong: `내용은 ${BOARD_LIMITS.content}자까지 쓸 수 있어요.`,
  commentRequired: '댓글 내용을 써 주세요.',
  commentTooLong: `댓글은 ${BOARD_LIMITS.comment}자까지 쓸 수 있어요.`,
  serverError: '앗, 지금은 저장하지 못했어요. 잠시 뒤에 다시 해 볼까요?',
  reportReasonRequired: '신고하는 까닭을 골라 주세요.',
  reportOwn: '내가 쓴 글은 신고할 수 없어요.',
  reportAlready: '이미 신고했어요. 어른이 살펴볼게요.',
  reportDone: '알려 줘서 고마워요! 어른이 살펴볼게요.',
} as const;

export type BoardErrorCode =
  | 'moderation'
  | 'validation'
  | 'not_found'
  | 'forbidden'
  | 'server';

export function boardError(
  status: number,
  error: string,
  extra: { code?: BoardErrorCode; field?: string } = {},
) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** PostgREST 오류 등에서 코드·메시지만 (details 에는 실패한 행 = 아이가 쓴 글이 들어 있어 남기지 않음) */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown };
    return `${typeof e.code === 'string' ? e.code : ''} ${typeof e.message === 'string' ? e.message : ''}`.trim();
  }
  return String(error);
}

/** DB·서버 오류: 로그 + Sentry, 응답은 일반 문구 (B19) */
export function boardServerError(error: unknown, op: string) {
  const message = describe(error);
  console.error(`[board] ${op} 실패:`, message);
  captureServerError(
    error instanceof Error ? error : new Error(`[board] ${op}: ${message}`),
    {
      tags: { area: 'board', op },
    },
  );
  return boardError(500, BOARD_MESSAGES.serverError, { code: 'server' });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 경로·본문의 id 모양 검사. 아니면 DB 에 보내지 않음 (잘못된 uuid 는 22P02 오류가 되므로) */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** JSON 본문 (객체가 아니면 null) */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** 앞뒤 공백을 지우고, 보이지 않는 글자만 있으면 빈 값으로 */
function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return hasVisibleText(trimmed) ? trimmed : '';
}

type Checked<T> =
  | { ok: true; value: T }
  | { ok: false; response: NextResponse };

function moderationFailure(
  fields: Record<string, string | undefined>,
): NextResponse | null {
  const m = moderateFields(fields);
  if (m.ok) return null;
  return boardError(400, MODERATION_MESSAGES[m.category], {
    code: 'moderation',
    field: m.field,
  });
}

/**
 * 글 입력 검사. partial(수정)이면 보낸 칸만 검사.
 * 순서: 빈 값 → 길이 → 금칙어 (빈 값·길이는 DB CHECK 와 같은 규칙)
 */
export function checkPostInput(
  body: Record<string, unknown>,
  { partial = false }: { partial?: boolean } = {},
): Checked<{ title?: string; content?: string }> {
  const title = clean(body.title);
  const content = clean(body.content);
  const fail = (
    error: string,
    field: string,
    code: BoardErrorCode = 'validation',
  ) => ({
    ok: false as const,
    response: boardError(400, error, { code, field }),
  });

  if (partial) {
    if (title === undefined && content === undefined)
      return fail(BOARD_MESSAGES.badRequest, 'body');
    if (title === '') return fail(BOARD_MESSAGES.titleContentRequired, 'title');
    if (content === '')
      return fail(BOARD_MESSAGES.titleContentRequired, 'content');
  } else {
    if (!title) return fail(BOARD_MESSAGES.titleContentRequired, 'title');
    if (!content) return fail(BOARD_MESSAGES.titleContentRequired, 'content');
  }
  if (title !== undefined && charCount(title) > BOARD_LIMITS.title) {
    return fail(BOARD_MESSAGES.titleTooLong, 'title');
  }
  if (content !== undefined && charCount(content) > BOARD_LIMITS.content) {
    return fail(BOARD_MESSAGES.contentTooLong, 'content');
  }
  const blocked = moderationFailure({ title, content });
  if (blocked) return { ok: false, response: blocked };

  const value: { title?: string; content?: string } = {};
  if (title !== undefined) value.title = title;
  if (content !== undefined) value.content = content;
  return { ok: true, value };
}

export function checkCommentInput(
  body: Record<string, unknown>,
): Checked<{ postId: string; content: string }> {
  if (!isUuid(body.post_id)) {
    return {
      ok: false,
      response: boardError(400, BOARD_MESSAGES.badRequest, {
        code: 'validation',
      }),
    };
  }
  const content = clean(body.content);
  if (!content) {
    return {
      ok: false,
      response: boardError(400, BOARD_MESSAGES.commentRequired, {
        code: 'validation',
        field: 'content',
      }),
    };
  }
  if (charCount(content) > BOARD_LIMITS.comment) {
    return {
      ok: false,
      response: boardError(400, BOARD_MESSAGES.commentTooLong, {
        code: 'validation',
        field: 'content',
      }),
    };
  }
  const blocked = moderationFailure({ content });
  if (blocked) return { ok: false, response: blocked };
  return { ok: true, value: { postId: body.post_id, content } };
}
