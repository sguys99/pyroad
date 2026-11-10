import 'server-only';

import { createHash } from 'node:crypto';
import { captureServerMessage } from '@/lib/observability/server';

/**
 * 튜터 API 비정상 요청 기록 (P1-19).
 *
 * 우리 클라이언트(`useTutor`)가 보내지 않는 요청(형식 오류·없는 퀘스트·너무 큰 본문)과 한도 초과를 구조화 로그 한 줄로 남긴다.
 * 학생 코드·출력·질문 내용은 넣지 않는다(§2.6). 사용자는 id 대신 해시(앞 16자)로 로그에만 남긴다.
 * Sentry 에는 사용자 정보를 보내지 않는다는 P1-16 원칙대로 해시도 보내지 않는다(사유·유형만). 운영에서 사용자를 찾아야 하면
 * Vercel 로그의 해시로 런북 "튜터 한도·남용 기록"의 SQL 을 써서 id 를 찾는다.
 *
 * 수준
 * - info: 로그만. 정상 사용에서도 가끔 생길 수 있는 것 (한도 1~2번 초과, 긴 입력 자르기)
 * - warning: 로그 + Sentry 메시지. 우리 클라이언트로는 생기지 않는 요청(잠긴 스테이지의 퀘스트 포함 — 퀘스트 화면이 열지 않음, B38),
 *   짧은 시간 반복 초과
 *   Sentry 는 사유별로 한 이슈(fingerprint)로 묶이고 같은 사유는 인스턴스마다 10분에 3번까지만 보낸다(P1-16 beforeSend)
 */
export type TutorAbuseReason =
  | 'invalid_json'
  | 'body_too_large'
  | 'invalid_type'
  | 'missing_quest_id'
  | 'invalid_hint_level'
  | 'missing_execution_result'
  | 'input_too_long'
  | 'quest_not_found'
  | 'stage_locked'
  | 'rate_limited'
  /** quiz_explain 인데 이 퀴즈에 틀린 제출 기록이 없음 (P7-08) */
  | 'no_wrong_attempt';

export type TutorAbuseLevel = 'info' | 'warning';

export interface TutorAbuseEvent {
  userId: string;
  reason: TutorAbuseReason;
  level: TutorAbuseLevel;
  /** 요청 유형. 알려진 값이 아니면 'unknown'으로 남긴다 (클라이언트가 보낸 문자열을 그대로 쓰지 않음) */
  type?: string;
  /** 짧은 값만 (필드 이름·길이·횟수·퀘스트 id). 학생이 쓴 내용은 넣지 말 것 */
  detail?: Record<string, string | number | boolean>;
}

const KNOWN_TYPES = new Set([
  'quest_intro',
  'hint_generator',
  'code_feedback',
  'encouragement',
  'project_guide',
  'stage_summary',
  'concept_explain',
  'quiz_explain',
]);

/** 로그용 사용자 해시: sha256(user id) 앞 16자 (가명. 로그에 id 를 그대로 남기지 않음) */
export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 퀘스트 id 는 공개 콘텐츠 id 라 남겨도 되지만, UUID 가 아니면(클라이언트가 만든 문자열) 남기지 않는다 */
export function safeQuestId(value: unknown): string {
  return typeof value === 'string' && UUID_RE.test(value) ? value : 'invalid';
}

export function reportTutorAbuse(event: TutorAbuseEvent): void {
  const kind =
    event.type === undefined
      ? undefined
      : KNOWN_TYPES.has(event.type)
        ? event.type
        : 'unknown';
  const user = hashUserId(event.userId);
  const line = {
    event: 'tutor_abuse',
    level: event.level,
    reason: event.reason,
    ...(kind && { kind }),
    user,
    ...event.detail,
  };
  // Vercel 로그에서 `[tutor-abuse]`로 찾는다
  if (event.level === 'warning')
    console.warn('[tutor-abuse]', JSON.stringify(line));
  else console.info('[tutor-abuse]', JSON.stringify(line));

  if (event.level !== 'warning') return;
  captureServerMessage(`tutor abuse: ${event.reason}`, 'warning', {
    tags: { area: 'tutor', reason: event.reason, ...(kind && { kind }) },
    extra: event.detail,
    fingerprint: ['tutor-abuse', event.reason],
  });
}
