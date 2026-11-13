import { describe, expect, it } from 'vitest';
import {
  isMobileUa,
  kakaoFeed,
  loadKakao,
  SHARE_CARD_FILENAME,
  sharePageUrl,
} from '../share';
import { shareCardImagePath } from '../publicCard';

const card = {
  id: 'AbCdEfGhIjKlMnOpQrStUv',
  kind: 'stage' as const,
  version: 3,
  expiresAt: '2027-02-11T00:00:00Z',
  imageUrl: shareCardImagePath('AbCdEfGhIjKlMnOpQrStUv', 3),
};

describe('공유 도우미 (P9-09)', () => {
  it('카카오 피드: 카드 PNG 절대 주소(?v=) 1200×630 · 공유 페이지 링크 · 나도 해보기 버튼', () => {
    const feed = kakaoFeed(card, 'https://pyroad.vercel.app', '/#try');
    expect(feed).toEqual({
      objectType: 'feed',
      content: {
        title: '파이썬 모험 스테이지를 깼어요!',
        description: expect.any(String),
        imageUrl: `https://pyroad.vercel.app/api/share-cards/${card.id}/image?v=3`,
        imageWidth: 1200,
        imageHeight: 630,
        link: {
          mobileWebUrl: `https://pyroad.vercel.app/share/${card.id}`,
          webUrl: `https://pyroad.vercel.app/share/${card.id}`,
        },
      },
      buttons: [
        {
          title: '나도 해보기',
          link: {
            mobileWebUrl: 'https://pyroad.vercel.app/#try',
            webUrl: 'https://pyroad.vercel.app/#try',
          },
        },
      ],
    });
    // 닉네임 등 아이 정보는 메시지 글에 넣지 않는다 (그림에만)
    expect(JSON.stringify(feed)).not.toMatch(/님/);
  });

  it('주소·파일 이름·휴대폰 판별', () => {
    expect(sharePageUrl('http://localhost:3100', 'x')).toBe(
      'http://localhost:3100/share/x',
    );
    expect(SHARE_CARD_FILENAME.stage).toBe('pyroad-stage-clear.png');
    expect(
      isMobileUa('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'),
    ).toBe(true);
    expect(isMobileUa('Mozilla/5.0 (Linux; Android 15; SM-S921N)')).toBe(true);
    expect(isMobileUa('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(
      false,
    );
  });

  it('카카오 키가 없으면 SDK 를 싣지 않는다 (버튼 숨김)', async () => {
    await expect(loadKakao('')).resolves.toBeNull();
    await expect(loadKakao(undefined)).resolves.toBeNull();
  });
});
