/**
 * 랜딩용 설치 띠 막기 (P4-12, P4-11 남은 일). 루트 레이아웃이 모든 화면에 매니페스트를 붙이므로 안드로이드 Chrome은
 * 비로그인 방문자에게도 랜딩에서 자동 설치 띠(mini-infobar)를 띄울 수 있다. 설치 안내는 로그인 뒤에만 하기로 했으므로
 * (`InstallPromptCatcher`·월드맵 쪽지) 랜딩에서는 `beforeinstallprompt`의 기본 동작만 막는다.
 *
 * 하이드레이션 전에 이벤트가 올 수 있어 React 효과가 아니라 랜딩 HTML의 인라인 스크립트로 둔다(약 90바이트, JS 번들 0).
 * 랜딩은 정적 CSP(`'unsafe-inline'`)라 그대로 돈다. 로그인 화면은 OAuth를 거쳐 새로 불러오므로 영향이 없다.
 */
export const LANDING_INSTALL_GUARD_SCRIPT =
  "addEventListener('beforeinstallprompt',function(e){e.preventDefault()})";
