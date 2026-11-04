/**
 * 게시판 한도·신고 사유 (P1-18, B19). 클라이언트·서버가 함께 씀.
 *
 * 글자 수는 코드 포인트 기준(charCount)으로, DB CHECK(00014 의 char_length)와 같습니다.
 * 바꾸면 supabase/migrations 에 CHECK 를 다시 만드는 새 마이그레이션을 함께 추가합니다.
 */
export const BOARD_LIMITS = {
  title: 100,
  content: 2000,
  comment: 500,
} as const;

/** 서로 다른 신고자가 이 수 이상이면 자동 숨김. DB report_board_content 의 c_hide_threshold 와 같아야 함 */
export const REPORT_HIDE_THRESHOLD = 3;

export const REPORT_REASONS = [
  'abuse',
  'personal_info',
  'bullying',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<
  ReportReason,
  { label: string; hint: string }
> = {
  abuse: { label: '욕설이나 나쁜 말', hint: '욕이나 기분 나쁜 말이 있어요' },
  personal_info: {
    label: '개인정보',
    hint: '전화번호, 주소, 학교 같은 정보가 있어요',
  },
  bullying: { label: '괴롭힘·놀림', hint: '누군가를 놀리거나 괴롭혀요' },
  other: { label: '기타', hint: '그 밖에 이상한 점이 있어요' },
};

export type ReportTargetType = 'post' | 'comment';

/** 코드 포인트 수 (이모지 하나 = 1자). DB char_length 와 같음 */
export function charCount(text: string): number {
  return Array.from(text).length;
}
