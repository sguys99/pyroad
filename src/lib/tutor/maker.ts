/**
 * 3-F 메이커 박람회 튜터 (P11-14, docs/curriculum/world3.md §8) — 화면·서버가 함께 쓰는 값과 키 없을 때의 저장된 답변.
 *
 * - `project_planner` (기획 도우미): 아이가 쓴 아이디어 한 줄 → 이름 후보·종류·기능 3개·기획 카드 값. 키가 없거나 답을 버리면
 *   저장된 "작품 아이디어 카드" 6종 중 아이디어와 가장 가까운 것 (`plannerFallback`)
 * - `creation_feedback` (작품 평가 친구): 코드·실행 요약·그림 요약 → 잘한 점 2 + 한 걸음 더 1 + 질문 1. 키가 없으면 규칙 문장
 *   (`creationFeedbackFallback`)
 * 아이 글 거르기·답 거르기는 서버(`freeQuestionFilter.ts`)가 자유 질문과 같은 규칙으로 한다.
 */
import { blankCommentsAndStrings } from '@/lib/quest/validation';
import {
  analyze,
  colorsUsed,
  findCircles,
  mergedSegments,
} from '@/lib/turtle/check';
import type { TurtleCommand } from '@/lib/turtle/scene';

/** 기획 도우미 아이디어 글자 수 상한 (자유 질문과 같음, 화면 maxLength·서버 검사 같은 값) */
export const PLANNER_IDEA_MAX_LENGTH = 100;

export interface IdeaCard {
  id: string;
  /** 칩에 보이는 짧은 이름 */
  label: string;
  /** 칩을 누르면 입력 칸에 채우는 아이디어 한 줄 */
  idea: string;
  title: string;
  kind: '그림' | '이야기' | '퀴즈' | '펫' | '게임';
  features: [string, string, string];
  /** 기능마다 배운 곳 (작업실 이름) */
  from: string;
  /** 아이디어 글에서 찾을 낱말 */
  match: string[];
}

/** 저장된 작품 아이디어 카드 6종: 3-1~3-6 작품을 "내 것"으로 바꾸는 방향 (world3.md §8 폴백) */
export const IDEA_CARDS: readonly IdeaCard[] = [
  {
    id: 'town',
    label: '우리 동네 그림',
    idea: '거북이로 우리 동네 거리를 그리고 싶어요',
    title: '우리 동네 거리',
    kind: '그림',
    features: ['집과 길 그리기', '나무와 꽃 찍기', '거리 이름 쓰기'],
    from: '거북이 화가 공방',
    match: ['그림', '그리', '색', '집', '동네', '꽃', '별', '거북'],
  },
  {
    id: 'story',
    label: '나만의 모험 이야기',
    idea: '친구가 길을 골라 가는 모험 이야기를 만들고 싶어요',
    title: '신비한 섬 모험',
    kind: '이야기',
    features: ['별명 묻기', '갈림길 고르기', '엔딩 두 개'],
    from: '모험 이야기 극장',
    match: ['이야기', '모험', '동화', '탐험', '길'],
  },
  {
    id: 'quiz',
    label: '나만의 퀴즈쇼',
    idea: '내가 좋아하는 것으로 퀴즈쇼를 만들고 싶어요',
    title: '동물 퀴즈쇼',
    kind: '퀴즈',
    features: [
      '문제 세 개 묻기',
      '맞으면 점수 올리기',
      '마지막에 점수 보여 주기',
    ],
    from: '두근두근 퀴즈쇼 방송국',
    match: ['퀴즈', '문제', '맞히', '시험', '점수'],
  },
  {
    id: 'pet',
    label: '나만의 펫 키우기',
    idea: '이름을 지어 주고 돌보는 펫을 만들고 싶어요',
    title: '우리 집 펫',
    kind: '펫',
    features: ['펫 이름 짓기', '밥 주고 놀아 주기', '기분 보여 주기'],
    from: '가상 펫 돌봄 센터',
    match: ['펫', '키우', '강아지', '고양이', '동물', '돌보'],
  },
  {
    id: 'survey',
    label: '우리 반 설문 그래프',
    idea: '친구들이 좋아하는 것을 세어서 그래프로 그리고 싶어요',
    title: '좋아하는 간식 설문',
    kind: '그림',
    features: ['표 수 세기', '막대그래프 그리기', '가장 많은 것 알려 주기'],
    from: '데이터 탐정 사무소',
    match: ['설문', '그래프', '세어', '투표', '데이터', '조사'],
  },
  {
    id: 'game',
    label: '나만의 미니 게임',
    idea: '화살표 키로 움직이는 게임을 만들고 싶어요',
    title: '사과 받기 게임',
    kind: '게임',
    features: ['화살표로 좌우 움직이기', '사과 떨어뜨리기', '받으면 점수'],
    from: '미니 게임 오락실',
    match: ['게임', '키', '화살표', '피하', '잡기', '달리'],
  },
];

