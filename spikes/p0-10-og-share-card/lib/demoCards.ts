/**
 * share_cards 테이블 대용 (스파이크). 실제 구현에서는 service role로 조회하지 않고,
 * `is_public = true AND deleted_at IS NULL` 행만 읽는 공개 뷰/함수로 조회합니다.
 *
 * id: 128비트 난수 base64url 22자 (예: crypto.randomBytes(16).toString('base64url')).
 * 순번·user_id·날짜에서 유추할 수 없어야 합니다 (열거 공격 방지).
 */
import type { CardData } from '@/cards/types';

export interface ShareCardRow {
  id: string;
  version: number; // 카드가 바뀌면 +1 → 이미지 URL ?v= 가 바뀌어 CDN·카카오 캐시를 우회
  is_public: boolean;
  payload: CardData;
}

const ROWS: ShareCardRow[] = [
  {
    id: 'hzEbwb74Pa6krPzNTNoMbQ', version: 1, is_public: true,
    payload: { kind: 'levelup', style: 'a', nickname: '코딩왕민준', avatar: { character: 'pybaem', expression: 'celebrating', costumes: ['party-hat'] }, level: { value: 12, title: '반복의 달인' } },
  },
  {
    id: 'uSKYBNLk6IJxEIyD31qVmg', version: 1, is_public: true,
    payload: { kind: 'stage', style: 'b', nickname: '별빛소녀', avatar: { character: 'pybaem', expression: 'proud' }, stage: { no: 3, name: '조건의 갈림길', stars: 3, maxStars: 3, world: '1월드 · 파이썬 섬' } },
  },
  {
    id: 'BjvMSYokkrlDKV81Iu2Emg', version: 2, is_public: true,
    payload: { kind: 'achievement', style: 'a', nickname: '뿡뿡이', avatar: { character: 'bugbug', expression: 'fixed' }, achievement: { name: '에러 극복왕', desc: '에러를 10번 만나고 모두 고쳤어요!', tier: 'gold', icon: 'bug' } },
  },
  {
    id: 'kJyqr-dfS79a7K4bQKCMFA', version: 1, is_public: false, // 비공개 전환된 카드 → 404
    payload: { kind: 'weekly', style: 'b', nickname: '하늘별', avatar: { character: 'pybaem', expression: 'encouraging' }, weekly: { range: '11월 3일 ~ 11월 9일', days: [2, 3, 0, 4, 1, 2, 0], quests: 12, stars: 28, streak: 5, learned: ['for 반복문', 'range()', '리스트'] } },
  },
];

const ID_RE = /^[A-Za-z0-9_-]{22}$/;

export async function getPublicCard(id: string): Promise<ShareCardRow | null> {
  if (!ID_RE.test(id)) return null;
  const row = ROWS.find((r) => r.id === id);
  return row && row.is_public ? row : null;
}

export function cardHeadline(d: CardData): string {
  switch (d.kind) {
    case 'levelup':
      return `${d.nickname}님이 레벨 ${d.level?.value}에 올랐어요!`;
    case 'stage':
      return `${d.nickname}님이 '${d.stage?.name}' 스테이지를 클리어했어요!`;
    case 'achievement':
      return `${d.nickname}님이 '${d.achievement?.name}' 업적을 얻었어요!`;
    case 'weekly':
      return `${d.nickname}님의 이번 주 성장 일기`;
  }
}
