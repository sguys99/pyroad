import 'server-only';

import { dangerouslyDeleteByTag } from '@vercel/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { reportServerError } from '@/lib/api/serverError';

/** 이미지 라우트의 `vercel-cache-tag` 와 같은 이름 (publicCard.ts shareCardCacheHeaders) */
export const shareCardTag = (id: string) => `share-card-${id}`;

/**
 * 카드 이미지의 CDN 사본을 바로 지운다 (P9-11, P0-10 §4.7). 비공개·삭제·그림이 바뀐 카드만 — 90일 만료 카드는
 * 이미지 CDN max-age 가 만료까지 남은 초로 잘려 있어 부를 필요 없음.
 * Vercel 함수 밖(로컬·테스트)에서는 아무 일도 하지 않는다. 실패해도 던지지 않음: 사용자 동작(숨기기·장착)은 이미 성공했고
 * 로그·Sentry 로 남겨 런북대로 손으로 지운다
 */
export async function purgeShareCards(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await dangerouslyDeleteByTag(ids.map(shareCardTag));
  } catch (error) {
    reportServerError(error, { area: 'share-card', op: 'share-card purge' });
  }
}

type AdminClient = SupabaseClient<Database>;

/**
 * 닉네임·꾸민 모습을 바꾸는 쓰기(`run`) 앞뒤로 내 카드 version 을 비교해, 00045 트리거가 다시 그리게 한 카드만 지운다.
 * 펫·에디터 테마처럼 공개 모습이 그대로면 아무것도 지우지 않는다
 */
export async function withShareCardPurge<T>(
  admin: AdminClient,
  userId: string,
  run: () => Promise<T>,
): Promise<T> {
  const versions = async () => {
    const { data, error } = await admin
      .from('share_cards')
      .select('id, version')
      .eq('user_id', userId);
    if (error) {
      reportServerError(error, { area: 'share-card', op: 'purge versions' });
      return null;
    }
    return new Map(data.map((c) => [c.id, c.version]));
  };
  const before = await versions();
  const result = await run();
  if (before && before.size > 0) {
    const after = await versions();
    if (after)
      await purgeShareCards(
        [...after].filter(([id, v]) => before.get(id) !== v).map(([id]) => id),
      );
  }
  return result;
}
