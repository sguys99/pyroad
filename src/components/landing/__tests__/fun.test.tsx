import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DURATION } from '@/lib/motion/tokens';
import {
  FUN_SCENES,
  nextScene,
  SCENE_MS,
  showMode,
  SOON_LABEL,
} from '../sections/fun/funData';

// 랜딩 재미 요소 쇼케이스 (P4-05): 장면 5개 · "곧 열려요" 플래그(Q42) · 재생 순서(한 번에 하나, 화면 안만) · 서버 HTML

vi.mock('next/dynamic', () => ({ default: () => () => null }));
const { FunShowcaseSection } = await import('../sections/FunShowcaseSection');

describe('장면 데이터 (Q42)', () => {
  it('레벨 · 코인 · 꾸미기 · 자랑하기 · 보스 배틀 순서', () => {
    expect(FUN_SCENES.map((s) => s.id)).toEqual([
      'level',
      'coin',
      'dress',
      'share',
      'boss',
    ]);
  });

  it('지금 있는 것(레벨·색 고르기)만 배지 없음, 나머지는 곧 열려요', () => {
    const soon = FUN_SCENES.filter((s) => s.soon).map((s) => s.id);
    expect(soon).toEqual(['coin', 'share', 'boss']);
  });

  it('문구는 제목 + 한 줄 (짧게)', () => {
    for (const s of FUN_SCENES) {
      expect(s.title.length).toBeLessThanOrEqual(8);
      expect(s.line.length).toBeLessThanOrEqual(26);
    }
  });

  it('장면 길이는 모션 토큰에서 (축하 카드 2.5장)', () => {
    expect(SCENE_MS).toBe(DURATION.celebrate * 2.5);
  });
});

describe('재생 순서', () => {
  it('full은 반복, lite는 한 번, minimal·동작 줄이기는 틀지 않음', () => {
    expect(showMode('full', false)).toBe('loop');
    expect(showMode('lite', false)).toBe('once');
    expect(showMode('minimal', false)).toBe('still');
    expect(showMode('full', true)).toBe('still');
  });

  it('화면 안 장면 중 마지막 다음 것을 차례로, 끝나면 처음으로', () => {
    const none = new Set<number>();
    expect(nextScene([0, 1, 2], null, none, 'loop')).toBe(0);
    expect(nextScene([0, 1, 2], 0, none, 'loop')).toBe(1);
    expect(nextScene([0, 1, 2], 2, none, 'loop')).toBe(0);
    // 화면 밖 장면은 건너뛴다
    expect(nextScene([3, 4], 1, none, 'loop')).toBe(3);
    expect(nextScene([], 1, none, 'loop')).toBeNull();
  });

  it('lite는 이미 튼 장면을 다시 틀지 않는다', () => {
    const played = new Set([0, 1]);
    expect(nextScene([0, 1, 2], 1, played, 'once')).toBe(2);
    expect(nextScene([0, 1], 1, played, 'once')).toBeNull();
    expect(nextScene([0, 1, 2], null, new Set(), 'still')).toBeNull();
  });
});

describe('쇼케이스 섹션 서버 HTML', () => {
  const html = renderToStaticMarkup(<FunShowcaseSection />);

  it('앵커·제목과 장면 제목 5개가 있다', () => {
    expect(html).toMatch(
      /<section[^>]*id="fun"[^>]*aria-labelledby="fun-title"/,
    );
    for (const s of FUN_SCENES) {
      expect(html).toContain(s.title);
      expect(html).toContain(s.line);
    }
  });

  it('"곧 열려요"는 보이는 배지 + 제목 안 낭독용 글자로 3곳', () => {
    expect(html.match(/class="ld-fun-soon"/g)).toHaveLength(3);
    expect(html.match(new RegExp(`\\(${SOON_LABEL}\\)`, 'g'))).toHaveLength(3);
  });

  it('장면은 처음에 틀지 않는다 (재생 표시 없음, opacity 0 글자 없음)', () => {
    expect(html).not.toContain('data-active');
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });
});
