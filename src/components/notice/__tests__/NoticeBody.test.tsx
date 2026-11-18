import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NoticeBody } from '../NoticeBody';
import { noticePreview } from '@/lib/notice/preview';

const html = (content: string) =>
  renderToStaticMarkup(<NoticeBody content={content} />);

describe('NoticeBody (B145)', () => {
  it('### 소제목은 h2, "- " 줄은 목록 항목', () => {
    const out = html('### AI 튜터\n- 하나\n- 둘');
    expect(out).toMatch(/<h2[^>]*>AI 튜터<\/h2>/);
    expect(out.match(/<li/g)).toHaveLength(2);
  });

  it('메일·https 주소는 링크, 외부 링크는 새 탭 + noopener noreferrer', () => {
    const out = html('문의: sguys99@gmail.com, https://pyroad.vercel.app');
    expect(out).toContain('href="mailto:sguys99@gmail.com"');
    expect(out).toMatch(
      /href="https:\/\/pyroad.vercel.app"[^>]*target="_blank" rel="noopener noreferrer"/,
    );
  });

  it('javascript:·data: 링크는 글자만 남는다', () => {
    const out = html('[눌러](javascript:alert(1)) [그림](data:text/html,x)');
    expect(out).not.toContain('<a');
    expect(out).toContain('눌러');
  });

  it('raw HTML·그림은 요소가 되지 않는다', () => {
    const out = html(
      '<script>alert(1)</script> <b>굵게</b> ![x](https://a/b.png)',
    );
    expect(out).not.toMatch(/<(script|b|img)[\s>]/);
    expect(out).toContain('&lt;script&gt;');
  });

  it('옛 일반 텍스트 공지: 줄바꿈 한 번이 그대로 남고, ~·<·[]가 깨지지 않는다', () => {
    const old =
      '[안내] 3~4분 걸려요 <꼭>\n둘째 줄\n\n보호자님께\n- 긴 항목,\n  이어지는 줄\n- 다음';
    const out = html(old);
    expect(out).toContain('[안내] 3~4분 걸려요 &lt;꼭&gt;\n둘째 줄');
    expect(out).not.toContain('<del');
    expect(out).toContain('긴 항목,\n이어지는 줄');
    expect(out).toMatch(/<p[^>]*whitespace-pre-line/);
    // 목록 항목 안에 블록 사이 "\n"이 남으면 pre-line에서 빈 줄이 된다
    expect(out).not.toMatch(/<li[^>]*>\n/);
  });
});

describe('noticePreview', () => {
  it('목록 카드 미리보기에서 마크다운 기호를 뺀다', () => {
    expect(
      noticePreview('### 소제목\n**굵게** [주소](https://a.b) <https://c.d>'),
    ).toBe('소제목\n굵게 주소 https://c.d');
  });
});
