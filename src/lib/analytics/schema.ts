import { z } from 'zod';
import { SKIN_IDS } from '@/lib/avatar/skins';
import { MINI_ERROR_KINDS } from '@/lib/landing/miniPython/errors';
import { SHOP_ITEMS, SHOP_KINDS } from '@/lib/shop/catalog';
import {
  ANON_ID_RE,
  CLIENT_EVENT_NAMES,
  MAX_BATCH_EVENTS,
  type AnalyticsEventName,
  type AnalyticsEventProps,
} from './events';

/**
 * 분석 이벤트 검증 스키마 (P1-17). 서버(`/api/analytics`, `server.ts`)에서만 쓴다 — 브라우저 번들에 zod 를 넣지 않음.
 *
 * 모든 객체는 `.strict()`: 정해 둔 키 밖의 값(email·name·user_id·code 같은 개인정보나 학생 내용)이 오면 통째로 거부한다.
 * 속성 값은 enum·UUID·범위가 정해진 정수·불리언뿐이라 자유 문자열이 들어갈 자리가 없다.
 */
const provider = z.enum(['google', 'kakao', 'naver']);
const questId = z.string().uuid();
const motionTier = z.enum(['full', 'lite', 'minimal']);
const SHARE_CARD_KIND = z.enum(['levelup', 'stage', 'achievement', 'weekly']);
const SHARE_VIEW_KIND = z.enum([
  'levelup',
  'stage',
  'achievement',
  'weekly',
  'gone',
]);

export const EVENT_PROPS_SCHEMA = {
  landing_view: z.object({}).strict(),
  landing_cta_click: z
    .object({
      cta: z.enum(['hero', 'header', 'trial']),
      provider,
      // 공용 기기 체크 (P4-09). 선택: 배포 전 번들이 보낸 이벤트도 받는다
      shared: z.boolean().optional(),
    })
    .strict(),
  trial_start: z.object({}).strict(),
  trial_run: z
    .object({ result: z.enum(['ok', 'no_print', ...MINI_ERROR_KINDS]) })
    .strict(),
  trial_success: z.object({ runs: z.number().int().min(1).max(99) }).strict(),
  login_success: z
    .object({
      provider: z.enum(['google', 'kakao', 'naver', 'unknown']),
      new_user: z.boolean(),
    })
    .strict(),
  onboarding_complete: z
    .object({
      skin: z.enum(SKIN_IDS),
      grade_given: z.boolean(),
      returning: z.boolean(),
    })
    .strict(),
  quest_start: z.object({ quest_id: questId }).strict(),
  quest_complete: z
    .object({
      quest_id: questId,
      hints_used: z.number().int().min(0).max(99),
      used_golden_key: z.boolean(),
      level_up: z.boolean(),
      stage_cleared: z.boolean(),
    })
    .strict(),
  hint_used: z
    .object({
      quest_id: questId,
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    })
    .strict(),
  motion_tier_change: z
    .object({
      from: motionTier,
      to: motionTier,
      cause: z.enum(['measured', 'user']),
      setting: z.enum(['auto', 'full', 'lite', 'minimal']),
      reduced: z.enum(['system', 'on', 'off']),
      elapsed_s: z.number().int().min(0).max(86_400),
    })
    .strict(),
  pwa_install_prompt: z
    .object({
      via: z.enum(['world', 'settings']),
      platform: z.enum(['android', 'ios']),
      result: z.enum(['accepted', 'dismissed', 'guide']),
    })
    .strict(),
  pwa_installed: z.object({}).strict(),
  continue_click: z
    .object({
      kind: z.enum(['recent', 'next', 'start']),
      place: z.enum(['head', 'float']),
    })
    .strict(),
  quiz_try_run: z
    .object({
      kind: z.enum(['multiple_choice', 'fill_blank', 'parsons', 'bug_hunt']),
      edited: z.boolean(),
    })
    .strict(),
  phone_quiz_pick: z
    .object({
      place: z.enum(['world', 'quest']),
      action: z.enum(['show', 'click']),
    })
    .strict(),
  daily_quiz_open: z
    .object({
      total: z.number().int().min(0).max(3),
      done: z.number().int().min(0).max(3),
    })
    .strict(),
  daily_quiz_finish: z
    .object({
      correct: z.number().int().min(0).max(3),
      stars: z.number().int().min(0).max(9),
    })
    .strict(),
  rest_reminder_shown: z.object({ snoozed: z.boolean() }).strict(),
  rest_reminder_choice: z
    .object({ choice: z.enum(['rest', 'more', 'done', 'stop']) })
    .strict(),
  shop_purchase: z
    .object({
      item_id: z.enum(SHOP_ITEMS.map((i) => i.id) as [string, ...string[]]),
      kind: z.enum(SHOP_KINDS),
      price: z.number().int().min(1).max(10000),
    })
    .strict(),
  share_view: z.object({ kind: SHARE_VIEW_KIND }).strict(),
  share_cta_click: z.object({ kind: SHARE_VIEW_KIND }).strict(),
  share_open: z.object({ kind: SHARE_CARD_KIND }).strict(),
  share_channel: z
    .object({
      kind: SHARE_CARD_KIND,
      channel: z.enum(['kakao', 'web_share', 'save_image', 'copy_link']),
    })
    .strict(),
  share_manage: z
    .object({
      kind: SHARE_CARD_KIND,
      action: z.enum(['hide', 'show', 'delete']),
    })
    .strict(),
} satisfies {
  [K in AnalyticsEventName]: z.ZodType<AnalyticsEventProps[K]>;
};

