// 시안 A 진입점 (P2-02). 시안 에이전트가 채울 곳 — 지금은 빈 골격 (design/README.md "시안 폴더 규칙")
import { mountPrototype } from '../shared/app';
import { SkeletonScreen } from '../shared/SkeletonScreen';

const SCREENS = [
  { id: 'landing', label: '랜딩' },
  { id: 'world', label: '월드맵' },
  { id: 'quest', label: '퀘스트' },
  { id: 'motion', label: '모션' },
] as const;
type Screen = (typeof SCREENS)[number]['id'];

mountPrototype<Screen>({
  concept: 'A',
  name: 'pyRoad 모험 섬',
  screens: SCREENS,
  defaultScreen: 'landing',
  render: (screen) => <SkeletonScreen concept="A" screen={screen} item="P2-02" />,
});
