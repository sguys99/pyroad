import 'server-only';

import type { User } from '@supabase/supabase-js';
import type { TranscriptRow } from '@/components/quest/outputSlip';
import { isAdminUser } from '@/lib/admin';
import { reportServerError } from '@/lib/api/serverError';
import { publicLook, type AvatarLook } from '@/lib/avatar/look';
import { FALLBACK_AUTHOR_NAME } from '@/lib/board/display';
import { fromBytea, publishableQuests } from '@/lib/creations/server';
import type { CreationKind } from '@/lib/creations/limits';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  GALLERY_PAGE_SIZE,
  STICKERS,
  stickerCounts,
  type StickerCounts,
  type StickerId,
} from './stickers';

/**
 * 작품 갤러리 읽기 (P11-07, 서버 전용). 남의 공개 작품은 `gallery_creations` 뷰(00055, service_role 전용)로만 읽는다 —
 * 뷰가 공개·안 숨긴 작품만, 작가는 닉네임·파이뱀 모습만, 코드는 작가가 켠 것만 내보낸다. 로그인 확인은 부르는 쪽(getUser)이.
 * 내 작품은 본인 세션(RLS 00054)으로, 운영자는 숨긴 작품도 service_role 로 본다
 */

export interface GalleryAuthor {
  name: string;
  look: AvatarLook;
}

export interface GalleryItem {
  id: string;
  kind: CreationKind;
  title: string;
  publishedAt: string;
  author: GalleryAuthor;
  stickers: StickerCounts;
  isMine: boolean;
  /** 대화 작품 표지: 앞 세 줄 */
  preview?: { text: string; answer?: boolean }[];
}

const author = (r: {
  author_name?: string | null;
  display_name?: string | null;
  avatar_skin?: string | null;
  avatar_look?: unknown;
}): GalleryAuthor => ({
  name: (r.author_name ?? r.display_name)?.trim() || FALLBACK_AUTHOR_NAME,
  look: publicLook(r),
});

const kindOf = (k: string): CreationKind =>
  k === 'conversation' ? 'conversation' : 'drawing';

/** 갤러리 한 쪽 (최신 공개순). 한 개 더 읽어 다음 쪽이 있는지 안다 */
export async function listGallery(
  userId: string,
  page = 0,
): Promise<{ items: GalleryItem[]; hasMore: boolean; failed: boolean }> {
  const from = page * GALLERY_PAGE_SIZE;
  const { data, error } = await createAdminClient()
    .from('gallery_creations')
    .select(
      'id, author_id, kind, title, published_at, author_name, avatar_skin, avatar_look, stickers, t0:transcript->0, t1:transcript->1, t2:transcript->2',
    )
    .order('published_at', { ascending: false })
    .order('id')
    .range(from, from + GALLERY_PAGE_SIZE);
  if (error) {
    reportServerError(error, { area: 'gallery', op: 'list' });
    return { items: [], hasMore: false, failed: true };
  }
  const rows = data ?? [];
  return {
    items: rows.slice(0, GALLERY_PAGE_SIZE).map((r) => ({
      id: r.id!,
      kind: kindOf(r.kind!),
      title: r.title!,
      publishedAt: r.published_at!,
      author: author(r),
      stickers: stickerCounts(r.stickers),
      isMine: r.author_id === userId,
      preview: [r.t0, r.t1, r.t2]
        .filter((t): t is { text: string; answer?: boolean } =>
          Boolean(t && typeof t === 'object' && 'text' in t),
        )
        .map((t) => ({
          text: String(t.text).slice(0, 60),
          answer: !!t.answer,
        })),
    })),
    hasMore: rows.length > GALLERY_PAGE_SIZE,
    failed: false,
  };
}

export type WorkMode = 'public' | 'own' | 'admin';

export interface GalleryWork extends GalleryItem {
  mode: WorkMode;
  /** 보여 줄 코드 (남의 작품은 작가가 켠 것만, 내 작품은 늘). 없으면 null */
  code: string | null;
  showCode: boolean;
  transcript: TranscriptRow[];
  visibility: 'private' | 'public';
  hiddenAt: string | null;
  /** 내 작품: 갤러리에 올릴 수 있나 (3월드 프로젝트 완료, Q75 ⑧) */
  eligible: boolean;
}

const OWN_COLS =
  'id, user_id, kind, title, quest_id, show_code, code, transcript, published_at, visibility, hidden_at, created_at';

/**
 * 작품 하나: 내 작품(본인 세션) → 갤러리 공개 작품(뷰) → 운영자면 숨긴 작품도. 볼 수 없으면 null
 */
