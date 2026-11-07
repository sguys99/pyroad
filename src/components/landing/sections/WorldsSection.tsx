import { LandingSection } from '../LandingSection';
import './worlds.css';

/**
 * 랜딩 `#worlds` 섹션 — 자리 표시(stub, P4-01 뼈대). 담당: P4-04 세계관: 월드 1·2·3 미리보기 (Q40: 월드 1 · 파이썬 섬, 월드 2 · 코드 바다, 월드 3 · 메이커 시티).
 *
 * 연결 규칙:
 * - 앵커 id `worlds`는 바꾸지 않는다 (헤더·히어로 바로가기와 e2e가 가리킴). 제목 id는 `worlds-title`
 * - 틀은 `LandingSection`(여백·kicker·제목·설명·scroll-margin). 이 섹션 전용 스타일은 옆의 `worlds.css`에만,
 *   클래스 접두사는 `ld-worlds-`. 하위 컴포넌트는 `sections/worlds/` 폴더에
 * - 무거운 연출·모듈은 `WhenVisible`(또는 `useInView`) + `next/dynamic`으로 화면에 들어올 때 불러온다
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function WorldsSection() {
  return (
    <LandingSection
      id="worlds"
      kicker="한 월드씩 열리는 모험"
      title="세 개의 월드가 기다려요"
    />
  );
}
