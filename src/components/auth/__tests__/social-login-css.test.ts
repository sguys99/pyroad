import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// 소셜 로그인 버튼 CSS (P3-05): 브랜드 가이드 값이 그대로인지, 연출 단계 분기가 있는지. jsdom은 CSS를 계산하지 않아 글자로 본다.
// 가이드 확인 기록은 social-login.css 머리 주석과 docs/design/components.md §12

const CSS = readFileSync(join(__dirname, '../social-login.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ');

function rule(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`규칙 없음: ${selector}`);
  const open = CSS.indexOf('{', at);
  return CSS.slice(open + 1, CSS.indexOf('}', open));
}

/** WCAG 상대 휘도 대비 */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('social-login.css 브랜드 값', () => {
  it('카카오: 컨테이너 #FEE500 · 레이블 #000000 85% · radius 12px', () => {
    const k = rule(".g-social[data-provider='kakao']");
    expect(k).toContain('--social-bg: #fee500');
    expect(k).toContain('--social-fg: rgb(0 0 0 / 0.85)');
    expect(rule('.g-social')).toContain('--social-r: 12px');
  });

  it('네이버: 배경 #03A94D(2025 갱신, 예전 #03C75A) · 로고·레이블 #FFFFFF', () => {
    const n = rule(".g-social[data-provider='naver']");
    expect(n).toContain('--social-bg: #03a94d');
    expect(n).toContain('--social-fg: #ffffff');
  });

  it('Google 밝은 테마: 면 #FFFFFF · 1px 안쪽 테두리 #747775 · 글자 #1F1F1F', () => {
    const g = rule(".g-social[data-provider='google']");
    expect(g).toContain('--social-bg: #ffffff');
    expect(g).toContain('--social-stroke: #747775');
    expect(g).toContain('--social-fg: #1f1f1f');
    expect(rule('.g-social')).toContain(
      'box-shadow: inset 0 0 0 var(--line-w) var(--social-stroke)',
    );
  });

  it('글자 대비: 카카오·Google은 AA(4.5), 네이버 흰 글자는 큰 글자 AA(3.0) → 19px 굵게', () => {
    // 카카오 85% 검정을 노랑 위에 합성한 색 (각 채널 × 0.15)
    const kakaoLabel =
      '#' +
      [0xfe, 0xe5, 0x00]
        .map((c) =>
          Math.round(c * 0.15)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
    expect(contrast(kakaoLabel, '#fee500')).toBeGreaterThan(4.5);
    expect(contrast('#1f1f1f', '#ffffff')).toBeGreaterThan(4.5);
    const naver = contrast('#ffffff', '#03a94d');
    expect(naver).toBeGreaterThan(3);
    expect(naver).toBeLessThan(4.5);
    const base = rule('.g-social');
    expect(base).toContain('font-size: var(--text-h3)'); // 19px ≥ 18.67px(14pt)
    expect(base).toContain('font-weight: 700');
  });

  it('높이 54px(터치 48px 이상)', () => {
    expect(rule('.g-social')).toContain('min-height: 3.375rem');
  });
});

describe('social-login.css 연출 단계', () => {
  it('누름은 1px 내려앉음, minimal은 전환 없음, 동작 줄이기는 움직임 0', () => {
    expect(
      rule(
        '.g-social:is(:active, [data-pressed]):not(:disabled):not([data-loading])',
      ),
    ).toContain('translateY(1px)');
    expect(CSS).toContain(
      ":root[data-motion='minimal'] .g-social, :root[data-motion='minimal'] .g-social::after { transition: none; }",
    );
    const reduced = CSS.slice(
      CSS.indexOf(":root[data-reduced='true'] .g-social,"),
    );
    expect(reduced.slice(0, reduced.indexOf('}'))).toContain('transform: none');
  });
});

describe('최근 로그인 이름표 (P3-08)', () => {
  it('금색 알약 + 흰 테두리, 등장은 단계별 (동작 줄이기는 없음)', () => {
    const r = rule('.g-social-recent');
    expect(r).toContain('background: var(--accent)');
    expect(r).toContain('color: var(--on-accent)');
    expect(r).toContain('font-size: var(--text-caption)'); // 14px 미만 금지
    expect(r).toContain('var(--spring-prop)');
    expect(rule(":root[data-motion='minimal'] .g-social-recent")).toContain(
      'g-fade-in',
    );
    expect(rule(":root[data-reduced='true'] .g-social-recent")).toContain(
      'animation: none',
    );
  });
});
