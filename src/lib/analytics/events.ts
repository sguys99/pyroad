/**
 * 분석 이벤트 이름·속성 (P1-17, §12-Q22). 설계와 §1 지표 연결: docs/analytics.md
 *
 * 브라우저 번들에도 들어가므로 zod 같은 의존성 없이 타입·상수만 둔다 (검증 스키마는 `schema.ts`, 서버 전용).
 * 속성에는 자유 문자열을 두지 않는다: enum·UUID·정수·불리언만 (아동 개인정보 §2.6). 이름·이메일·코드·출력은 넣지 않는다.
 */
import type { SocialProvider } from '@/lib/auth/socialLogin';

export interface AnalyticsEventProps {
  /** 랜딩 화면을 봄 (전환율 분모) */
  landing_view: Record<string, never>;
  /** 랜딩의 로그인 버튼을 누름. cta: 어느 버튼인지 */
  landing_cta_click: { cta: 'hero' | 'header'; provider: SocialProvider };
  /** 로그인 성공 (`/auth/callback`, 서버). new_user: 이번이 가입 */
  login_success: { provider: SocialProvider | 'unknown'; new_user: boolean };
  /** 퀘스트에 처음 들어옴 (퀘스트마다 사용자당 1번, 서버) */
  quest_start: { quest_id: string };
  /** 퀘스트를 처음 완료함 (퀘스트마다 사용자당 1번, 완료 API·서버) */
  quest_complete: {
    quest_id: string;
    hints_used: number;
    used_golden_key: boolean;
    level_up: boolean;
    stage_cleared: boolean;
  };
  /** 힌트를 받음 (튜터가 힌트 내용을 보내기 시작할 때, 서버) */
  hint_used: { quest_id: string; level: 1 | 2 | 3 };
}

export type AnalyticsEventName = keyof AnalyticsEventProps;

/** 브라우저가 `/api/analytics`로 보낼 수 있는 이벤트. 나머지는 서버만 기록한다 (클라이언트가 지표를 부풀리지 못하게) */
export const CLIENT_EVENT_NAMES = [
  'landing_view',
  'landing_cta_click',
] as const;
export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

export const SERVER_EVENT_NAMES = [
  'login_success',
  'quest_start',
  'quest_complete',
  'hint_used',
] as const;
export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];

export const ANALYTICS_ENDPOINT = '/api/analytics';

/** 한 요청에 담는 최대 이벤트 수 */
export const MAX_BATCH_EVENTS = 10;

/** 요청 본문 상한 (바이트). 이벤트 10개면 1KB 안팎 */
export const MAX_BATCH_BYTES = 8 * 1024;

/** 익명 ID 형식: base64url 22자 (128비트 난수 또는 HMAC 앞부분). DB CHECK 와 같음 (00017) */
export const ANON_ID_RE = /^[A-Za-z0-9_-]{22}$/;

/** 저장하는 경로 길이 상한 (DB CHECK 100자) */
const MAX_PATH_LENGTH = 100;
const UUID_SEGMENT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT_RE = /^[A-Za-z0-9_.-]+$/;
/** 이미 템플릿인 조각 (서버 이벤트가 넘기는 '/quest/[id]') */
const TEMPLATE_SEGMENT_RE = /^\[[a-z]{1,10}\]$/;

/**
 * 경로를 저장용 템플릿으로 줄인다: 쿼리·해시를 버리고, UUID 조각은 `[id]`, 그 밖에 이상한 조각은 `[x]`로.
 * (`/auth/callback?code=…`의 code, 공유 링크 토큰 같은 값이 남지 않게)
 */
export function normalizePath(input: string | null | undefined): string | null {
  if (typeof input !== 'string' || !input.startsWith('/')) return null;
  const pathname = input.split(/[?#]/, 1)[0];
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (UUID_SEGMENT_RE.test(seg)) return '[id]';
      if (TEMPLATE_SEGMENT_RE.test(seg)) return seg;
      if (seg.length > 40 || !SAFE_SEGMENT_RE.test(seg)) return '[x]';
      return seg;
    });
  const path = `/${segments.join('/')}`;
  return path.length > MAX_PATH_LENGTH ? path.slice(0, MAX_PATH_LENGTH) : path;
}
