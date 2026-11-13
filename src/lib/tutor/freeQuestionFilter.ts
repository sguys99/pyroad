import 'server-only';

import { moderateText, type ModerationCategory } from '@/lib/moderation/filter';
import { unicodeFold } from '@/lib/moderation/normalize';
import type { FreeQuestionBlock } from './freeQuestion';

/**
 * 자유 질문 거르기 (P9-17, 서버 전용 — 화면은 글자 수만 미리 알려 줌). 설계·남는 위험은 docs/tutor-free-input.md.
 *
 * 순서: ① 위험 신호(wellbeing) — 개인정보와 함께 써도 안전 안내가 먼저 ② 게시판 필터(`moderateText`: 욕설·성적·개인정보·외부 연락)
 * + 튜터에만 있는 개인정보(이름·학교 이름·생일·SNS @아이디) ③ 위험한 물건 ④ 탈옥(역할 바꾸기·규칙 무시·시스템 프롬프트).
 * 정답 통째로 달라는 말은 거르지 않는다 — 프롬프트가 첫걸음만 안내하고, 답에 정답 코드가 들어 있으면 버린다(`checkFreeAnswer`).
 * 패턴은 `unicodeFold`(NFKC·소문자·보이지 않는 문자 제거) 뒤의 글에 건다. `rule` 은 테스트·운영 분석용이고 화면에 내지 않음.
 */

export type FreeQuestionCheck =
  | { ok: true }
  | { ok: false; block: FreeQuestionBlock; rule: string };

type Rule = [id: string, regex: RegExp];

const FAMILY =
  '(?:엄마|아빠|부모님|어머니|아버지|선생님|어른|형|오빠|누나|언니|삼촌|이모|고모|할아버지|할머니|아저씨|아줌마)';

const WELLBEING: Rule[] = [
  [
    'self-harm',
    /자살|자해|죽고\s*싶|죽어\s*버리고\s*싶|살기\s*싫|살고\s*싶지\s*않|사라지고\s*싶|없어지고\s*싶|뛰어\s*내리고\s*싶|손목\s*(?:을|를)?\s*긋|죽이고\s*싶/u,
  ],
  [
    'abuse',
    new RegExp(
      `학대|${FAMILY}\\s*(?:가|이|께서)?\\s*(?:나를|날|저를|절)?\\s*(?:자꾸|맨날|매일|또)?\\s*(?:때려|때리|때림|발로\\s*차)`,
      'u',
    ),
  ],
  [
    'bullying',
    /왕따|따돌림|(?:친구|친구들|애들|반\s*애들|형들|언니들)\s*(?:이|가|들이)?\s*(?:나를|날|저를|절)?\s*(?:자꾸|맨날|매일|또)?\s*(?:괴롭|때려|때리)/u,
  ],
  [
    'stranger',
    /(?:모르는|낯선)\s*(?:사람|어른|아저씨|아줌마|형|오빠|누나|언니)\s*(?:이|가)?.{0,12}(?:만나|사진|연락|선물|따라|비밀)/u,
  ],
  ['sexual-harm', /성추행|성폭행|강간|몸\s*(?:을|를)?\s*만져/u],
];

const PERSONAL: Rule[] = [
  [
    'name',
    /(?:내|제|나의|저의)\s*이름\s*(?:은|는|이|:)\s*(?!뭐|무엇|어떻게|어디)[가-힣a-z]{2,5}\s*(?:이야|야|예요|이에요|에요|입니다|이고|인데|이라고|라고|이다|임|$)/u,
  ],
  [
    'school-name',
    /(?<![가-힣])(?!우리|저희|무슨|어느|어떤|다른)[가-힣]{2,8}(?:초등학교|중학교)|[가-힣]{2,10}초\s*(?:에\s*)?(?:다녀|다니|다님)/u,
  ],
  [
    'birthday',
    /(?:생일|생년월일)\s*(?:은|는|이)?\s*(?:\d{2,4}\s*(?:년|[.\-/])\s*)?\d{1,2}\s*(?:월|[.\-/])\s*\d{1,2}/u,
  ],
  [
    'sns-handle',
    /(?:인스타|틱톡|유튜브|카톡|디코|디스코드|insta|instagram|tiktok|youtube|discord)\s*(?:아이디|계정|채널|id)?\s*[:은는]?\s*@[a-z0-9._]{3,}/u,
  ],
];

const DANGER: Rule[] = [
  [
    'danger',
    /(?:폭탄|총|독약)\s*(?:을|를)?\s*만(?:들|드)|마약|대마초|담배\s*(?:를|을)?\s*(?:피우|피는|사는)/u,
  ],
];

