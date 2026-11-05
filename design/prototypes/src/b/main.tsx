// 시안 B 마법 그림책 인터랙티브 프로토타입 (P2-03)
// 화면: #landing 랜딩 · #world 보물지도 · #stage 스테이지 차례(지도 위 바텀시트) · #quest 책 펼침 퀘스트 · #motion 준비 중
import { useLayoutEffect, useRef } from 'react';
import { mountPrototype } from '../shared/app';
import { Landing } from './Landing';
import { World } from './World';
import { Quest } from './Quest';
import { Hud, Toasts, pageTurn } from './ui';
import './b.css';
import './screens.css';
import { PAPER_FIBER, PAPER_GRAIN } from './paper.gen';

// 종이 질감 타일(미리 만든 PNG)을 CSS 변수로
document.documentElement.style.setProperty('--b-grain', PAPER_GRAIN);
document.documentElement.style.setProperty('--b-fiber', PAPER_FIBER);

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

function App({ screen }: { screen: Screen }) {
  const host = useRef<HTMLDivElement | null>(null);
  const prev = useRef<Screen | null>(null);
  useLayoutEffect(() => {
    const p = prev.current;
    prev.current = screen;
    if (!p || p === screen) return;
    // 지도 ↔ 차례(바텀시트)는 같은 장이라 넘기지 않는다
    const same = (p === 'world' && screen === 'stage') || (p === 'stage' && screen === 'world');
    if (same) return;
    const dir = ORDER.indexOf(screen) >= ORDER.indexOf(p) ? 1 : -1;
    pageTurn(host.current, { dir, kicker: CHAPTER[screen].k, title: CHAPTER[screen].t, fixed: true });
  }, [screen]);

  return (
    <div className="b-app" ref={host}>
      {screen === 'landing' && <Landing />}
      {(screen === 'world' || screen === 'stage') && <World sheet={screen === 'stage'} />}
      {screen === 'quest' && <Quest />}
      {screen === 'motion' && <MotionSoon />}
      <Toasts />
    </div>
  );
}

function MotionSoon() {
  return (
    <>
      <Hud back={{ to: 'world', label: '지도' }} />
      <main className="b-soon">
        <div className="b-soon-card b-paper-card">
          <span className="b-kicker">P2-05에서 채울 자리</span>
          <h1 className="b-h1">시그니처 모션 준비 중</h1>
          <p>페이지 넘김 · 잉크 번짐 · 스탬프 쾅을 스테이지 해제, 퀘스트 성공, 레벨업 장면으로 풍성하게 보여 줄 거예요.</p>
          <p className="b-muted">지금은 지도(잉크 길·스탬프), 퀘스트 성공(스탬프 쾅), 모바일 퀘스트의 쪽 넘김에서 간단한 버전을 볼 수 있어요.</p>
        </div>
      </main>
    </>
  );
}

mountPrototype<Screen>({
  concept: 'B',
  name: 'pyRoad 마법 그림책',
  screens: SCREENS,
  defaultScreen: 'landing',
  render: (screen) => <App screen={screen} />,
});
