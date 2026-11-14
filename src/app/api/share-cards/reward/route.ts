import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimShareRewardRpc, rewardError } from '@/lib/quest/rewardRpc';

const CARD_ID = /^[A-Za-z0-9_-]{22}$/;

/**
 * 자랑하기 보상 (P9-10, §12-Q67 ④). 공유 시트에서 채널을 다 쓴 뒤(카카오 창 띄움 · Web Share 끝 · 저장 · 복사) 부른다.
 * 본문 `{ cardId }` — 방금 보낸 카드. 사용자는 `auth.getUser()`로 확인한 id 만
 *
 * - 금액·하루 경계는 서버(`claim_share_reward`, 00044): 본인 공개 카드가 있을 때 KST 하루 한 번 15코인(원장 share/<날짜>).
 *   같은 날 다시·동시에 불러도 200 + already_claimed(0)
 * - 보호자 동의 게이트는 걸지 않음: 남에게 보이는 쓰기(카드 공개)는 만들기 API 가 이미 막고, 여기는 본인 코인만 바뀜(출석 도장과 같음)
 * - 받으면 HUD 코인이 바뀌므로 무효화 (화면은 router.refresh())
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    cardId?: unknown;
  } | null;
  const cardId = body?.cardId;
  if (typeof cardId !== 'string' || !CARD_ID.test(cardId))
    return rewardError('invalid_arguments');

  const result = await claimShareRewardRpc(
    createAdminClient(),
    user.id,
    cardId,
  );
  if (!result.ok) return result.response;
  if (!result.data.already_claimed) {
    revalidatePath('/world', 'layout');
    revalidatePath('/profile');
  }
  return NextResponse.json(result.data);
}
