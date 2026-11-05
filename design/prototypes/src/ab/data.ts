// 시안 A×B 화면 채우기용 예시 진행 데이터 (가짜 학생, 공개 정보는 닉네임 + 캐릭터만 §2.6)
// 퀘스트 문구는 shared/content(실제 YAML)에서, 별·잠김·힌트 문구·퀴즈는 프로토타입용으로 여기서 만든다.
import { STAGES, type QuestText } from '../shared/content';

export type StageStatus = 'done' | 'current' | 'locked';
export type QuestKind = 'code' | 'quiz' | 'project';

export interface QuestProgress {
  stage: number;
  order: number;
  /** 0~3. 잠김이면 -1 */
  stars: number;
  status: 'done' | 'current' | 'locked';
  kind: QuestKind;
}

/** 1·2스테이지 완료, 3스테이지 진행 중(퀘스트 4), 4~7 잠김 */
const STAR_TABLE: Record<number, number[]> = {
  1: [3, 3, 3, 2, 3, 3, 2],
  2: [3, 2, 3, 1, 3, 2, 1],
  3: [3, 2, 3],
};
/** 모바일 문제 유형(§4)이 들어올 자리: 퀘스트 목록에서 퀴즈 표시를 보여 주려고 몇 개를 퀴즈로 둔다 */
const QUIZ_SLOTS = new Set(['1-3', '2-3', '3-2', '3-5', '4-3', '5-2']);

let currentStage = 3;
/** 월드맵 "해제 보기" 데모가 바꾼다 (store.setAb({ current })를 거쳐서) */
export function setCurrentStage(n: number) {
  currentStage = n;
}

export function stageStatus(order: number): StageStatus {
  return order < currentStage ? 'done' : order === currentStage ? 'current' : 'locked';
}

export function questProgress(stage: number, q: QuestText): QuestProgress {
  const st = stageStatus(stage);
  const kind: QuestKind = q.type === 'project' ? 'project' : QUIZ_SLOTS.has(`${stage}-${q.order}`) ? 'quiz' : 'code';
  if (st === 'locked') return { stage, order: q.order, stars: -1, status: 'locked', kind };
  const row = STAR_TABLE[stage] ?? (st === 'done' ? [2, 2, 2, 2, 2, 2, 2, 2] : []);
  const stars = row[q.order - 1];
  if (stars !== undefined) return { stage, order: q.order, stars, status: 'done', kind };
  if (q.order === row.length + 1) return { stage, order: q.order, stars: 0, status: 'current', kind };
  return { stage, order: q.order, stars: -1, status: 'locked', kind };
}

export function stageStars(order: number) {
  const s = STAGES.find((x) => x.order === order)!;
  const got = s.quests.reduce((n, q) => n + Math.max(0, questProgress(order, q).stars), 0);
  return { got, max: s.quests.length * 3, cleared: s.quests.filter((q) => questProgress(order, q).status === 'done').length, total: s.quests.length };
}

/** 스테이지 보물상자 목표 (F11) */
export const CHEST_GOAL = 15;

/** 스테이지마다 섬 위 건물 (손그림 일러스트 종류) */
export const STAGE_BUILDING = ['gate', 'treehouse', 'signpost', 'cave', 'lighthouse', 'tower', 'castle'] as const;
export type BuildingKind = (typeof STAGE_BUILDING)[number];

// ───────────── 데모 퀘스트 (2-2 숫자 상자와 글자 상자)

export const DEMO_QUEST = { stage: 2, order: 2 };

/** 프로토타입 채점용 기대 출력 (앱에서는 서버가 채점, §2.3). 공개 문구가 아니라 여기서만 쓴다 */
export const EXPECTED: Record<string, string> = {
  '2-1': '파이뱀',
  '2-2': '10\n안녕',
  '2-3': '파랑',
};
/** 퀘스트를 열었을 때 파이뱀 첫 대사 (프로토타입 문구) */
export const INTRO: Record<string, string> = {
  '2-2': '이번 미션은 상자 두 개 채우기! 숫자는 그냥, 글자는 따옴표로. 다 쓰면 코드 돌려보기!',
};
/** 단계형 힌트 (프로토타입 문구) */
export const HINTS: Record<string, string[]> = {
  '2-2': [
    '숫자 상자에는 숫자를 그대로, 글자 상자에는 따옴표로 감싼 글자를 넣어.',
    'number = 다음에 10을 써 봐. 따옴표는 필요 없어!',
    'greeting = 다음에는 "안녕"처럼 큰따옴표로 감싸서 써 봐.',
  ],
};
export const DEFAULT_HINTS = ['미션 문장을 한 번 더 천천히 읽어 볼까?', '시작 코드의 빈칸(= 오른쪽)을 채워 봐.', 'print( ) 괄호 안에 상자 이름을 넣으면 안의 값이 나와.'];

/** 황금키로 채우는 예시 코드 (프로토타입에서 성공 흐름을 보여 주려고만) */
export const KEY_CODE: Record<string, string> = {
  '2-2': '# 숫자와 글자를 각각 변수에 넣어보세요!\nnumber = 10\ngreeting = "안녕"\nprint(number)\nprint(greeting)',
};
export const BUGGY_CODE: Record<string, string> = {
  '2-2': '# 숫자와 글자를 각각 변수에 넣어보세요!\nnumber = 10\ngreeting = 안녕\nprint(number)\nprint(greeting)',
};

// ───────────── 퀴즈 예시 (§4 객관식, §12-Q17: 3번 틀리면 정답·해설 공개 후 ⭐)

export const QUIZ = {
  title: '상자 속 마지막 값',
  question: '이 코드를 실행하면 무엇이 출력될까요?',
  code: 'box = "사과"\nbox = "바나나"\nprint(box)',
  choices: [
    { id: 'a', text: '바나나', correct: true },
    { id: 'b', text: '사과', correct: false },
    { id: 'c', text: 'box', correct: false },
    { id: 'd', text: '사과바나나', correct: false },
  ],
  explain: '상자에 새 값을 넣으면 예전 값은 사라지고 마지막에 넣은 "바나나"만 남아요. 그래서 print(box)는 바나나를 보여 줘요.',
  wrongTalk: [
    '음, 상자에 값을 두 번 넣었지? 마지막에 넣은 걸 떠올려 봐!',
    '따옴표 안의 글자가 나오는 거야. 상자 이름이 나오진 않아!',
  ],
};

export function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = arr.slice();
  let s = seed % 2147483647 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
