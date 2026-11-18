/**
 * 지도 노드가 보이게 스크롤 (B97 들어올 때 자리 잡기 · B124 잠금 해제 연출이 같이 씀).
 * 넓은 지도가 위에 붙는 HUD(`.wh`) 아래 한 화면에 다 들어가면 지도 위 끝을 HUD 밑 16px에 맞추고,
 * 아니면(360·768 세로 지도) 노드를 가운데로 — 가운데 맞추기만 하면 넓은 지도 위쪽·높은 단계 이름표가 HUD 밑에 잘림
 */
export function scrollMapTo(
  map: Element,
  node: Element,
  behavior: ScrollBehavior,
): void {
  const hud =
    document.querySelector('.wh')?.getBoundingClientRect().bottom ?? 0;
  const m = map.getBoundingClientRect();
  const gap = 16;
  if (m.height + gap * 2 <= window.innerHeight - hud)
    window.scrollBy({ top: m.top - hud - gap, behavior });
  else node.scrollIntoView({ block: 'center', behavior });
}
