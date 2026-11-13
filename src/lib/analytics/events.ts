/**
 * 분석 이벤트 이름·속성 (P1-17, §12-Q22). 설계와 §1 지표 연결: docs/analytics.md
 *
 * 브라우저 번들에도 들어가므로 zod 같은 의존성 없이 타입·상수만 둔다 (검증 스키마는 `schema.ts`, 서버 전용).
 * 속성에는 자유 문자열을 두지 않는다: enum·UUID·정수·불리언만 (아동 개인정보 §2.6). 이름·이메일·코드·출력은 넣지 않는다.
 */
import type { SocialProvider } from '@/lib/auth/socialLogin';
import type { SkinId } from '@/lib/avatar/skins';
import type { MiniErrorKind } from '@/lib/landing/miniPython/errors';
import type { QuizKind } from '@/lib/content/schema';
import type { ShopKind } from '@/lib/shop/catalog';
import type { ShareCardKind } from '@/lib/share-card/types';
import type { ShareChannel } from '@/lib/share-card/share';
import type {
  MotionTier,
  MotionTierSetting,
  ReducedMotionSetting,
} from '@/lib/motion/tier';

export interface AnalyticsEventProps {
  /** 랜딩 화면을 봄 (전환율 분모) */
  landing_view: Record<string, never>;
  /** 랜딩의 로그인 버튼을 누름. cta: 어느 버튼인지 (trial = 30초 체험 성공 뒤 "모험을 저장하려면 로그인!", P4-03) */
  landing_cta_click: {
    cta: 'hero' | 'header' | 'trial';
    provider: SocialProvider;
    /** 공용 기기 체크를 켜고 골랐나 (P4-09, §12-Q44). 예전 번들은 보내지 않음 */
    shared?: boolean;
  };
  /** 랜딩 30초 체험 공책을 처음 만짐 (글자를 고치거나 주문을 걺, 페이지당 1번, P4-03) */
  trial_start: Record<string, never>;
  /**
   * 체험 공책에서 주문을 걺 (P4-03). result: ok(찍힘) · no_print(print 없이 식만) · 오류 종류(`MINI_ERROR_KINDS`).
   * 아이가 쓴 코드·출력은 보내지 않는다
   */
  trial_run: { result: TrialRunResult };
  /** 체험 공책에서 처음 성공함 (페이지당 1번, P4-03). runs: 몇 번째 주문에서 (1~99) */
  trial_success: { runs: number };
  /** 로그인 성공 (`/auth/callback`, 서버). new_user: 이번이 가입 */
  login_success: { provider: SocialProvider | 'unknown'; new_user: boolean };
  /**
   * 첫 로그인 온보딩을 마침 (P3-11, `/api/onboarding`, 서버). 사용자당 1번(dedupe).
   * skin: 고른 파이뱀 색(6종 id), grade_given: 학년을 골랐는지 (학년 값·닉네임은 보내지 않음),
   * returning: 온보딩 전에 학습한 기존 사용자였는지 (P3-12, 서버가 경험치·진행 행으로 판별)
   */
  onboarding_complete: {
    skin: SkinId;
    grade_given: boolean;
    returning: boolean;
  };
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
  /**
   * 연출 단계가 바뀜 (P2-15, 브라우저). cause: measured = 실측 자동 하향, user = 설정에서 바꿈.
   * setting·reduced: 그때의 움직임·동작 줄이기 설정, elapsed_s: 페이지를 연 뒤 몇 초 만에 (자동 하향 정착 시간, P12-04 임계값 조정용)
   */
  motion_tier_change: {
    from: MotionTier;
    to: MotionTier;
    cause: 'measured' | 'user';
    setting: MotionTierSetting;
    reduced: ReducedMotionSetting;
    elapsed_s: number;
  };
  /**
   * "홈 화면에 추가" 안내를 씀 (P4-11, 브라우저). via: 월드맵 쪽지·설정 화면, platform: 안드로이드 설치 창·iOS 그림 안내,
   * result: accepted·dismissed = 안드로이드 설치 창에서 고른 것, guide = iOS 안내를 엶 (iOS는 실제로 추가했는지 알 수 없음)
   */
  pwa_install_prompt: {
    via: 'world' | 'settings';
    platform: 'android' | 'ios';
    result: 'accepted' | 'dismissed' | 'guide';
  };
  /** 브라우저가 앱 설치를 알림 (`appinstalled`, Chromium만. P4-11) */
  pwa_installed: Record<string, never>;
  /**
   * 월드맵 이어하기 CTA를 누름 (P5-10, 브라우저). kind: recent(하다 만 퀘스트)·next(다음 차례)·start(진행 0, 모험 시작하기),
   * place: head(지도 머리)·float(모바일 아래 떠 있는 버튼). 실제 퀘스트 진입은 서버 quest_start 로 센다
   */
  continue_click: {
    kind: 'recent' | 'next' | 'start';
    place: 'head' | 'float';
  };
  /**
   * 퀴즈를 맞힌 뒤(또는 정답 공개 뒤) "직접 실행해 보기" 칸에서 코드를 돌림 (P7-07, 브라우저). kind: 퀴즈 종류,
   * edited: 처음 코드에서 바꿔 돌렸는지. 코드·출력·퀘스트 id는 보내지 않는다 (채점·보상과 무관한 놀이)
   */
  quiz_try_run: { kind: QuizKind; edited: boolean };
  /**
   * 폰 퀴즈 추천 (P7-11, 브라우저). place: world(월드맵 이어하기 아래 쪽지)·quest(코드 퀘스트 첫 진입 쪽지),
   * action: show(보임, 화면에 들어올 때 1번)·click(퀴즈로 감). 퀘스트 id·제목은 보내지 않는다
   */
  phone_quiz_pick: { place: 'world' | 'quest'; action: 'show' | 'click' };
  /**
   * 오늘의 퀴즈 화면(`/daily`)을 엶 (P7-10, 브라우저). total: 오늘 문제 수(0~3), done: 이미 끝낸 수. 퀘스트 id 는 보내지 않는다
   */
  daily_quiz_open: { total: number; done: number };
  /** 오늘의 퀴즈 마지막 문제를 이 화면에서 끝냄 (P7-10, 브라우저). correct: 맞힌 수, stars: 오늘 받은 별 합 */
  daily_quiz_finish: { correct: number; stars: number };
  /**
   * 휴식 알림을 띄움 (P8-12, 브라우저). snoozed: 앞서 "조금만 더"를 고른 뒤 다시 뜬 것인지 (60분·80분…)
   */
  rest_reminder_shown: { snoozed: boolean };
  /**
   * 휴식 알림에서 고름 (P8-12, 브라우저). rest: 5분 쉬기 · more: 조금만 더(Esc·덮개 포함) · done: 5분을 다 쉼 · stop: 쉬다가 일찍 돌아감
   */
  rest_reminder_choice: { choice: 'rest' | 'more' | 'done' | 'stop' };
  /**
   * 상점에서 샀음 (P9-03, `/api/shop/purchase`, 서버). item_id: 카탈로그 id(`SHOP_ITEMS`, 개인정보 아님), kind: 종류,
   * price: 그때 가격(150~1,500). 경제 밸런스(무엇을 언제 사나) 조정용, 잔액은 보내지 않음
   */
  shop_purchase: { item_id: string; kind: ShopKind; price: number };
  /**
   * 공유 페이지 `/share/[cardId]`를 엶 (P9-08, 브라우저, 비로그인 포함). kind: 카드 종류, gone = 없음·비공개·만료.
   * 카드 id·닉네임은 보내지 않는다 (경로의 id도 `normalizePath`가 `[id]`로 지움)
   */
  share_view: { kind: ShareViewKind };
  /** 공유 페이지의 "나도 해보기"를 누름 (P9-08, 브라우저). 공유 → 방문 → 가입 퍼널 분자 */
  share_cta_click: { kind: ShareViewKind };
  /** 공유 시트를 엶 (P9-09, 브라우저, 로그인). kind: 카드 종류. 카드 id 는 보내지 않는다 */
  share_open: { kind: ShareCardKind };
  /**
   * 공유 시트에서 채널을 씀 (P9-09, 브라우저). channel: kakao(메시지 창을 띄움) · web_share(기기 공유를 마침) ·
   * save_image(저장을 시작함) · copy_link(복사함). 받는 사람·카드 id 는 보내지 않는다
   */
  share_channel: { kind: ShareCardKind; channel: ShareChannel };
  /**
   * 내 자랑 카드를 숨김·다시 공개·지움 (P9-11, 서버 `PATCH·DELETE /api/share-cards/{id}`). 카드 id·닉네임은 보내지 않는다
   */
  share_manage: { kind: ShareCardKind; action: ShareManageAction };
  /**
   * "파이뱀에게 물어보기" 자유 질문 결과 (P9-17, 서버 `/api/tutor`). 질문·답 내용·거른 규칙은 보내지 않는다(결과 갈래만).
   * answered = AI 답 · fallback = AI 실패로 저장된 답변 · blocked = 질문을 거름 · answer_blocked = 답을 거르고 저장된 답변
   */
  tutor_free_question: { result: TutorFreeQuestionResult };
}

