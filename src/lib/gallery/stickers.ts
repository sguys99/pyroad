// 작품 갤러리 (P11-07) 화면·API 가 같이 쓰는 값. DB CHECK(00055 creation_reactions.sticker)가 마지막으로 막는다
import type { ReportReason } from '@/lib/board/limits';

/** 정해진 스티커만 (§3 F13 — 자유 댓글 없음). 순서 = 화면 순서. 바꾸면 00055 의 CHECK 도 새 마이그레이션으로 */
export const STICKERS = ['wow', 'love', 'fun', 'smart', 'cheer'] as const;
export type StickerId = (typeof STICKERS)[number];

/** 스티커 이름 (버튼 글자·낭독). 칭찬만 — 비교·순위 말은 쓰지 않는다(§2.6) */
export const STICKER_LABELS: Record<StickerId, string> = {
  wow: '우와',
  love: '좋아',
  fun: '재밌어',
  smart: '똑똑해',
  cheer: '최고야',
};

export type StickerCounts = Partial<Record<StickerId, number>>;

export const isSticker = (v: unknown): v is StickerId =>
  typeof v === 'string' && (STICKERS as readonly string[]).includes(v);

/** DB jsonb {sticker: n} → 아는 스티커만 */
export function stickerCounts(raw: unknown): StickerCounts {
  const out: StickerCounts = {};
  if (raw && typeof raw === 'object')
    for (const [k, v] of Object.entries(raw))
      if (isSticker(k) && typeof v === 'number' && v > 0) out[k] = v;
  return out;
}

export const totalStickers = (c: StickerCounts) =>
  STICKERS.reduce((n, s) => n + (c[s] ?? 0), 0);

/** 서로 다른 신고자가 이 수 이상이면 자동 숨김. 00055 report_creation 의 c_hide_threshold 와 같아야 함 */
export const GALLERY_REPORT_HIDE_THRESHOLD = 3;

export type GalleryReportReason = ReportReason;

/** 갤러리 한 쪽에 보이는 작품 수 */
export const GALLERY_PAGE_SIZE = 24;
