/**
 * 랜딩 아래쪽 섹션 CSS 묶음 + 히어로 장식 연출 (P4-12). 첫 화면(헤더·히어로·30초 체험) 밖이라 렌더 차단 CSS(예산 15KB gzip, §2.10)에서 빼고,
 * `deferredCss.ts`가 하이드레이션 즈음 동적 import로 받는다 → Turbopack이 이 CSS를 따로 묶어 `<link>`로 붙인다.
 *
 * 섹션을 여기 더하면 그 섹션 컴포넌트에서는 CSS를 import하지 않고 `<LandingSection deferredCss="<이름>">`을 주며,
 * CSS 맨 앞에 `[data-deferred-css='<이름>'] { --ld-css: visible; }`를 둔다 (landing.css "늦게 오는 섹션 CSS")
 */
// 히어로의 반복 장식 연출·반짝이 (첫 페인트에 필요 없음)
import './hero/hero-ambient.css';
import './sections/worlds.css';
import './sections/fun.css';
import './sections/friends.css';
import './sections/parents.css';
import './sections/faq.css';

export const DEFERRED_SECTIONS = [
  'worlds',
  'fun',
  'friends',
  'parents',
  'faq',
] as const;