/** `tutor_free_question.result` 값 (P9-17) */
export type TutorFreeQuestionResult =
  | 'answered'
  | 'fallback'
  | 'blocked'
  | 'answer_blocked';

/** `share_manage.action` 값 (P9-11) */
export type ShareManageAction = 'hide' | 'show' | 'delete';

export type AnalyticsEventName = keyof AnalyticsEventProps;

/** `trial_run.result` 값 */
export type TrialRunResult = 'ok' | 'no_print' | MiniErrorKind;

/** `share_view`·`share_cta_click.kind` 값 */
export type ShareViewKind = ShareCardKind | 'gone';

/** 브라우저가 `/api/analytics`로 보낼 수 있는 이벤트. 나머지는 서버만 기록한다 (클라이언트가 지표를 부풀리지 못하게) */
export const CLIENT_EVENT_NAMES = [
  'continue_click',
  'daily_quiz_finish',
  'daily_quiz_open',
  'landing_view',
  'landing_cta_click',
  'motion_tier_change',
  'phone_quiz_pick',
  'pwa_install_prompt',
  'pwa_installed',
  'quiz_try_run',
  'rest_reminder_choice',
  'rest_reminder_shown',
  'share_channel',
  'share_cta_click',
  'share_open',
  'share_view',
  'trial_start',
  'trial_run',
  'trial_success',
] as const;
export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

export const SERVER_EVENT_NAMES = [
  'login_success',
  'onboarding_complete',
  'quest_start',
  'quest_complete',
  'hint_used',
  'shop_purchase',
  'tutor_free_question',
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
      // 22자 base64url = 공유 카드 id(P9-08) 같은 링크 토큰
      if (UUID_SEGMENT_RE.test(seg) || ANON_ID_RE.test(seg)) return '[id]';
      if (TEMPLATE_SEGMENT_RE.test(seg)) return seg;
      if (seg.length > 40 || !SAFE_SEGMENT_RE.test(seg)) return '[x]';
      return seg;
    });
  const path = `/${segments.join('/')}`;
  return path.length > MAX_PATH_LENGTH ? path.slice(0, MAX_PATH_LENGTH) : path;
}
