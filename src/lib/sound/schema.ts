import { z } from 'zod';
import type { SoundSettings } from './types';

/**
 * `users.settings.sound` 쓰기 검증 (P2-14). 서버(`/api/settings`)에서만 쓴다 — 브라우저 번들에 zod를 넣지 않음
 * (읽기는 `normalizeSettings`). `.strict()`: 정해 둔 키 밖의 값은 통째로 거부한다.
 */
const volume = z.number().finite().min(0).max(1);
const category = z.object({ enabled: z.boolean(), volume }).strict();

export const soundSettingsSchema = z
  .object({
    version: z.literal(1),
    muted: z.boolean(),
    master: volume,
    sfx: category,
    bgm: category,
    voice: category,
    // epoch ms. 기기 시계가 틀릴 수 있어 위로는 넉넉히(지금 + 1일)
    updatedAt: z
      .number()
      .int()
      .min(0)
      .refine((t) => t <= Date.now() + 86_400_000, 'updatedAt in future'),
  })
  .strict() satisfies z.ZodType<SoundSettings>;
