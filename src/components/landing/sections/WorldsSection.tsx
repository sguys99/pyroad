import { LandingSection } from '../LandingSection';
import { WorldsMap } from './worlds/WorldsMap';
import { countWorldContent } from './worlds/worldStats';
import { WORLD_PREVIEWS } from './worlds/worldsData';
// 스타일 `worlds.css`는 여기서 import하지 않는다: 첫 화면 밖이라 렌더 차단 CSS에서 빼고 `../deferredCss.ts`가 늦게 받는다 (P4-12)

/**
 * 랜딩 `#worlds` 세계관 섹션 (P4-04): 월드 1·2·3 미리보기 — 스크롤에 맞춰 두루마리 지도가 펼쳐진다.
 * 이름은 §12-Q40("월드 1 · 파이썬 섬", "월드 2 · 코드 바다", "월드 3 · 메이커 시티"), 해제 조건은 Q2.
 *
 * - 서버 컴포넌트. 월드 1의 스테이지·퀘스트 수는 빌드 때 `content/`에서 센다(정답은 읽지 않음, worldStats.ts)
 * - 지도·연출은 `worlds/WorldsMap.tsx`, 스타일은 옆의 `worlds.css`(접두사 `ld-worlds-`)
 * - 앵커 id `worlds`는 바꾸지 않는다 (헤더·히어로 바로가기와 e2e가 가리킴). 제목 id는 `worlds-title`
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function WorldsSection() {
  const stats = countWorldContent(1);
  return (
    <LandingSection
      id="worlds"
      deferredCss="worlds"
      kicker="한 월드씩 열리는 모험"
      title="세 개의 월드가 기다려요"
      lead="파이썬 섬에서 출발해 바다를 건너 도시까지! 지도는 한 월드씩 펼쳐져요."
      className="ld-worlds"
    >
      <WorldsMap worlds={WORLD_PREVIEWS} stats={stats} />
    </LandingSection>
  );
}
