import { LandingSection } from '../LandingSection';
import './trial.css';

/**
 * 랜딩 `#try` 섹션 — 자리 표시(stub, P4-01 뼈대). 담당: P4-03 30초 체험 + P4-02 라이브 데모(Q41·Q43: JS 미니 해석기, 화면에 들어오면 print("안녕!") 타이핑).
 *
 * 연결 규칙:
 * - 앵커 id `try`는 바꾸지 않는다 (헤더·히어로 바로가기와 e2e가 가리킴). 제목 id는 `try-title`
 * - 틀은 `LandingSection`(여백·kicker·제목·설명·scroll-margin). 이 섹션 전용 스타일은 옆의 `trial.css`에만,
 *   클래스 접두사는 `ld-trial-`. 하위 컴포넌트는 `sections/trial/` 폴더에
 * - 무거운 연출·모듈은 `WhenVisible`(또는 `useInView`) + `next/dynamic`으로 화면에 들어올 때 불러온다
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function TrialSection() {
  return (
    <LandingSection
      id="try"
      kicker="로그인 없이 30초"
      title="첫 주문을 걸어 봐요"
    />
  );
}
