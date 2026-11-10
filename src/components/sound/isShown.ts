/**
 * 이 요소가 지금 화면에 그려져 있는지 (P6-14). 퀘스트 화면은 넓은 화면용·좁은 화면용 결과 쪽지를 둘 다 두고 CSS로 하나를 숨기므로,
 * 숨은 쪽에서 소리가 한 번 더 나지 않게 한다. checkVisibility가 없으면(Safari 17.4 미만) offsetParent로
 */
export function isShown(el: Element | null | undefined): boolean {
  if (!el) return false;
  if (typeof el.checkVisibility === 'function') return el.checkVisibility();
  return (el as HTMLElement).offsetParent !== null;
}
