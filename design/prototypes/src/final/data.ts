// 시안 B 프로토타입 데이터 (P2-03)
// - 퀘스트 문구는 실제 콘텐츠(shared/content.ts). 정답 키는 없다.
// - 진행도·별·퀴즈·힌트·기대 출력은 프로토타입이 지어낸 예시 값이다 (과제 문구에서 바로 보이는 출력만)
import { STAGES, type QuestText, type StageText } from '../shared/content';

/** 그림책 1권(숲 마을)에서 쓰는 스테이지 별명 — 실제 스테이지 이름은 그대로 두고 "장" 번호만 붙인다 */
export const BOOKS = [
  { no: 1, title: '숲 마을', sub: '파이썬 기초', state: 'open' as const },
  { no: 2, title: '바다 여행', sub: '배운 것을 섞어서 더 큰 문제를', state: 'locked' as const },
  { no: 3, title: '발명가의 공방', sub: '나만의 게임과 그림을 만들어요', state: 'locked' as const },
];

export type QuestKind = 'code' | 'quiz' | 'project';
export interface QuestEntry {
  id: string; // "2-1" · 퀴즈는 "2-q"
  stage: number;
  label: string; // 차례에 보이는 번호
  title: string;
  kind: QuestKind;
  challenge: boolean;
  /** -1 잠김, 0 아직 안 풂(지금 차례), 1~3 받은 별 */
  stars: number;
  quest?: QuestText;
}

// 스테이지별 받은 별 (-1 잠김, 0 지금 차례)
const STAR_TABLE: Record<number, number[]> = {
  1: [3, 3, 3, 2, 3, 3, 3],
  2: [1, 3, 2, 3, 3, 2, 3],
  3: [3, 2, 0, -1, -1, -1, -1],
};
const QUIZ: Record<number, { title: string; stars: number }> = {
  1: { title: '따옴표 퀴즈', stars: 3 },
  2: { title: '상자 퀴즈: 무엇이 나올까?', stars: 2 },
  3: { title: '갈림길 퀴즈', stars: -1 },
};

export function stageQuests(s: StageText): QuestEntry[] {
  const table = STAR_TABLE[s.order];
  const out: QuestEntry[] = [];
  s.quests.forEach((q, i) => {
    out.push({
      id: `${s.order}-${q.order}`,
      stage: s.order,
      label: `${s.order}-${q.order}`,
      title: q.title,
      kind: q.type === 'project' ? 'project' : 'code',
      challenge: q.challenge,
      stars: table ? table[i] ?? -1 : -1,
      quest: q,
    });
    // 세 번째 퀘스트 뒤에 확인 퀴즈 1개 (모바일 문제 유형 예시, §4)
    if (i === 2 && !s.final) {
      const z = QUIZ[s.order] ?? { title: '확인 퀴즈', stars: -1 };
      out.push({ id: `${s.order}-q`, stage: s.order, label: '퀴즈', title: z.title, kind: 'quiz', challenge: false, stars: z.stars });
    }
  });
  return out;
}

export interface StageProgress {
  stage: StageText;
  status: 'clear' | 'current' | 'locked';
  stars: number;
  max: number;
}
export const PROGRESS: StageProgress[] = STAGES.map((s) => {
  const qs = stageQuests(s);
  const stars = qs.reduce((a, q) => a + Math.max(0, q.stars), 0);
  const max = qs.length * 3;
  const status = s.order <= 2 ? 'clear' : s.order === 3 ? 'current' : 'locked';
  return { stage: s, status, stars, max };
});
export const CURRENT_STAGE = 3;
export const TOTAL_STARS = PROGRESS.reduce((a, p) => a + p.stars, 0);

/** 스테이지 보물상자 목표 (F11) */
export const CHEST_GOAL = 15;

// ───────────── 퀘스트 화면 보조 데이터 (프로토타입이 쓴 예시)

