// 실제 퀘스트 문구 (content/worlds → scripts/gen-content.mjs → content.gen.json)
// 공개 문구만 있다: 정답·힌트·solution_code·fallback_text·expected_output_hint 없음.
// 빌드할 때마다 다시 생성되므로 content.gen.json을 손으로 고치지 않는다.
import data from './content.gen.json';

export interface QuestText {
  order: number;
  title: string;
  concept: string;
  xp: number;
  type: 'code' | 'project' | string;
  challenge: boolean;
  topic: string;
  goals: string[];
  story: string;
  task: string;
  starter: string;
}
export interface StageText {
  order: number;
  title: string;
  theme: string;
  description: string;
  final: boolean;
  quests: QuestText[];
}
export interface WorldText {
  slug: string;
  order: number;
  title: string;
  theme: string;
  description: string;
  stages: StageText[];
}

export const WORLDS = data.worlds as WorldText[];
export const WORLD1 = WORLDS[0];
/** 1월드 7개 스테이지 */
export const STAGES = WORLD1.stages;

export function quest(stageOrder: number, questOrder: number): QuestText {
  const s = STAGES.find((x) => x.order === stageOrder) ?? STAGES[0];
  return s.quests.find((q) => q.order === questOrder) ?? s.quests[0];
}

/** 2·3월드는 아직 콘텐츠가 없다 (Phase 10·11). 계획서 §5의 가제와 소개만 */
export const FUTURE_WORLDS = [
  { order: 2, title: '코드 바다', description: '배운 것을 섞어서 더 큰 문제를 풀어요' },
  { order: 3, title: '메이커 시티', description: '나만의 게임과 그림을 만들어요' },
];

/** 화면 채우기용 예시 (가짜 학생 정보. 공개 정보는 닉네임 + 캐릭터만, §2.6) */
export const SAMPLE_PLAYER = { nickname: '코딩탐험가', level: 4, xp: 320, xpNext: 500, coins: 1280, stars: 14, streak: 5 };