const OFF_ROLE: Rule[] = [
  [
    'ignore-rules',
    /(?:이전|앞|위|모든|지금까지|기존)\s*(?:의|에)?\s*(?:지시|명령|규칙|설정|프롬프트|대화)\s*(?:을|를|은|는|들|사항)?\s*(?:다|전부|모두)?\s*(?:무시|잊어|잊고|잊으|취소|삭제)|(?:지시|명령|규칙|제한|필터)\s*(?:을|를|은|는)?\s*(?:다|전부|모두)?\s*(?:무시|해제|풀어|없애)/u,
  ],
  [
    'system-prompt',
    /시스템\s*프롬프트|system\s*prompt|(?:프롬프트|지시문)\s*(?:을|를)?\s*(?:알려|보여|말해|출력|공개)/u,
  ],
  [
    'jailbreak',
    /ignore\s+(?:all\s+|any\s+|the\s+)*(?:previous|prior|above|earlier|your)\s+(?:instructions|rules|prompts?)|jailbreak|dan\s*mode|developer\s*mode|god\s*mode|개발자\s*모드/u,
  ],
  [
    'role-change',
    /이제부터\s*(?:너는|넌|니가|네가)|(?:너는|넌)\s*이제부터|역할\s*극|역할\s*놀이|롤\s*플레이|role\s*-?\s*play|pretend\s+(?:to\s+be|you)|act\s+as|you\s+are\s+now/u,
  ],
];

const MODERATION_BLOCK: Record<ModerationCategory, FreeQuestionBlock> = {
  profanity: 'inappropriate',
  insult: 'inappropriate',
  sexual: 'inappropriate',
  personal_info: 'personal',
  contact: 'personal',
};

function firstMatch(text: string, rules: Rule[]): string | null {
  for (const [id, regex] of rules) if (regex.test(text)) return id;
  return null;
}

/** 아이가 쓴 질문 검사. 빈 글은 통과(빈 값 검사는 route 에서) */
export function checkFreeQuestion(text: string): FreeQuestionCheck {
  const folded = unicodeFold(text);
  // 위험 신호를 개인정보·욕설보다 먼저 본다 (예: "아빠가 때려요 010-…" → 안전 안내)
  const wellbeing = firstMatch(folded, WELLBEING);
  if (wellbeing) return { ok: false, block: 'wellbeing', rule: wellbeing };
  const mod = moderateText(text);
  if (!mod.ok)
    return {
      ok: false,
      block: MODERATION_BLOCK[mod.category],
      // 금칙어 규칙 id(word:…·en:…)에는 그 낱말이 들어 있어 기록에 남기지 않고 갈래만. 개인정보 패턴 id(phone-mobile 등)는 그대로
      rule: `moderation:${mod.ruleId.includes(':') ? mod.category : mod.ruleId}`,
    };
  const rest: [FreeQuestionBlock, Rule[]][] = [
    ['personal', PERSONAL],
    ['inappropriate', DANGER],
    ['off_role', OFF_ROLE],
  ];
  for (const [block, rules] of rest) {
    const rule = firstMatch(folded, rules);
    if (rule) return { ok: false, block, rule };
  }
  return { ok: true };
}

/** 공백을 모두 뺀 글 (정답 코드가 줄바꿈·들여쓰기만 바꿔 들어 있는지 비교용) */
function squash(text: string): string {
  return text.replace(/\s+/g, '');
}

/** 이보다 짧은 정답(예: `print(1)`)은 개념 설명 예시와 겹칠 수 있어 비교하지 않음 */
const MIN_SOLUTION_CHARS = 12;

/**
 * 모델 답 검사 (P9-17): 질문과 같은 거르기 + 이 퀘스트 정답 코드가 통째로 들어 있는지.
 * 걸리면 이유 코드(로그용), 괜찮으면 null. 걸린 답은 버리고 저장된 답변을 보낸다.
 * shortcut: 정답을 통째로(공백만 다르게) 옮긴 경우만 잡음 — 변수 이름을 바꾼 정답은 프롬프트 규칙에 기댐, 실제 사례가 보이면 줄 단위 비교로
 */
export function checkFreeAnswer(
  text: string,
  solutionCode: string | null,
): string | null {
  const solution = solutionCode ? squash(solutionCode) : '';
  if (solution.length >= MIN_SOLUTION_CHARS && squash(text).includes(solution))
    return 'solution';
  const check = checkFreeQuestion(text);
  return check.ok ? null : `${check.block}:${check.rule}`;
}
