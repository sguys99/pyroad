import { describe, expect, it } from 'vitest';
import { privacyFindings, type OwnWork } from '@/components/gallery/OwnerPanel';
import { isSticker, stickerCounts, totalStickers } from '../stickers';

describe('갤러리 스티커 (P11-07)', () => {
  it('정해진 5종만 세고 모르는 키·0·숫자 아닌 값은 버림', () => {
    expect(isSticker('love')).toBe(true);
    expect(isSticker('poop')).toBe(false);
    const c = stickerCounts({ love: 2, wow: 0, poop: 9, fun: '3' });
    expect(c).toEqual({ love: 2 });
    expect(totalStickers({ love: 2, cheer: 1 })).toBe(3);
    expect(stickerCounts(null)).toEqual({});
  });
});

describe('출품 시트 개인정보 지킴이 (제안 J)', () => {
  const work = (over: Partial<OwnWork>): OwnWork => ({
    id: 'x',
    kind: 'conversation',
    title: '용 모험',
    code: 'print("01012345678")',
    transcript: [{ text: '안녕' }],
    visibility: 'private',
    hiddenAt: null,
    showCode: false,
    eligible: true,
    author: { name: 'a', look: {} as OwnWork['author']['look'] },
    ...over,
  });
  it('전화번호·이메일 모양은 막고(stop), 숫자 4개 이상은 한 번 더 보기(warn), 코드는 켰을 때만', () => {
    expect(privacyFindings(work({}), false)).toEqual({ stop: [], warn: [] });
    expect(privacyFindings(work({}), true).stop).toEqual(['코드']);
    expect(
      privacyFindings(work({ transcript: [{ text: 'kid@school.kr' }] }), false)
        .stop,
    ).toEqual(['대화 기록']);
    expect(
      privacyFindings(work({ title: '우리집 1203호' }), false).warn,
    ).toEqual(['작품 이름']);
  });
});
