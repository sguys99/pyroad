import { describe, expect, it } from 'vitest';
import {
  DEMO_CODE,
  DEMO_SPEED,
  buildDemoScript,
  composeSteps,
  scriptDuration,
} from '../demoScript';

describe('composeSteps (두벌식 조합 모양)', () => {
  it('받침 있는 음절은 초성 → 초성+중성 → 완성', () => {
    expect(composeSteps('안')).toEqual(['ㅇ', '아', '안']);
    expect(composeSteps('녕')).toEqual(['ㄴ', '녀', '녕']);
  });
  it('받침 없는 음절은 두 단계, 한글이 아니면 그대로', () => {
    expect(composeSteps('하')).toEqual(['ㅎ', '하']);
    expect(composeSteps('뱀')).toEqual(['ㅂ', '배', '뱀']);
    expect(composeSteps('!')).toEqual(['!']);
    expect(composeSteps('p')).toEqual(['p']);
  });
});

describe('buildDemoScript', () => {
  const frames = buildDemoScript();
  const typed = frames.filter((f) => f.phase === 'type');

  it('빈 공책에서 시작해 완성된 주문으로 끝난다', () => {
    expect(frames[0]).toMatchObject({ phase: 'ready', code: '', caret: 0 });
    const last = frames.at(-1)!;
    expect(last).toMatchObject({
      phase: 'turn',
      code: DEMO_CODE,
      caret: DEMO_CODE.length,
    });
    expect(frames.map((f) => f.phase).slice(-3)).toEqual([
      'press',
      'out',
      'turn',
    ]);
  });

  it('여는 괄호·따옴표를 치면 닫는 짝이 커서 뒤에 생긴다', () => {
    const codes = typed.map(
      (f) => `${f.code.slice(0, f.caret)}|${f.code.slice(f.caret)}`,
    );
    expect(codes).toContain('print(|)');
    expect(codes).toContain('print("|")');
    // 한글 조합 순서
    expect(codes).toEqual(
      expect.arrayContaining([
        'print("ㅇ|")',
        'print("아|")',
        'print("안|")',
        'print("안ㄴ|")',
        'print("안녀|")',
        'print("안녕|")',
        'print("안녕!|")',
      ]),
    );
    // 닫는 글자는 새로 쓰지 않고 지나간다
    expect(codes).toContain('print("안녕!"|)');
    expect(codes).toContain('print("안녕!")|');
    expect(typed.every((f) => !f.code.includes('"")"'))).toBe(true);
  });

  it('작은따옴표 주문도 짝을 맞춰 친다', () => {
    const last = buildDemoScript("print('hi')").at(-1)!;
    expect(last.code).toBe("print('hi')");
  });

  it('박자는 매번 같고(고정 시드) lite는 더 빠르다', () => {
    expect(buildDemoScript()).toEqual(frames);
    const full = scriptDuration(frames);
    const lite = scriptDuration(
      buildDemoScript(DEMO_CODE, { speed: DEMO_SPEED.lite }),
    );
    expect(full).toBeGreaterThan(3000);
    expect(full).toBeLessThan(6500);
    expect(lite).toBeLessThan(full * 0.5);
    expect(frames.every((f, i) => i === 0 || f.ms >= 16)).toBe(true);
  });
});
