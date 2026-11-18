import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { LazyMotion, domMax } from 'framer-motion';
import { PageTransition } from '../PageTransition';

// B102: 서버 렌더(= full 단계 slide)에 opacity 0을 걸면 JS가 돌 때까지 화면이 비어 LCP가 하이드레이션 뒤로 밀린다 (§2.10 규칙)
describe('PageTransition 서버 렌더', () => {
  it('글자를 보이는 채로 그리고 올라오기(transform)만 건다', () => {
    const html = renderToString(
      <LazyMotion features={domMax}>
        <PageTransition>모험 지도</PageTransition>
      </LazyMotion>,
    );
    expect(html).toContain('모험 지도');
    expect(html).not.toMatch(/opacity:\s*0(?![.\d]*[1-9])/);
    expect(html).toMatch(/translateY\(12px\)/);
  });
});
