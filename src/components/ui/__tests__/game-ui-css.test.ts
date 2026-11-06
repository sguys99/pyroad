import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// 공통 컴포넌트 CSS (P2-11)의 연출 단계 분기 계약. jsdom은 CSS를 계산하지 않으므로 규칙이 있는지를 글자로 확인한다.
// 단계표: docs/design/components.md "모션 단계별 동작"

const CSS = readFileSync(join(__dirname, '../game-ui.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ');

/** selector { … } 블록 본문 (첫 번째) */
function rule(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`규칙 없음: ${selector}`);
  const open = CSS.indexOf('{', at);
  return CSS.slice(open + 1, CSS.indexOf('}', open));
}

describe('game-ui.css 연출 단계', () => {
  it('globals.css가 컴포넌트 CSS를 불러온다', () => {
    const globals = readFileSync(
      join(__dirname, '../../../app/globals.css'),
      'utf8',
    );
    expect(globals).toContain("@import '../components/ui/game-ui.css'");
  });

  it('버튼: 누르면 아랫면(--lip-h)만큼 내려가고, 복귀는 jellyB · lite face · minimal 즉시', () => {
    expect(
      rule(
        ".g-btn:is(:active, [data-pressed]):not(:disabled):not([data-loading]):not( [data-variant='ghost'] ) .g-btn-face",
      ),
    ).toContain('translateY(var(--lip-h))');
    expect(rule('.g-btn-face')).toContain('var(--spring-jelly-b)');
    expect(rule(":root[data-motion='lite'] .g-btn-face")).toContain(
      'var(--spring-face)',
    );
    expect(rule(":root[data-motion='minimal'] .g-btn-face")).toContain(
      'transition: none',
    );
  });

  it('버튼 동작 줄이기: 움직이지 않고 눌림 면 색(--press)으로만', () => {
    expect(rule(":root[data-reduced='true'] .g-btn .g-btn-face")).toContain(
      'transform: none',
    );
    expect(
      rule(
        ":root[data-reduced='true'] .g-btn:is(:active, [data-pressed]):not(:disabled):not([data-loading]) .g-btn-face",
      ),
    ).toContain('background: var(--press)');
    // 올려놓기·누름 규칙보다 명시도가 높은 움직임 0 규칙 (P2-12)
    expect(
      rule(
        ":root[data-reduced='true'] .g-btn:is(:hover, :active, [data-pressed]):not(:disabled):not( [data-loading] ) .g-btn-face",
      ),
    ).toContain('transform: none');
  });

  it('모달·시트·덮개·툴팁: 동작 줄이기는 전환 없음, minimal은 페이드만', () => {
    expect(
      rule(
        ":root[data-reduced='true'] :is(.g-modal, .g-sheet, .g-scrim, .g-tooltip)",
      ),
    ).toContain('transition: none');
    expect(
      rule(":root[data-motion='minimal'] :is(.g-modal, .g-sheet)"),
    ).toContain('transition: opacity var(--dur-fade)');
    expect(rule('.g-scrim')).toContain('background: var(--scrim)');
  });

  it('토스트: full body 스프링, lite 짧게, minimal 페이드, 동작 줄이기 없음', () => {
    expect(rule('.g-toast')).toContain('box-shadow: var(--elev-pop)');
    expect(CSS).toContain(
      'animation: g-toast-in var(--spring-body-dur) var(--spring-body) both',
    );
    expect(rule(":root[data-motion='minimal'] .g-toast")).toContain(
      'g-fade-in',
    );
    expect(rule(":root[data-reduced='true'] .g-toast")).toContain(
      'animation: none',
    );
  });

  it('진행바·탭: transform만 움직이고 동작 줄이기에서 멈춘다', () => {
    expect(rule('.g-prog-fill')).toContain('scaleX(var(--g-prog, 0))');
    expect(rule(":root[data-reduced='true'] .g-prog-fill")).toContain(
      'transition: none',
    );
    expect(rule('.g-seg-thumb')).toContain('translateX(');
    expect(
      rule(
        ":root:is([data-motion='minimal'], [data-reduced='true']) :is(.g-seg-thumb, .g-seg-tab)",
      ),
    ).toContain('transition: none');
  });

  it('반복 연출은 말풍선 커서(바쁨 표시) 하나뿐이고 동작 줄이기에서 꺼진다', () => {
    const infinite = CSS.match(/[^{}]*\{[^{}]*infinite[^{}]*\}/g) ?? [];
    expect(infinite).toHaveLength(1);
    expect(infinite[0]).toContain(":root[data-reduced='false'] .g-caret");
  });

  it('색 리터럴 없이 토큰 변수만 (tokens:check와 같은 기준)', () => {
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(CSS).not.toMatch(/\brgba?\(/);
  });
});
