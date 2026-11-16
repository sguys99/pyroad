// 브라우저 키 → get_key()가 돌려주는 이름 (P11-04). CPython turtle `onkey`와 같은 Tk 이름을 쓴다(world3.md 3-6):
// 화살표 'Left' 'Right' 'Up' 'Down', 스페이스 'space', 엔터 'Return', 글자·숫자는 그 글자('a', 'A', '1').

const NAMED: Record<string, string> = {
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ' ': 'space',
  Enter: 'Return',
};

/** 게임으로 보낼 키 이름. 보내지 않을 키(Tab·Esc·단축키 조합 등)는 null */
export function tkKeyName(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (NAMED[e.key]) return NAMED[e.key];
  return /^[a-zA-Z0-9]$/.test(e.key) ? e.key : null;
}

/** 이 요소에서 누른 키는 게임으로 가로채지 않는다: 글자 칸·에디터·슬라이더 등. 스페이스·엔터는 버튼도 (누르기 동작) */
export function keepsKey(target: EventTarget | null, name: string): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
    )
  )
    return true;
  return (
    (name === 'space' || name === 'Return') &&
    !!target.closest('button, a[href], [role="button"]')
  );
}
