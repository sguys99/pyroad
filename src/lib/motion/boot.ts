/**
 * 연출 단계 부트 스크립트 (P2-15). 첫 페인트 전에 `<html data-motion data-reduced>`를 붙여
 * 단계가 늦게 적용되며 연출이 튀는 것(최소로·동작 줄이기인데 구름이 잠깐 움직이다 멈춤)을 막는다.
 *
 * - 루트 레이아웃 `<head>`의 인라인 스크립트. 기기 저장소(`browser.ts`의 두 키) + 정적 신호 + `prefers-reduced-motion`으로
 *   `detectMotionTier()`·`resolvePolicy()`와 같은 결과를 낸다 (`__tests__/boot.test.ts`가 같은지 확인)
 * - `window.__pyroadMotionBoot(settings)`를 남겨, 로그인 레이아웃이 서버 설정(`users.settings.motion`)으로 한 번 더 부른다
 *   (새 기기에서도 첫 화면부터 맞음, nonce 스크립트 `MotionBootSync`). 이때 설정 사본도 저장한다
 * - React가 하이드레이션 뒤 같은 값을 다시 쓰므로 실패해도 화면은 동작한다 (속성이 없으면 CSS는 반복 연출을 켜지 않음)
 *
 * CSP (`src/lib/security/csp.ts`): 내용이 고정이라 nonce 정책에는 이 문자열의 **sha256 해시**를 넣는다
 * (루트 레이아웃은 정적 랜딩도 감싸므로 요청마다 nonce를 읽을 수 없다). 정적 정책(랜딩)은 `'unsafe-inline'`이라 그대로 돈다.
 * 한 글자라도 바꾸면 `MOTION_BOOT_SCRIPT_SHA256`을 다시 계산해야 한다 — 테스트가 새 값을 알려 준다.
 * 오래된 브라우저에서도 돌도록 ES5로 쓴다.
 */
export const MOTION_BOOT_SCRIPT =
  '(function(){' +
  'var d=document.documentElement,w=window,n=navigator,T=["full","lite","minimal"],P="pyroad.motion.prefs.v1",M="pyroad.motion.v1";' +
  'function mm(q){try{return !!(w.matchMedia&&w.matchMedia(q).matches)}catch(e){return false}}' +
  'function rd(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}' +
  'function guess(){var t=0,m=n.deviceMemory,c=n.connection||{},u=n.userAgent||"",' +
  'wk=(/AppleWebKit/.test(u)&&!/Chrome|Chromium|Edg|OPR|SamsungBrowser/.test(u))||/iPad|iPhone|iPod/.test(u)||(n.platform==="MacIntel"&&n.maxTouchPoints>1);' +
  'if(m!==undefined){if(m<=1)t=2;else if(m<=2)t=1}' +
  'if(t<1&&((!wk&&n.hardwareConcurrency&&n.hardwareConcurrency<=2)||c.saveData||c.effectiveType==="2g"||c.effectiveType==="slow-2g"||mm("(prefers-reduced-data: reduce)")))t=1;' +
  'return t}' +
  'function apply(server){' +
  'if(server){try{localStorage.setItem(P,JSON.stringify(server))}catch(e){}}' +
  'var s=server||rd(P)||{},tier=T.indexOf(s.tier)>=0?s.tier:null;' +
  'if(!tier){var g=guess(),st=rd(M);' +
  'if(st&&T.indexOf(st.measured)>g&&typeof st.at==="number"&&Date.now()-st.at<=12096e5&&st.sig===(n.hardwareConcurrency||"-")+"/"+(n.deviceMemory==null?"-":n.deviceMemory))g=T.indexOf(st.measured);' +
  'tier=T[g]}' +
  'var r=s.reduced==="on"||(s.reduced!=="off"&&mm("(prefers-reduced-motion: reduce)"));' +
  'd.setAttribute("data-motion",tier);d.setAttribute("data-reduced",r?"true":"false")}' +
  'w.__pyroadMotionBoot=function(s){try{apply(s)}catch(e){}};' +
  'w.__pyroadMotionBoot(null)' +
  '})()';

/** `MOTION_BOOT_SCRIPT`의 sha256 (base64). CSP `script-src`에 `'sha256-…'`로 들어간다 */
export const MOTION_BOOT_SCRIPT_SHA256 =
  'yT9q5O+xv/ygV9W70MOvcsCKj0rUaQafAiXsPinbIO0=';

/** CSP 소스 표기 */
export const MOTION_BOOT_SCRIPT_CSP_SOURCE = `'sha256-${MOTION_BOOT_SCRIPT_SHA256}'`;

/**
 * 로그인 레이아웃이 서버 설정으로 부트를 다시 부르는 스크립트 본문 (nonce로 허용).
 * 값은 정규화한 enum뿐이라(`normalizeMotionSettings`) `</script>` 같은 글자가 들어갈 수 없다.
 */
export function motionBootSyncScript(settings: {
  tier: string;
  reduced: string;
}): string {
  const json = JSON.stringify({
    tier: settings.tier,
    reduced: settings.reduced,
  }).replace(/</g, '\\u003c');
  return `window.__pyroadMotionBoot&&window.__pyroadMotionBoot(${json})`;
}
