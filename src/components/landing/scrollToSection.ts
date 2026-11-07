/**
 * 랜딩 바로가기 (P4-01): `#id` 섹션으로 스크롤하고 그 섹션 제목에 포커스를 옮긴다(키보드·낭독기 사용자도 같은 곳으로).
 * 동작 줄이기면 즉시, 아니면 부드럽게. 주소에는 `#id`를 남긴다(뒤로 가기·공유).
 * 고정 헤더만큼의 여백은 CSS `scroll-margin-top`(landing.css `.ld-sec`)이 맡는다.
 *
 * @returns 섹션을 찾았는지 (못 찾으면 부르는 쪽이 기본 앵커 동작을 그대로 두면 된다)
 */
export function scrollToSection(id: string, reduced: boolean): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  const focusTarget =
    el.querySelector<HTMLElement>('h2[tabindex="-1"]') ??
    (el.tabIndex >= 0 ? el : null);
  focusTarget?.focus({ preventScroll: true });
  try {
    if (window.location.hash !== `#${id}`) {
      window.history.pushState(window.history.state, '', `#${id}`);
    }
  } catch {
    // 주소를 못 바꿔도 스크롤은 했다
  }
  return true;
}