/** 과제 문구에 그대로 적힌 출력 (가짜 실행의 성공 판정). 없으면 "오류 없이 무언가 출력"이면 통과 */
export const EXPECTED: Record<string, string | RegExp> = {
  '1-1': '안녕하세요!',
  '1-2': '나는 파이썬 모험가!\n반가워!',
  '1-3': "I'm happy!",
  '1-4': '파이썬은 재미있어!',
  '1-5': '첫째 줄\n둘째 줄',
  '1-6': '2026',
  '1-7': '=== 파이썬 마을 ===\n인구: 2026명\n환영합니다!',
  '2-1': '파이뱀',
  '2-2': '10\n안녕',
  '2-3': '파랑',
  '2-4': /^\d+ 살$/,
  '2-5': '파이썬',
  '2-6': '123',
  '3-1': '통과!',
  '3-2': '홀수',
  '3-3': '등급: B',
  '3-4': '입장 가능!',
  '3-5': '마법사 합격!',
  '3-6': '이겼다!',
};

/** "틀린 코드로 해 보기" 예시 (아이들이 실제로 자주 하는 실수) */
export const WRONG: Record<string, string> = {
  '2-1': '# 변수에 이름을 넣어보세요!\nname = 파이뱀\nprint(name)',
  '2-2': '# 숫자와 글자를 각각 변수에 넣어보세요!\nnumber = 10\ngreeting = "안녕\nprint(number)\nprint(greeting)',
};

/** 단계형 힌트 (프로토타입 예시. 실제 힌트는 서버 전용 answer key에 있다) */
export const HINTS: Record<string, string[]> = {
  '2-1': [
    '변수는 이름표가 붙은 상자예요. = 오른쪽에 있는 값이 왼쪽 상자에 들어가요.',
    '글자를 상자에 넣을 때는 따옴표로 감싸야 해요. 예: "사과"',
    'name = 뒤에 "파이뱀"을 써 보세요. 따옴표까지 꼭!',
  ],
};
export const GENERIC_HINTS = [
  '해 볼 일을 한 줄씩 천천히 다시 읽어 보세요.',
  '글자는 따옴표로 감싸고, 숫자는 따옴표 없이 써요.',
  '마지막 줄에서 print( ) 괄호 안에 무엇을 보여 줄지 확인해 보세요.',
];
/** 황금 열쇠로 채워 주는 코드 (2-1만 예시) */
export const KEY_CODE: Record<string, string> = {
  '2-1': '# 변수에 이름을 넣어보세요!\nname = "파이뱀"\nprint(name)',
};

/** 파이뱀 첫 대사 */
export function tutorLine(q: QuestText) {
  return `${q.concept} 퀘스트예요! 이야기를 읽고, 오른쪽 공책에 주문을 써서 "코드 돌려보기"를 눌러 봐요.`;
}

// ───────────── 퀴즈 예시 (§4 객관식, §12-Q17: 보기 섞기, 3번 틀리면 해설)
export const QUIZ_SAMPLE = {
  stage: 2,
  title: '상자 퀴즈: 무엇이 나올까?',
  question: '이 코드를 실행하면 무엇이 나올까요?',
  code: 'box = "보물"\nprint(box)',
  choices: [
    { id: 'a', text: '보물', correct: true, why: '' },
    { id: 'b', text: 'box', correct: false, why: 'box는 상자 이름이에요. print(box)는 상자 안의 값을 꺼내 보여 줘요.' },
    { id: 'c', text: '"보물"', correct: false, why: '따옴표는 "여기부터 글자예요"라는 표시라서 화면에는 나오지 않아요.' },
    { id: 'd', text: '오류가 나요', correct: false, why: 'box 상자를 먼저 만들었으니 오류 없이 잘 돌아가요.' },
  ],
  explain: 'print(box)는 box 상자에 들어 있는 값 "보물"을 꺼내서 보여 줘요. 따옴표는 화면에 나오지 않아요.',
};
