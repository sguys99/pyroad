import 'server-only';

import { NextResponse } from 'next/server';
import { reportServerError } from '@/lib/api/serverError';

/**
 * 공지 API 공용 (B36).
 *
 * - 목록 조회는 누구나(아이 포함) 보므로 아이용 문구, 쓰기·수정·삭제는 관리자만 쓰므로 관리자용 문구.
 * - DB `error.message` 는 응답에 넣지 않고 `[notice] <op> 실패:` 로그 + Sentry 로만 (B19 와 같은 방식).
 */

export const NOTICE_MESSAGES = {
  unauthorized: '로그인이 필요해요.',
  forbidden: '권한이 없습니다.',
  badRequest:
    '요청 형식이 올바르지 않습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.',
  notFound: '공지사항을 찾을 수 없습니다.',
  titleContentRequired: '제목과 내용을 모두 입력해주세요.',
  /** 공개 목록 (아이도 봄) */
  listFailed: '공지사항을 불러오지 못했어요. 잠시 뒤에 다시 해 볼까요?',
  /** 관리자 화면 */
  saveFailed:
    '공지사항을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요. 계속되면 서버 로그의 [notice] 항목을 확인하세요.',
  deleteFailed:
    '공지사항을 삭제하지 못했습니다. 잠시 뒤 다시 시도해 주세요. 계속되면 서버 로그의 [notice] 항목을 확인하세요.',
} as const;

export function noticeError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/** DB·서버 오류: 로그 + Sentry, 응답은 일반 문구 (B36) */
export function noticeServerError(
  error: unknown,
  op: string,
  message: string = NOTICE_MESSAGES.saveFailed,
) {
  reportServerError(error, { area: 'notice', op });
  return noticeError(500, message);
}
