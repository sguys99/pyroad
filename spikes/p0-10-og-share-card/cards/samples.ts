/**
 * 스파이크용 예시 데이터. 실제 구현에서는 쿼리스트링이 아니라
 * `share_cards` 행(id로 조회)의 payload 스냅샷으로 카드를 그립니다.
 * (쿼리로 임의 문자열을 받아 그리면 우리 도메인에서 아무 문구나 이미지를 만들 수 있게 되어 악용됩니다.)
 */
import type { CardData, CardKind, CardStyle } from './types';

export function sampleCard(kind: CardKind, q: URLSearchParams): CardData {
  const nickname = q.get('nick') ?? '코딩왕민준';
  const style = (q.get('style') as CardStyle | null) ?? (kind === 'stage' || kind === 'weekly' ? 'b' : 'a');
  const costumes = q.get('costumes')?.split(',').filter(Boolean) as CardData['avatar']['costumes'];
  switch (kind) {
    case 'levelup':
      return {
        kind, style, nickname,
        avatar: { character: 'pybaem', expression: q.get('expr') ?? 'celebrating', costumes: costumes ?? ['party-hat'] },
        level: { value: Number(q.get('lv') ?? 12), title: q.get('title') ?? '반복의 달인' },
      };
    case 'stage':
      return {
        kind, style, nickname,
        avatar: { character: 'pybaem', expression: q.get('expr') ?? 'proud', costumes: costumes ?? [] },
        stage: {
          no: Number(q.get('no') ?? 3),
          name: q.get('stage') ?? '조건의 갈림길',
          stars: Number(q.get('stars') ?? 3),
          maxStars: 3,
          world: q.get('world') ?? '1월드 · 파이썬 섬',
        },
      };
    case 'achievement':
      return {
        kind, style, nickname,
        avatar: { character: 'bugbug', expression: 'fixed' },
        achievement: {
          name: q.get('ach') ?? '에러 극복왕',
          desc: q.get('desc') ?? '에러를 10번 만나고 모두 고쳤어요!',
          tier: (q.get('tier') as 'bronze' | 'silver' | 'gold' | null) ?? 'gold',
          icon: 'bug',
        },
      };
    case 'weekly':
      return {
        kind, style, nickname,
        avatar: { character: 'pybaem', expression: 'encouraging', costumes: costumes ?? [] },
        weekly: {
          range: q.get('range') ?? '11월 3일 ~ 11월 9일',
          days: (q.get('days') ?? '2,3,0,4,1,2,0').split(',').map(Number),
          quests: 12,
          stars: 28,
          streak: 5,
          learned: (q.get('learned') ?? 'for 반복문,range(),리스트').split(','),
        },
      };
  }
}
