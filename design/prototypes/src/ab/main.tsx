// 시안 A×B 모험 그림책 진입점 (P2-04)
// 팝업북·종이 공작 + 캐주얼 게임 지도: A의 섬 지도 구조·게임 버튼 + B의 종이 질감·손그림·손글씨 제목
// 무엇을 A에서, 무엇을 B에서 가져오는지는 mixRules.ts(MIX_RULES)가 기준이다
import { mountPrototype } from '../shared/app';
import { paperFiber, paperGrain } from '../shared/textures';
import { ArtDefs } from './art';
import { CelebrateLayer } from './celebrate';
import { Landing } from './Landing';
import { Quest } from './Quest';
import { Rules } from './Rules';
import { ToastLayer } from './ui';
import { WorldMap } from './WorldMap';
import './ab.css';

const SCREENS = [
  { id: 'landing', label: '랜딩' },
  { id: 'world', label: '월드맵' },
  { id: 'stage', label: '스테이지' },
  { id: 'quest', label: '퀘스트' },
  { id: 'motion', label: '모션' },
] as const;
type Screen = (typeof SCREENS)[number]['id'];

function App({ screen }: { screen: Screen }) {
  return (
    <div className="ab-root" data-screen={screen}>
      <ArtDefs />
      {screen === 'landing' && <Landing />}
      {screen === 'world' && <WorldMap />}
      {screen === 'stage' && <WorldMap withStage />}
      {screen === 'quest' && <Quest />}
      {screen === 'motion' && <Rules />}
      <ToastLayer />
      <CelebrateLayer />
    </div>
  );
}

// 종이 결: 바탕(페이지·바다)에만 쓰는 질감 (규칙표 "질감")
document.documentElement.style.setProperty('--ab-paper', `${paperGrain(0.1)}, ${paperFiber('#B89B6A', 0.07)}`);

mountPrototype<Screen>({
  concept: 'AB',
  name: 'pyRoad 모험 그림책',
  screens: SCREENS,
  defaultScreen: 'landing',
  render: (screen) => <App screen={screen} />,
});
