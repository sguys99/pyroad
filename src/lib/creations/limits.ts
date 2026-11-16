// 작품 저장 (P11-06) 상한·모양 — 화면과 API 가 같이 쓴다. DB CHECK(00054)가 마지막으로 막는다
import type { TranscriptRow } from '@/components/quest/outputSlip';
import { unicodeFold } from '@/lib/moderation/normalize';

export type CreationKind = 'drawing' | 'conversation';

/** 작품 제목: 1~20자 한 줄 (world3.md §7 ④, 닉네임과 같은 규칙) */
export const CREATION_TITLE_MAX = 20;
/** turtle 명령 gzip 상한 (§2.2, P0-06 — 3-6 게임 30초 ≈ 명령 1,800개도 넉넉히) */
export const CREATION_COMMANDS_GZ_MAX = 102_400;
/** 썸네일 PNG 상한 (400×400) */
export const CREATION_THUMBNAIL_MAX = 204_800;
export const CREATION_THUMBNAIL_SIZE = 400;
/** 대화 기록: 줄 수 · 전체 글자 수 · 한 줄 글자 수 (Q74 ④ 길이 상한) */
export const CREATION_TRANSCRIPT_MAX_ROWS = 400;
export const CREATION_TRANSCRIPT_MAX_CHARS = 8_000;
export const CREATION_TRANSCRIPT_ROW_MAX = 500;
export const CREATION_CODE_MAX_BYTES = 20_000;
/** 한 사람이 가질 수 있는 작품 수 (00054 creations_guard) */
export const CREATIONS_PER_USER = 60;

/** 저장할 대화 기록: 너무 긴 기록은 앞부분만 (재생은 처음부터 보는 것이라 앞이 중요) */
export function clampTranscript(
  rows: readonly TranscriptRow[],
): TranscriptRow[] {
  const out: TranscriptRow[] = [];
  let chars = 0;
  for (const row of rows) {
    if (out.length >= CREATION_TRANSCRIPT_MAX_ROWS) break;
    const text = row.text.slice(0, CREATION_TRANSCRIPT_ROW_MAX);
    if (chars + text.length > CREATION_TRANSCRIPT_MAX_CHARS) break;
    chars += text.length;
    out.push(row.answer ? { text, answer: true } : { text });
  }
  return out;
}

/** 제목 칸 기본값: turtle `title()` → 퀘스트 제목, 20자로 자름 */
export function defaultCreationTitle(
  ...candidates: (string | null | undefined)[]
) {
  for (const c of candidates) {
    const t = c?.replace(/\s+/g, ' ').trim();
    if (t) return Array.from(t).slice(0, CREATION_TITLE_MAX).join('').trim();
  }
  return '나의 작품';
}

/**
 * 출품 전 개인정보 지킴이 (제안 J ③, world3.md §7): 금칙어 검사의 개인정보 규칙에 더해
 * 숫자 9자리 이상 연속 · 010 으로 시작하는 숫자열 · 이메일 모양. 걸리면 공개하지 않는다
 */
const EXTRA_PERSONAL_INFO = [
  /\d{9,}/,
  /(?<!\d)010(?:[\s.\-_]*\d){4,}/,
  /[^\s@]+\s*@\s*[^\s@]+\.[a-z]{2,}/i,
];

export function hasExtraPersonalInfo(text: string) {
  const folded = unicodeFold(text);
  return EXTRA_PERSONAL_INFO.some((re) => re.test(folded));
}
