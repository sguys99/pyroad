import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { cardFromSnapshot, SHARE_CARD_ID } from './snapshot';
import type { ShareCardData } from './types';

/**
 * 공개 공유 카드 읽기 (P9-07 이미지 라우트 · P9-08 공유 페이지). service_role 함수 `share_card_public`(00043)만 쓴다:
 * 공개 중이고 만료 전(90일, §12-Q67)인 카드의 스냅샷뿐, user_id 는 오지 않는다.
 */
export interface PublicShareCard {
  id: string;
  data: ShareCardData;
  version: number;
  expiresAt: Date;
}

/** null = 없음·비공개·만료·모양이 틀림(404), 'error' = 조회 실패(503) */
export async function loadPublicShareCard(
  id: string,
): Promise<PublicShareCard | null | 'error'> {
  if (!SHARE_CARD_ID.test(id)) return null;
  const { data, error } = await createAdminClient()
    .rpc('share_card_public', { p_id: id })
    .maybeSingle();
  if (error) {
    reportServerError(error, { area: 'share-card', op: 'public read' });
    return 'error';
  }
  if (!data) return null;
  const card = cardFromSnapshot(data.kind, data.snapshot);
  if (!card) {
    reportServerError(new Error('snapshot shape'), {
      area: 'share-card',
      op: 'snapshot parse',
    });
    return null;
  }
  return {
    id: data.id,
    data: card,
    version: data.version,
    expiresAt: new Date(data.expires_at),
  };
}

/** og:image·카카오 imageUrl (P9-08·P9-09). `?v=` 는 캐시 키일 뿐 그림에는 쓰지 않는다 */
export function shareCardImagePath(id: string, version: number): string {
  return `/api/share-cards/${id}/image?v=${version}`;
}

const YEAR = 31_536_000;
const HOUR = 3_600;

/**
 * 이미지 캐시 헤더 (P0-10 §4.7, P9-08 표). CDN 은 1년이지만 **만료 시각을 넘기지 않는다**: 90일 뒤 자동 비공개(§12-Q67)가
 * CDN 사본 때문에 늦어지지 않게 남은 초로 줄인다. 비공개·삭제는 태그로 지운다(P9-11 `dangerouslyDeleteByTag`).
 * 키는 소문자: `ImageResponse`가 기본으로 넣는 `cache-control`(1년 immutable)을 덮어야 해서(대소문자가 다르면 두 값이 합쳐짐)
 */
export function shareCardCacheHeaders(
  id: string,
  expiresAt: Date,
  now: Date = new Date(),
): Record<string, string> {
  const left = Math.max(
    0,
    Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
  );
  return {
    'cache-control': `public, max-age=${Math.min(HOUR, left)}`,
    'vercel-cdn-cache-control': `public, max-age=${Math.min(YEAR, left)}`,
    'vercel-cache-tag': `share-card-${id}`,
  };
}
