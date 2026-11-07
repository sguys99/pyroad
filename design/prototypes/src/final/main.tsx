// 최종 시안 인터랙티브 프로토타입 (P2-07, 시안 B에서 출발 → 사용자 리뷰 1차·2차 반영)
// 2차: 바탕 질감 없음(단색), 선 얇게(면 + 얕은 깊이), 색은 중립 + 초록 하나 + 금색 하나 — refine.css·tokens.ts
// 화면: #landing 랜딩 · #world 보물지도 · #stage 스테이지 차례(지도 위 바텀시트) · #quest 책 펼침 퀘스트 · #motion 준비 중
import { useLayoutEffect, useRef } from 'react';
import { mountPrototype } from '../shared/app';
import { Landing } from './Landing';
import { World } from './World';
import { Quest } from './Quest';
import { Toasts, pageTurn, paperSlide } from './ui';
import { MotionScreen } from './Signature';
import './base.css';
import './screens.css';
import './motion.css';
import './final.css';
import './refine.css';
import { applyFinalTokens } from './tokens';

const SCREENS = [
  { id: 'landing', label: '랜딩' },
  { id: 'world', label: '월드맵' },
  { id: 'stage', label: '스테이지' },
  { id: 'quest', label: '퀘스트' },
  { id: 'motion', label: '모션' },
] as const;
type Screen = (typeof SCREENS)[number]['id'];

/** 큰 화면 사이를 오갈 때 넘어가는 장의 제목 (책의 장 표지처럼) */
const CHAPTER: Record<Screen, { k: string; t: string }> = {
  landing: { k: 'pyRoad', t: '마법 그림책' },
  world: { k: '1권 · 숲 마을', t: '모험 지도' },
  stage: { k: '1권 · 숲 마을', t: '모험 지도' },
  quest: { k: '1권 · 숲 마을', t: '오늘의 퀘스트' },
  motion: { k: 'P2-05', t: '시그니처 모션' },
};
const ORDER: Screen[] = ['landing', 'world', 'stage', 'quest', 'motion'];

/**
 * 화면 전환 방식 (P2-05, 사용자 리뷰 P2-06에서 다시 정할 수 있게 상수 하나로)
 * - 'chapter'   : 책을 펴고 덮을 때(랜딩 ↔ 책 안 화면)만 페이지 넘김 0.56초, 책 안 이동은 종이 미끄러짐 0.3초 (기본)
 * - 'page-all'  : 모든 큰 화면 이동에 페이지 넘김 (P2-03 처음 버전)
 * - 'slide-all' : 모두 종이 미끄러짐
 */
const SCREEN_TRANSITION: 'chapter' | 'page-all' | 'slide-all' = 'chapter';
const SLIDE_MS = 300;
/** 책을 펴고 덮을 때 페이지 넘김 길이 (1차 160ms 멈춤 + 640ms = 0.8초 → 최종 100 + 460 = 0.56초) */
const PAGE_TURN_MS = 460;
const inBook = (s: Screen) => s !== 'landing';

function App({ screen }: { screen: Screen }) {
  const host = useRef<HTMLDivElement | null>(null);
  const prev = useRef<Screen | null>(null);
  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = screen;
    if (!p || p === screen) return;
    // 지도 ↔ 차례(바텀시트)는 같은 장이라 전환 없음
    const same = (p === 'world' && screen === 'stage') || (p === 'stage' && screen === 'world');
    if (same) return;
    const dir = ORDER.indexOf(screen) >= ORDER.indexOf(p) ? 1 : -1;
    const chapter = inBook(p) !== inBook(screen);
    const turn = SCREEN_TRANSITION === 'page-all' || (SCREEN_TRANSITION === 'chapter' && chapter);
    if (turn) pageTurn(host.current, { dir, kicker: CHAPTER[screen].k, title: CHAPTER[screen].t, fixed: true, ms: PAGE_TURN_MS, hold: 100 });
    else paperSlide(host.current, { dir, ms: SLIDE_MS });
  }, [screen]);

  return (
    <div className="f-app" ref={host}>
      {screen === 'landing' && <Landing />}
      {(screen === 'world' || screen === 'stage') && <World sheet={screen === 'stage'} />}
      {screen === 'quest' && <Quest />}
      {screen === 'motion' && <MotionScreen />}
      <div id="f-layer" className="f-layer" />
      <Toasts />
    </div>
  );
}

mountPrototype<Screen>({
  concept: 'B',
  name: 'pyRoad 최종 시안',
  subtitle: 'P2-07 2차 · 단색 바탕·얇은 선·절제된 색',
  screens: SCREENS,
  defaultScreen: 'landing',
  render: (screen) => <App screen={screen} />,
});
// 최종 시안 토큰으로 덮어쓰기 (마운트가 B 토큰을 :root에 넣은 뒤)
applyFinalTokens();
