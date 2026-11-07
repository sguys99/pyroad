import { LandingSection } from '../LandingSection';
import './parents.css';

/**
 * 랜딩 `#parents` 섹션 — 자리 표시(stub, P4-01 뼈대). 담당: P4-07 보호자 섹션: 안전 원칙 · 커리큘럼 로드맵 · 학습 효과 (존댓말, 사실만).
 *
 * 연결 규칙:
 * - 앵커 id `parents`는 바꾸지 않는다 (헤더·히어로 바로가기와 e2e가 가리킴). 제목 id는 `parents-title`
 * - 틀은 `LandingSection`(여백·kicker·제목·설명·scroll-margin). 이 섹션 전용 스타일은 옆의 `parents.css`에만,
 *   클래스 접두사는 `ld-parents-`. 하위 컴포넌트는 `sections/parents/` 폴더에
 * - 무거운 연출·모듈은 `WhenVisible`(또는 `useInView`) + `next/dynamic`으로 화면에 들어올 때 불러온다
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function ParentsSection() {
  return (
    <LandingSection
      id="parents"
      tone="surface"
      kicker="보호자께"
      title="아이가 안심하고 배우도록 만들었어요"
    />
  );
}