/** 아이디어와 가장 가까운 카드 (아무것도 안 맞으면 첫 카드) */
export function pickIdeaCard(idea: string): IdeaCard {
  const t = idea.toLowerCase();
  let best = IDEA_CARDS[0];
  let score = 0;
  for (const card of IDEA_CARDS) {
    const n = card.match.filter((m) => t.includes(m)).length;
    if (n > score) [best, score] = [card, n];
  }
  return best;
}

/** 기획 도우미 저장된 답변: 가까운 카드 하나를 기획 카드 모양으로 + 나머지 카드 이름 (아이 글은 되풀이하지 않음) */
export function plannerFallback(idea: string): string {
  const card = pickIdeaCard(idea);
  const others = IDEA_CARDS.filter((c) => c !== card).map((c) => c.label);
  return [
    '지금은 파이뱀이 바로 기획을 도와주기 어려워서, 저장된 작품 아이디어 카드를 보여 줄게요! 🐍',
    '',
    `**${card.label}** (${card.from}에서 배운 기술)`,
    '',
    '```python',
    `title = "${card.title}"`,
    `kind = "${card.kind}"`,
    `features = ["${card.features.join('", "')}"]`,
    '```',
    '',
    '이름과 기능은 내 마음대로 바꿔도 돼요. 쉬운 기능부터 하나씩 만들어요.',
    '',
    `다른 아이디어 카드: ${others.join(', ')}`,
  ].join('\n');
}

/** 작품 평가 친구가 보는 그림 요약 (그림 규칙 검사기가 만든 숫자, 화면이 계산해 보냄) */
export interface DrawingSummary {
  lines: number;
  circles: number;
  colors: number;
  texts: number;
}

/** 실행의 turtle 명령 → 그림 요약 (선은 같은 직선끼리 합쳐 셈, 그림 규칙 `segments` 와 같은 기준). 그림이 없으면 모두 0 */
export function drawingSummary(
  commands: readonly TurtleCommand[],
): DrawingSummary {
  if (!commands.length) return { lines: 0, circles: 0, colors: 0, texts: 0 };
  const a = analyze(commands);
  return {
    lines: mergedSegments(a.segments).length,
    circles: findCircles(a).length,
    colors: colorsUsed(a).length,
    texts: a.texts.length,
  };
}

/** 코드에 쓰인 개념 (주석·문자열 안 글자는 빼고 셈) */
export interface CreationFacts {
  functions: number;
  classes: number;
  loops: number;
  ifs: number;
  inputs: number;
  keys: boolean;
  turtle: boolean;
  lines: number;
}

export function creationFacts(code: string): CreationFacts {
  const bare = blankCommentsAndStrings(code);
  const count = (re: RegExp) => (bare.match(re) ?? []).length;
  return {
    functions: count(/^\s*def\s/gm),
    classes: count(/^\s*class\s/gm),
    loops: count(/^\s*(?:for|while)\s/gm),
    ifs: count(/^\s*(?:if|elif)\s/gm),
    inputs: count(/\binput\s*\(/g),
    keys: /\bget_key\s*\(/.test(bare),
    turtle: /\bturtle\b/.test(bare),
    lines: code.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))
      .length,
  };
}

