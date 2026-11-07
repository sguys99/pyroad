import { LandingSection } from '../LandingSection';
import './friends.css';

/**
 * 랜딩 `#friends` 섹션 — 자리 표시(stub, P4-01 뼈대). 담당: P4-06 캐릭터 소개: 파이뱀 · 버그버그 · 별똥이.
 *
 * 연결 규칙:
 * - 앵커 id `friends`는 바꾸지 않는다 (헤더·히어로 바로가기와 e2e가 가리킴). 제목 id는 `friends-title`
 * - 틀은 `LandingSection`(여백·kicker·제목·설명·scroll-margin). 이 섹션 전용 스타일은 옆의 `friends.css`에만,
 *   클래스 접두사는 `ld-friends-`. 하위 컴포넌트는 `sections/friends/` 폴더에
 * - 무거운 연출·모듈은 `WhenVisible`(또는 `useInView`) + `next/dynamic`으로 화면에 들어올 때 불러온다
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function FriendsSection() {
  return (
    <LandingSection
      id="friends"
      kicker="함께하는 친구들"
      title="함께 모험할 세 친구"
    />
  );
}
