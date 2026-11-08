import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LEGAL_OPERATOR } from '@/lib/legal/meta';
import { buildFaqStructuredData, FAQ } from '../sections/faq/faq';
import { FaqSection } from '../sections/FaqSection';
import { LandingFooter } from '../LandingFooter';

// 랜딩 FAQ·바닥 글 (P4-08): 짧은 답 · 접근성 있는 <details> · FAQPage JSON-LD = 화면 글 · 바닥 글 링크

describe('FAQ 데이터', () => {
  it('질문 6~7개, id가 겹치지 않는다', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(6);
    expect(FAQ.length).toBeLessThanOrEqual(7);
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(FAQ.length);
  });

  it('답은 1~2문장이고 해요체로 끝난다 (랜딩 글자 예산)', () => {
    for (const f of FAQ) {
      const sentences = f.a.split(/(?<=[.?!])\s+/);
      expect(sentences.length).toBeLessThanOrEqual(2);
      expect(f.a).toMatch(/요\.$/);
      expect([...f.a].length).toBeLessThanOrEqual(60);
    }
  });

  it('아직 없는 기능은 답에 쓰지 않는다', () => {
    const text = FAQ.map((f) => f.q + f.a).join(' ');
    expect(text).not.toMatch(/코인|별|휴식|리포트|앱스토어/);
  });

  it('FAQPage JSON-LD는 화면의 질문·답과 글자 그대로 같다', () => {
    const ld = buildFaqStructuredData(FAQ) as {
      '@type': string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
      FAQ.map((f) => [f.q, f.a]),
    );
  });
});

describe('FAQ 서버 HTML', () => {
  const html = renderToStaticMarkup(<FaqSection />);

  it('앵커·제목 id', () => {
    expect(html).toMatch(/<section[^>]*id="faq"/);
    expect(html).toContain('id="faq-title"');
  });

  it('질문마다 접힌 <details>/<summary> (JS 없이 키보드·낭독기로 연다)', () => {
    expect(html.match(/<details/g)).toHaveLength(FAQ.length);
    expect(html.match(/<summary/g)).toHaveLength(FAQ.length);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    for (const f of FAQ) {
      expect(html).toContain(f.q);
      expect(html).toContain(f.a.replaceAll('"', '&quot;'));
    }
  });

  it('JSON-LD 데이터 블록이 섹션 안에 있고 파싱된다', () => {
    const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(
      html,
    );
    expect(m).not.toBeNull();
    const data = JSON.parse(m![1]);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(FAQ.length);
  });
});

describe('랜딩 바닥 글', () => {
  const html = renderToStaticMarkup(<LandingFooter />);

  it('약관·방침·공지·오픈소스 고지·문의 링크가 있다', () => {
    for (const href of ['/terms', '/privacy', '/notice', '/licenses'])
      expect(html).toContain(`href="${href}"`);
    // 문의 = 약관·처리방침에 적힌 연락처
    expect(html).toContain(`href="mailto:${LEGAL_OPERATOR.email}"`);
  });

  it('개인정보처리방침은 굵게 (눈에 띄게)', () => {
    expect(html).toMatch(
      /<a[^>]*class="[^"]*font-bold[^"]*"[^>]*>개인정보처리방침</,
    );
  });

  it('없는 앵커(#about)·바깥 개발 사이트 링크가 없다', () => {
    expect(html).not.toContain('#about');
    expect(html).not.toContain('github.com');
  });

  it('링크 글자 크기 클래스가 tailwind-merge에 지워지지 않는다', () => {
    expect(html.match(/text-small/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
