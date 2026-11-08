import { LandingSection } from '../LandingSection';
import { FunShowcase } from './fun/FunShowcase';
import { FUN_SCENES } from './fun/funData';
import './fun.css';

/**
 * 랜딩 `#fun` 재미 요소 쇼케이스 (P4-05): 레벨 · 코인 · 꾸미기 · 자랑하기 · 보스 배틀을 짧은 장면(약 3초)으로 보여 준다.
 * 아직 없는 기능은 "곧 열려요" 배지(§12-Q42) — `fun/funData.ts`의 `soon` 플래그 한 곳에서 끈다.
 *
 * - 제목·설명·배지는 서버 HTML. 장면 그림은 화면 근처에서 받는다(`fun/scenes.tsx`, HUD·보상 아이콘·리그 재사용)
 * - 재생 순서(화면 안 장면만 하나씩)와 연출 단계는 `fun/FunShowcase.tsx`, 스타일은 옆의 `fun.css`(접두사 `ld-fun-`)
 * - 앵커 id `fun`·제목 id `fun-title`은 바꾸지 않는다
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function FunShowcaseSection() {
  return (
    <LandingSection
      id="fun"
      kicker="퀘스트 말고도 재미가 가득"
      title="모험이 더 신나는 이유"
      lead="'곧 열려요'는 지금 만들고 있는 기능이에요."
      className="ld-fun"
    >
      <FunShowcase scenes={FUN_SCENES} />
    </LandingSection>
  );
}
