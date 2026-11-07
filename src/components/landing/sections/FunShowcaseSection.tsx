import { LandingSection } from '../LandingSection';
import './fun.css';

/**
 * 랜딩 `#fun` 섹션 — 자리 표시(stub, P4-01 뼈대). 담당: P4-05 재미 요소 쇼케이스 (Q42: 아직 없는 기능은 "곧 열려요" 배지, 데이터 플래그 한 곳).
 *
 * 연결 규칙:
 * - 앵커 id `fun`는 바꾸지 않는다 (헤더·히어로 바로가기와 e2e가 가리킴). 제목 id는 `fun-title`
 * - 틀은 `LandingSection`(여백·kicker·제목·설명·scroll-margin). 이 섹션 전용 스타일은 옆의 `fun.css`에만,
 *   클래스 접두사는 `ld-fun-`. 하위 컴포넌트는 `sections/fun/` 폴더에
 * - 무거운 연출·모듈은 `WhenVisible`(또는 `useInView`) + `next/dynamic`으로 화면에 들어올 때 불러온다
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function FunShowcaseSection() {
  return (
    <LandingSection
      id="fun"
      kicker="퀘스트 말고도 재미가 가득"
      title="모험이 더 신나는 이유"
    />
  );
}
