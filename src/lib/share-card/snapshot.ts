/**
 * `share_cards.snapshot` (00043, P9-07) → 카드 데이터. 이미지 라우트와 공유 페이지(P9-08)가 이 함수 하나로 읽는다.
 *
 * - 스냅샷은 서버 RPC `create_share_card`가 실제 기록으로 만든 공개 정보뿐(닉네임·공개 꾸민 모습·성과 숫자·이름).
 *   그래도 그리기 전에 한 번 더 모양을 확인한다: 모르는 키가 있으면(`strict`) 그리지 않는다(§2.6, DB CHECK 와 같은 키 목록)
 * - 아바타는 게시판 공개 아바타와 같은 값(스킨 + 모자·안경·망토·배경·테두리 아이템 id, 펫 없음) → `avatarLook`으로 코스튬
 */
import { z } from 'zod';
import { avatarLook } from '@/lib/avatar/look';
import type { WorldId } from '@/lib/design/tokens';
import type { ShareCardData, ShareCardKind } from './types';

const text = z.string().min(1).max(120);
const count = z.number().int().min(0).max(1_000_000);
const avatar = z
  .object({
    skin: z.string().max(40),
    hat: z.string().max(40),
    glasses: z.string().max(40),
    cape: z.string().max(40),
    bg: z.string().max(40),
    frame: z.string().max(40),
  })
  .partial()
  .strict();
const base = {
  nickname: z.string().min(1).max(40),
  avatar: avatar.optional(),
  world: z.number().int().min(1).max(3).optional(),
};

const SCHEMAS = {
  levelup: z.object({ ...base, level: z.number().int().min(1).max(999) }),
  stage: z.object({
    ...base,
    world: z.number().int().min(1).max(3),
    worldName: text,
    stageNo: z.number().int().min(1).max(999),
    stageName: text,
    stars: z.number().int().min(0).max(3),
    maxStars: z.literal(3).optional(),
  }),
  achievement: z.object({
    ...base,
    name: text,
    desc: z.string().max(200),
    tier: z.enum(['bronze', 'silver', 'gold']),
    icon: z.enum(['code', 'bug', 'flame', 'star', 'book', 'bulb', 'crown']),
  }),
  weekly: z.object({
    ...base,
    weekLabel: text,
    quests: count,
    xp: count,
    stars: count,
  }),
} as const;

export const SHARE_CARD_KINDS = Object.keys(SCHEMAS) as ShareCardKind[];

export function isShareCardKind(v: unknown): v is ShareCardKind {
  return typeof v === 'string' && v in SCHEMAS;
}

/** 스냅샷 → 카드 데이터. 모양이 다르면 null (그리지 않음) */
export function cardFromSnapshot(
  kind: string,
  snapshot: unknown,
): ShareCardData | null {
  if (!isShareCardKind(kind)) return null;
  const parsed = SCHEMAS[kind].strict().safeParse(snapshot);
  if (!parsed.success) return null;
  const { avatar: a, world, ...rest } = parsed.data;
  const look = avatarLook(a ?? {});
  return {
    ...rest,
    kind,
    world: world as WorldId | undefined,
    avatar: { costume: look.costume, skin: look.skin },
  } as ShareCardData;
}

/** 카드 id: 128비트 난수 base64url 22자 (00043 CHECK 와 같음) */
export const SHARE_CARD_ID = /^[A-Za-z0-9_-]{22}$/;