/** 쓰인 개념 한 줄 (프롬프트용) */
export function factsLine(f: CreationFacts): string {
  const parts = [
    `코드 ${f.lines}줄`,
    `함수(def) ${f.functions}개`,
    f.classes ? `class ${f.classes}개` : 'class 없음',
    `반복 ${f.loops}개`,
    `조건 ${f.ifs}개`,
    f.inputs ? `input ${f.inputs}번` : 'input 없음',
    f.keys ? 'get_key 씀' : 'get_key 없음',
    f.turtle ? 'turtle 씀' : 'turtle 없음',
  ];
  return parts.join(' · ');
}

export function drawingLine(d: DrawingSummary | undefined): string {
  if (!d || d.lines + d.circles + d.texts === 0) return '그림 없음';
  return `선 ${d.lines}개 · 원 ${d.circles}개 · 색 ${d.colors}가지 · 글씨 ${d.texts}개`;
}

/** 한 걸음 더 후보 (10줄 안의 작은 것). 작품 모양에 맞는 첫 후보 */
function nextStep(f: CreationFacts, d: DrawingSummary | undefined): string {
  if (f.keys)
    return '게임이 끝나면 점수에 따라 다른 말(예: 10점 넘으면 "최고 기록!")이 나오게 해 볼까요?';
  if (f.classes)
    return '펫에게 새 행동 메서드(예: 잠자기)를 하나 더 만들어 볼까요?';
  if (f.inputs) return '이상한 답이 들어오면 while 로 다시 묻게 해 볼까요?';
  if (d && d.colors <= 1)
    return '색 리스트를 만들어 모양마다 다른 색을 칠해 볼까요?';
  if (d && d.texts === 0)
    return '작품 아래에 t.write 로 작품 이름을 써 볼까요?';
  if (!f.functions)
    return '여러 번 쓰는 부분을 def 로 묶어 이름을 붙여 볼까요?';
  return '반복 횟수나 크기 숫자를 바꿔서 작품이 어떻게 달라지는지 해 볼까요?';
}

/** 작품 평가 친구 저장된 답변: 숫자로 만든 칭찬 2개 + 한 걸음 더 + 질문 (점수·비교 없음) */
export function creationFeedbackFallback(
  code: string,
  drawing: DrawingSummary | undefined,
  personal: boolean,
): string {
  const f = creationFacts(code);
  const praise: string[] = [];
  if (f.functions)
    praise.push(
      `함수를 ${f.functions}개나 만들었네! 기능에 이름을 붙이니 코드가 읽기 쉬워요.`,
    );
  if (f.classes) praise.push('class 설계도로 나만의 물건을 만들었어요!');
  if (f.inputs) praise.push('input 으로 친구와 대화하는 프로그램이에요!');
  if (f.keys) praise.push('get_key 로 키보드를 읽는 진짜 게임이에요!');
  if (drawing && drawing.colors >= 2)
    praise.push(`색을 ${drawing.colors}가지나 썼어요. 알록달록해요!`);
  if (drawing && drawing.lines >= 10)
    praise.push(`선을 ${drawing.lines}개나 그렸어요. 정성이 가득해요!`);
  if (f.ifs) praise.push('조건(if)으로 상황마다 다르게 움직이게 했어요!');
  if (f.loops) praise.push('반복으로 같은 일을 똑똑하게 줄였어요!');
  if (praise.length < 2) praise.push('끝까지 실행되는 작품을 완성했어요!');
  return [
    '파이뱀이 작품을 봤어요! 🐍✨',
    '',
    '**잘한 점**',
    ...praise.slice(0, 2).map((p) => `- ${p}`),
    '',
    '**한 걸음 더**',
    `- ${nextStep(f, drawing)}`,
    ...(personal
      ? [
          '',
          '작품 글자에 이름이나 연락처처럼 보이는 것이 있어요. 출품 전에 그 부분은 지워 줘요.',
        ]
      : []),
    '',
    '다음엔 무엇을 더하고 싶어요?',
  ].join('\n');
}
