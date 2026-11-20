import { describe, expect, it } from 'vitest';
import { checkCss, checkSource, scan } from '../check-tokens.mjs';

const rules = (rel: string, code: string) =>
  checkSource(rel, code).violations.map((v: { rule: string }) => v.rule);

describe('토큰 하드코딩 검사 (P2-09)', () => {
  it('지금 src/에 위반이 없다 (npm run tokens:check와 같은 결과)', () => {
    const violations = scan().flatMap(
      (r: { rel: string; violations: { line: number; rule: string }[] }) =>
        r.violations.map((v) => `${r.rel}:${v.line} ${v.rule}`),
    );
    expect(violations).toEqual([]);
  });

  it('색 리터럴과 고정 팔레트 클래스를 잡는다', () => {
    const f = 'src/components/X.tsx';
    expect(rules(f, `const a = <div style={{ color: '#31983d' }} />;`)).toEqual(['color']);
    expect(rules(f, `const a = <div className="bg-amber-50 text-amber-800" />;`)).toEqual(['color']);
    expect(rules(f, `const a = <div className="hover:bg-white/80" />;`)).toEqual(['color']);
    expect(rules(f, 'const a = `oklch(0.6 0.16 145)`;')).toEqual(['color']);
    expect(rules(f, `const a = 'bg-[rgba(0,0,0,0.5)]';`)).toEqual(['color']);
    // 토큰 클래스·변수는 통과
    expect(rules(f, `const a = <div className="bg-warning-soft text-warning border-accent/50" />;`)).toEqual([]);
    expect(rules(f, `const a = { background: 'var(--primary-bright)' };`)).toEqual([]);
    // 주석·화면 글자·URL 조각은 보지 않는다
    expect(rules(f, `// 수정 PR #2579\nconst a = <p>1번 #123 문제</p>;`)).toEqual([]);
  });

  it('장식 전용 토큰을 글자색으로 쓰면 잡는다', () => {
    const f = 'src/components/X.tsx';
    expect(rules(f, `const a = 'text-primary font-bold';`)).toEqual(['misuse']);
    expect(rules(f, `const a = 'hover:text-accent';`)).toEqual(['misuse']);
    expect(rules(f, `const a = 'text-primary-text text-primary-foreground text-accent-text';`)).toEqual([]);
  });

  it('글꼴·모션 직접 지정을 잡는다 (모션은 컴포넌트·앱만)', () => {
    const f = 'src/components/X.tsx';
    expect(rules(f, `const a = <text fontFamily="monospace" />;`)).toEqual(['font']);
    expect(rules(f, `const a = { fontFamily: 'var(--font-mono)' };`)).toEqual([]);
    expect(rules(f, `const t = { duration: 0.3, ease: 'easeOut' };`)).toEqual(['motion', 'motion']);
    expect(rules(f, `const t = { type: 'spring', stiffness: 400, damping: 17 };`)).toEqual(['motion', 'motion']);
    expect(rules(f, `const t = { duration: 1.5 * k };`)).toEqual(['motion']);
    expect(rules(f, `const a = 'transition-all duration-300';`)).toEqual(['motion']);
    expect(rules(f, `const t = { duration: 0 };`)).toEqual([]);
    expect(rules(f, `const t = { duration: sec('base'), ease: EASE.out };`)).toEqual([]);
    expect(rules(f, `const a = 'duration-(--dur-fast)';`)).toEqual([]);
    expect(rules('src/lib/foo.ts', `const t = { duration: 0.3 };`)).toEqual([]);
  });

  it('허용 목록과 tokens-allow 주석', () => {
    expect(rules('src/components/characters/rig/pybaem/Markup.tsx', `const c = '#9CCB80';`)).toEqual([]);
    expect(
      rules(
        'src/components/LoginKakao.tsx',
        `// tokens-allow: 카카오 브랜드 가이드 색\nconst KAKAO = '#FEE500';`,
      ),
    ).toEqual([]);
  });

  it('14px 미만 글자 개수를 센다', () => {
    const f = 'src/components/X.tsx';
    expect(checkSource(f, `const a = 'text-xs text-[11px] text-[14px] text-[0.8rem] text-caption';`).smallText).toBe(3);
  });

  it('CSS: 사용자 정의 속성 밖의 색 리터럴만 잡는다', () => {
    const css = `:root { --primary: #3E7B3A; }\n.a { color: var(--primary); }\n.b { box-shadow: 0 0 4px rgba(0, 0, 0, 0.2); }\n/* #fff 주석 */`;
    const v = checkCss('src/app/x.css', css).violations;
    expect(v.map((x: { line: number; rule: string }) => [x.line, x.rule])).toEqual([[3, 'color']]);
  });

  it('CSS: 측면 색 띠를 잡는다 (P13-07)', () => {
    const stripes = (css: string) =>
      checkCss('src/app/x.css', css)
        .violations.filter((x: { rule: string }) => x.rule === 'stripe')
        .map((x: { line: number }) => x.line);
    // 위반: 한쪽 안쪽 그림자(px·rem·음수), 좁은 ::before 세로 띠, 굵은 색 옆 테두리
    expect(stripes(`.a { box-shadow: inset 3px 0 0 var(--primary); }`)).toEqual([1]);
    expect(stripes(`.a { box-shadow: var(--elev-card), inset -0.25rem 0 0 var(--caution); }`)).toEqual([1]);
    expect(
      stripes(`.a::before {\n  content: '';\n  position: absolute;\n  inset: 0 auto 0 0;\n  width: 0.375rem;\n  background: var(--world);\n}`),
    ).toEqual([5]);
    expect(stripes(`.a::after { top: 0; bottom: 0; width: 6px; background-color: var(--accent); }`)).toEqual([1]);
    expect(stripes(`.a { border-left: 0.375rem solid var(--primary-bright); }`)).toEqual([1]);
    expect(stripes(`.a {\n  border-inline-start: 4px solid var(--accent);\n  border-right-width: 2px;\n}`)).toEqual([2, 3]);
    // 허용: 턱·테두리 고리 그림자, 1px 구분선, 투명 테두리(삼각형), 넓거나 떠 있는 의사 요소, 사유를 적은 줄
    const ok = [
      `.a { box-shadow: inset 0 -3px 0 var(--surface-lip); }`,
      `.a { box-shadow: inset 0 0 0 2px var(--accent); }`,
      `.a { box-shadow: inset 2px 0 0 1px var(--line); }`,
      `.a { border-left: var(--line-w) solid var(--line); border-right: 1px solid var(--line); }`,
      `.a { border-left: 6px solid transparent; border-right: 0; }`,
      `.a::before { inset: 0; width: 3rem; background: var(--world); }`,
      `.a::before { top: -0.1875rem; bottom: -0.1875rem; width: 0.5rem; background: var(--w3); }`,
      `.a {\n  /* tokens-allow: 코드 들여쓰기 안내선 */\n  border-left: 2px dashed var(--line-strong);\n}`,
    ];
    for (const css of ok) expect(stripes(css), css).toEqual([]);
  });
});
