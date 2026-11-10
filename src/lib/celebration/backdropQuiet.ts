// 축하 오버레이가 떠 있는 동안 뒤 화면을 조용히 (P6-13, §2.10). 덮개 뒤에서 도는 라이브 리그(이야기 쪽 파이뱀·버그버그)와
// CSS 반복 연출이 카드 연출과 메인 스레드를 나눠 쓰지 않게 한다.
// - 라이브 리그(`LiveRig`)는 이 값을 구독해 엔진을 멈춘다. 오버레이 안(`[data-celebration-root]`)의 리그는 그대로
// - CSS는 `<html data-celebrating>`으로 퀘스트 책 펼침 안 애니메이션을 멈춘다 (celebrations/celebration.css)

let quiet = false;
const subscribers = new Set<() => void>();

export function setBackdropQuiet(next: boolean): void {
  if (quiet === next) return;
  quiet = next;
  if (typeof document !== 'undefined')
    document.documentElement.toggleAttribute('data-celebrating', next);
  subscribers.forEach((fn) => fn());
}

export function isBackdropQuiet(): boolean {
  return quiet;
}

export function subscribeBackdropQuiet(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
