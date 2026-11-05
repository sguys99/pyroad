/**
 * 캐릭터 SVG의 반복 연출 클래스 (P2-15). 예전 SVG SMIL(`<animate>`)을 CSS transform·opacity로 옮겼다 (§2.10: SMIL 금지).
 * 언제 도는지는 globals.css가 `<html data-motion data-reduced>`로 정한다:
 * - 눈 깜빡임 `char-blink-eye`(scaleY)·`char-blink-highlight`(opacity): full·lite 보통, 동작 줄이기는 느리게(§12-Q26), minimal 끔
 * - 반짝임 `char-twinkle`: 대기 루프 (full·lite)
 * 정식 리그(P2-13)가 오면 리그의 깜빡임 레이어로 바뀐다.
 */
export const BLINK_EYE = 'char-blink-eye';
export const BLINK_HIGHLIGHT = 'char-blink-highlight';

/** 투명도 왕복 반짝임. from → to → from, dur초 */
export function twinkle(
  from: number,
  to: number,
  dur: number,
): { className: string; style: React.CSSProperties } {
  return {
    className: 'char-twinkle',
    style: {
      '--twinkle-from': from,
      '--twinkle-to': to,
      '--twinkle-dur': `${dur}s`,
    } as React.CSSProperties,
  };
}
