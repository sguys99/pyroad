import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// 랜딩 뼈대 (P4-01): 섹션 순서·앵커, 첫 화면 글자는 서버 HTML에 보이는 상태, 파이뱀은 정지 그림으로 시작

vi.mock('@/fonts/landing', () => ({
  displayLanding: { variable: '__variable_d1' },
  sansLanding: { variable: '__variable_s1' },
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

const { default: Home } = await import('@/app/page');

describe('랜딩 페이지 서버 HTML', () => {
  const html = renderToStaticMarkup(<Home />);

  it('섹션이 시안 순서대로 있고 앵커 id가 정해진 값이다', () => {
    const ids = [...html.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(ids).toEqual([
      'hero',
      'try',
      'worlds',
      'fun',
      'friends',
      'parents',
      'faq',
    ]);
    for (const id of ids.slice(1)) {
      expect(html).toContain(`aria-labelledby="${id}-title"`);
      expect(html).toContain(`id="${id}-title"`);
    }
  });

  it('헤더 바로가기는 #try·#parents를 가리킨다', () => {
    expect(html).toContain('href="#try"');
    expect(html).toContain('href="#parents"');
  });

  it('제목·부제·버튼이 처음부터 보이는 상태다 (opacity 0 없음, §2.10)', () => {
    expect(html).toMatch(/<h1[^>]*id="hero-title"/);
    expect(html).toContain('모험 시작!');
    expect(html).toContain('30초 체험');
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });

  it('파이뱀은 서버에서 정지 그림 + 누를 수 있는 버튼으로 그린다', () => {
    expect(html).toMatch(
      /<button[^>]*aria-label="파이뱀 콕 누르기"[^>]*data-testid="hero-mascot"/,
    );
    expect(html).toContain('class="hero-mascot-svg"');
    expect(html).toContain('data-testid="hero-bubble"');
  });
});
