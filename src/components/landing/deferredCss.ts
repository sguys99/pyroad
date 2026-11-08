/**
 * 랜딩 아래쪽 섹션 CSS를 늦게 받는다 (P4-12, `deferredStyles.ts`). 브라우저에서만 부른다.
 * 한 번만 받고, 실패하면(오프라인 등) 다음에 다시 시도한다.
 */
let loading: Promise<void> | null = null;
let ready = false;

export function loadDeferredCss(): Promise<void> {
  loading ??= import('./deferredStyles').then(
    () => {
      ready = true;
    },
    (e: unknown) => {
      loading = null;
      throw e;
    },
  );
  return loading;
}

/** 아래쪽 섹션 CSS가 이미 붙었나 */
export function deferredCssReady(): boolean {
  return ready;
}

/** `id` 요소가 늦게 오는 CSS 섹션 안에 있나 (바로가기가 CSS를 기다려야 하는지) */
export function needsDeferredCss(el: Element | null): boolean {
  return !ready && !!el?.closest('[data-deferred-css]');
}