export async function loadWork(
  id: string,
  user: User,
): Promise<GalleryWork | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const own = await supabase
    .from('creations')
    .select(OWN_COLS)
    .eq('id', id)
    .maybeSingle();
  if (own.error) reportServerError(own.error, { area: 'gallery', op: 'own' });

  let row = own.data;
  let mode: WorkMode = 'own';
  if (!row) {
    const pub = await admin
      .from('gallery_creations')
      .select(
        'id, author_id, kind, title, show_code, code, transcript, published_at, author_name, avatar_skin, avatar_look, stickers',
      )
      .eq('id', id)
      .maybeSingle();
    if (pub.error) reportServerError(pub.error, { area: 'gallery', op: 'get' });
    const p = pub.data;
    if (p)
      return {
        mode: 'public',
        id: p.id!,
        kind: kindOf(p.kind!),
        title: p.title!,
        publishedAt: p.published_at!,
        author: author(p),
        stickers: stickerCounts(p.stickers),
        isMine: false,
        code: p.show_code ? (p.code ?? null) : null,
        showCode: !!p.show_code,
        transcript: (p.transcript as TranscriptRow[] | null) ?? [],
        visibility: 'public',
        hiddenAt: null,
        eligible: false,
      };
    if (!isAdminUser(user)) return null;
    const hidden = await admin
      .from('creations')
      .select(OWN_COLS)
      .eq('id', id)
      .maybeSingle();
    if (hidden.error)
      reportServerError(hidden.error, { area: 'gallery', op: 'admin get' });
    row = hidden.data;
    mode = 'admin';
  }
  if (!row) return null;

  const [profile, stickers, eligible] = await Promise.all([
    admin
      .from('user_profiles_public')
      .select('display_name, avatar_skin, avatar_look')
      .eq('id', row.user_id)
      .maybeSingle(),
    countStickers(id),
    mode === 'own' && row.quest_id && row.visibility === 'private'
      ? publishableQuests(supabase, user.id, [row.quest_id]).then((s) =>
          s.has(row.quest_id!),
        )
      : Promise.resolve(false),
  ]);
  return {
    mode,
    id: row.id,
    kind: kindOf(row.kind),
    title: row.title,
    publishedAt: row.published_at ?? row.created_at,
    author: author(profile.data ?? {}),
    stickers,
    isMine: mode === 'own',
    code: row.code || null,
    showCode: row.show_code,
    transcript: (row.transcript as TranscriptRow[] | null) ?? [],
    visibility: row.visibility === 'public' ? 'public' : 'private',
    hiddenAt: row.hidden_at,
    eligible,
  };
}

export async function countStickers(id: string): Promise<StickerCounts> {
  const { data, error } = await createAdminClient()
    .from('creation_reactions')
    .select('sticker')
    .eq('creation_id', id);
  if (error) reportServerError(error, { area: 'gallery', op: 'count' });
  const out: StickerCounts = {};
  for (const r of data ?? [])
    out[r.sticker as StickerId] = (out[r.sticker as StickerId] ?? 0) + 1;
  return out;
}

/** 내가 이 작품에 붙인 스티커 */
export async function myStickers(
  id: string,
  userId: string,
): Promise<StickerId[]> {
  const { data, error } = await createAdminClient()
    .from('creation_reactions')
    .select('sticker')
    .eq('creation_id', id)
    .eq('user_id', userId);
  if (error) reportServerError(error, { area: 'gallery', op: 'mine' });
  const mine = new Set((data ?? []).map((r) => r.sticker));
  return STICKERS.filter((s) => mine.has(s));
}

/** 운영자: 신고가 들어온 작품의 사유별 수 (숨김 판단용) */
export async function reportCounts(id: string) {
  const { data, error } = await createAdminClient()
    .from('creation_reports')
    .select('reason')
    .eq('creation_id', id);
  if (error) reportServerError(error, { area: 'gallery', op: 'reports' });
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.reason] = (out[r.reason] ?? 0) + 1;
  return out;
}

/**
 * 작품의 그림 바이트(명령 gzip·썸네일 PNG): 내 작품(본인 세션) → 공개 작품(뷰) → 운영자면 숨긴 작품도.
 * 못 보면 null, 읽기 오류면 'error'
 */
export async function readCreationBytes(
  id: string,
  user: User,
  col: 'commands_gz' | 'thumbnail',
): Promise<Buffer | null | 'error'> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const tries = [
    () => supabase.from('creations').select(col).eq('id', id).maybeSingle(),
    () =>
      admin.from('gallery_creations').select(col).eq('id', id).maybeSingle(),
    ...(isAdminUser(user)
      ? [() => admin.from('creations').select(col).eq('id', id).maybeSingle()]
      : []),
  ];
  for (const read of tries) {
    const { data, error } = await read();
    if (error) {
      reportServerError(error, { area: 'gallery', op: col });
      return 'error';
    }
    const value = (data as Record<string, string | null> | null)?.[col];
    if (value) return fromBytea(value);
    if (data) return null; // 보이는 작품인데 썸네일이 없음
  }
  return null;
}