/** 브라우저가 보낸 이벤트 1건. path 는 서버가 다시 `normalizePath`로 줄인다 */
const clientEvent = z.discriminatedUnion('name', [
  z
    .object({
      name: z.literal('landing_view'),
      props: EVENT_PROPS_SCHEMA.landing_view.default({}),
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('landing_cta_click'),
      props: EVENT_PROPS_SCHEMA.landing_cta_click,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('motion_tier_change'),
      props: EVENT_PROPS_SCHEMA.motion_tier_change,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('pwa_install_prompt'),
      props: EVENT_PROPS_SCHEMA.pwa_install_prompt,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('pwa_installed'),
      props: EVENT_PROPS_SCHEMA.pwa_installed.default({}),
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('continue_click'),
      props: EVENT_PROPS_SCHEMA.continue_click,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('quiz_try_run'),
      props: EVENT_PROPS_SCHEMA.quiz_try_run,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('phone_quiz_pick'),
      props: EVENT_PROPS_SCHEMA.phone_quiz_pick,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('daily_quiz_open'),
      props: EVENT_PROPS_SCHEMA.daily_quiz_open,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('daily_quiz_finish'),
      props: EVENT_PROPS_SCHEMA.daily_quiz_finish,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('rest_reminder_shown'),
      props: EVENT_PROPS_SCHEMA.rest_reminder_shown,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('rest_reminder_choice'),
      props: EVENT_PROPS_SCHEMA.rest_reminder_choice,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('trial_start'),
      props: EVENT_PROPS_SCHEMA.trial_start.default({}),
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('trial_run'),
      props: EVENT_PROPS_SCHEMA.trial_run,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('trial_success'),
      props: EVENT_PROPS_SCHEMA.trial_success,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('share_view'),
      props: EVENT_PROPS_SCHEMA.share_view,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('share_cta_click'),
      props: EVENT_PROPS_SCHEMA.share_cta_click,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('share_open'),
      props: EVENT_PROPS_SCHEMA.share_open,
      path: z.string().max(200).optional(),
    })
    .strict(),
  z
    .object({
      name: z.literal('share_channel'),
      props: EVENT_PROPS_SCHEMA.share_channel,
      path: z.string().max(200).optional(),
    })
    .strict(),
]);

// 스키마가 CLIENT_EVENT_NAMES 를 모두 다루는지 컴파일 때 확인
type ClientEventSchemaName = z.infer<typeof clientEvent>['name'];
const _clientNamesCovered: Record<
  (typeof CLIENT_EVENT_NAMES)[number],
  ClientEventSchemaName
> = {
  landing_view: 'landing_view',
  landing_cta_click: 'landing_cta_click',
  motion_tier_change: 'motion_tier_change',
  pwa_install_prompt: 'pwa_install_prompt',
  pwa_installed: 'pwa_installed',
  continue_click: 'continue_click',
  quiz_try_run: 'quiz_try_run',
  phone_quiz_pick: 'phone_quiz_pick',
  daily_quiz_open: 'daily_quiz_open',
  rest_reminder_shown: 'rest_reminder_shown',
  rest_reminder_choice: 'rest_reminder_choice',
  daily_quiz_finish: 'daily_quiz_finish',
  trial_start: 'trial_start',
  trial_run: 'trial_run',
  trial_success: 'trial_success',
  share_view: 'share_view',
  share_cta_click: 'share_cta_click',
  share_open: 'share_open',
  share_channel: 'share_channel',
};
void _clientNamesCovered;

/** `POST /api/analytics` 본문: { sid: 탭 세션 난수, events: [...] } */
export const clientBatchSchema = z
  .object({
    sid: z.string().regex(ANON_ID_RE),
    events: z.array(clientEvent).min(1).max(MAX_BATCH_EVENTS),
  })
  .strict();

export type ClientBatch = z.infer<typeof clientBatchSchema>;

/** 서버 이벤트 속성 검사. 형식이 틀리면 null (코드 실수라 기록하지 않고 로그만) */
export function parseEventProps<N extends AnalyticsEventName>(
  name: N,
  props: unknown,
): AnalyticsEventProps[N] | null {
  const result = EVENT_PROPS_SCHEMA[name].safeParse(props);
  return result.success ? (result.data as AnalyticsEventProps[N]) : null;
}
