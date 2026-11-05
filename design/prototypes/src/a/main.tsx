// 시안 A 모험 섬 진입점 (P2-02). 말랑한 클레이 장난감 같은 섬을 통통 뛰어다니는 캐주얼 게임
// 화면: #landing 랜딩 · #world 월드맵 · #stage 스테이지(퀘스트 고르기) · #quest 퀘스트 · #motion 시그니처 모션(P2-05)
import { mountPrototype } from '../shared/app';
import { Landing } from './landing';
import { MapScreen } from './worldmap';
import { QuestScreen } from './quest';
import { ToastHost } from './ui';
import { MotionScreen } from './motion';
import './a.css';

const SCREENS = [
  { id: 'landing', label: '랜딩' },
  { id: 'world', label: '월드맵' },
  { id: 'stage', label: '스테이지' },
  { id: 'quest', label: '퀘스트' },
  { id: 'motion', label: '모션' },
] as const;
type Screen = (typeof SCREENS)[number]['id'];

function App({ screen }: { screen: Screen }) {
  let body;
  if (screen === 'landing') body = <Landing />;
  // 월드맵과 스테이지는 같은 지도 컴포넌트 (시트만 열고 닫음 → 파이뱀 위치 유지)
  else if (screen === 'world' || screen === 'stage') body = <MapScreen sheet={screen === 'stage'} />;
  else if (screen === 'quest') body = <QuestScreen />;
  else body = <MotionScreen />;
  return (
    <div className="a-root">
      {body}
      <ToastHost />
    </div>
  );
}

mountPrototype<Screen>({
  concept: 'A',
  name: 'pyRoad 모험 섬',
  screens: SCREENS,
  defaultScreen: 'landing',
  render: (screen) => <App screen={screen} />,
});
