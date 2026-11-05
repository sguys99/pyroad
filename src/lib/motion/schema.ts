import { z } from 'zod';
import type { MotionSettings } from './tier';

/**
 * `users.settings.motion` 쓰기 검증 (P2-15). 서버(`/api/settings`)에서만 쓴다 — 브라우저 번들에 zod를 넣지 않음
 * (읽기는 `normalizeMotionSettings`).
 *
 * `.strict()`: 정해 둔 두 키 밖의 값(측정값·기기 정보 등)은 통째로 거부한다. 측정값은 기기마다 달라 서버에 저장하지 않는다 (00012).
 */
export const motionSettingsSchema = z
  .object({
    tier: z.enum(['auto', 'full', 'lite', 'minimal']),
    reduced: z.enum(['system', 'on', 'off']),
  })
  .strict() satisfies z.ZodType<MotionSettings>;
