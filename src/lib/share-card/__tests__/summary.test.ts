import { describe, expect, it } from 'vitest';
import { shareCardSummary } from '../summary';
import { SHARE_CARD_SAMPLES } from '../samples';

describe('shareCardSummary (P9-08)', () => {
  it('샘플마다 닉네임이 들어간 축하 문구와 대체 글', () => {
    for (const { data } of SHARE_CARD_SAMPLES) {
      const { headline, alt } = shareCardSummary(data);
      expect(headline, data.kind).toContain(data.nickname.trim());
      expect(headline.endsWith('!')).toBe(true);
      expect(alt.length).toBeGreaterThan(headline.length - 10);
    }
  });

  it('카드에 적힌 숫자를 대체 글에 빠짐없이', () => {
    expect(
      shareCardSummary({
        kind: 'weekly',
        nickname: '별',
        weekLabel: '11월 둘째 주',
        quests: 7,
        xp: 420,
        stars: 15,
      }).alt,
    ).toBe('주간 성장 카드. 별님의 11월 둘째 주: 퀘스트 7개, 420 XP, 별 15개.');
    expect(
      shareCardSummary({
        kind: 'stage',
        nickname: '별',
        world: 2,
        worldName: '바다 마을',
        stageNo: 3,
        stageName: '반복의 파도',
        stars: 2,
      }),
    ).toEqual({
      headline: '별님이 「반복의 파도」 스테이지를 깼어요!',
      alt: '스테이지 클리어 카드. 별님이 바다 마을 3번째 「반복의 파도」 스테이지를 깼어요. 별 2개 / 3개.',
    });
  });

  it('제어 문자·겹친 공백은 지운다', () => {
    expect(
      shareCardSummary({ kind: 'levelup', nickname: ' 파이​  뱀 ', level: 5 })
        .headline,
    ).toBe('파이 뱀님이 레벨 5에 올랐어요!');
  });
});
