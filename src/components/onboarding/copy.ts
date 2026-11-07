import type { PybaemState } from '@/components/characters/rig';
import type { OnboardingVariant } from '@/lib/onboarding/returning';
import type { OnboardingStepId } from '@/lib/onboarding/steps';

/**
 * 온보딩 문구 (P3-11 새 사용자 · P3-12 기존 사용자). 화면 글자를 고칠 때는 여기만.
 * 아이용 쉬운 말, 파이뱀 대사는 반말로 짧게, 판 설명은 존댓말.
 */
export interface StepCopy {
  title: string;
  desc: string;
  line: string;
  mascot: PybaemState;
}

const NEW: Record<OnboardingStepId, StepCopy> = {
  agree: {
    title: '모험 약속',
    desc: "pyRoad에서 안전하고 즐겁게 지내기 위한 약속이에요. '보기'를 누르면 내용을 읽을 수 있어요.",
    line: '안녕! 나는 파이뱀이야. 모험을 떠나기 전에 약속부터 하자!',
    mascot: 'wave',
  },
  age: {
    title: '몇 년에 태어났어요?',
    desc: '만 14세가 안 된 친구는 보호자 동의가 필요해서 물어봐요. 태어난 해는 저장하지 않고, 결과만 기억해요.',
    line: '몇 년에 태어났는지 알려 줄래? 잘 모르면 "잘 모르겠어요"를 눌러도 돼!',
    mascot: 'teach',
  },
  guardian: {
    title: '보호자 동의',
    desc: '이 단계는 보호자님이 읽고 체크해 주세요.',
    line: '이제 보호자님 차례야! 옆에 계신 어른께 화면을 보여 드려.',
    mascot: 'wave',
  },
  nickname: {
    title: '내 이름 정하기',
    desc: '게시판과 프로필에서 친구들에게 보이는 별명이에요. 진짜 이름이나 학교 이름은 쓰지 마세요.',
    line: '친구들이 부를 별명을 지어 줘. 진짜 이름은 비밀로 하고!',
    mascot: 'idle',
  },
  skin: {
    title: '내 파이뱀 색 고르기',
    desc: '고른 색 파이뱀이 게시판과 프로필에서 나를 대신해 보여요. 나중에 꾸미기에서 바꿀 수 있어요.',
    line: '나는 어떤 색이면 좋을까? 마음에 드는 색을 골라 줘!',
    mascot: 'idle',
  },
  grade: {
    title: '몇 학년이에요?',
    desc: '알맞은 퀘스트를 고를 때 참고만 해요. 다른 친구에게는 보이지 않고, 안 골라도 괜찮아요.',
    line: '몇 학년인지 알려 줄래? 말하기 싫으면 건너뛰어도 돼!',
    mascot: 'teach',
  },
  stamp: {
    title: '모험가 등록 완료!',
    desc: '이제 모험을 떠날 준비가 다 됐어요.',
    line: '',
    mascot: 'cheer',
  },
};

/** 기존 사용자 (P3-12): 같은 단계, 반가운 말 + 바뀐 점 한 줄. 학습 기록은 그대로라는 것을 꼭 알려 준다 */
const RETURNING: Record<OnboardingStepId, StepCopy> = {
  ...NEW,
  agree: {
    title: '새 약속 확인하기',
    desc: "약속이 새로 바뀌었어요. '보기'를 눌러 읽어 보고 체크해 주세요.",
    line: '다시 만나서 반가워! 새 약속부터 같이 확인하자!',
    mascot: 'wave',
  },
  nickname: {
    ...NEW.nickname,
    line: '이제 친구들에게는 진짜 이름 대신 별명으로 보여. 멋진 별명을 정해 줘!',
  },
  stamp: {
    title: '새 등록증을 받았어요!',
    desc: '지금까지 모은 기록은 그대로예요.',
    line: '',
    mascot: 'cheer',
  },
};

export function stepCopy(
  variant: OnboardingVariant,
): Record<OnboardingStepId, StepCopy> {
  return variant === 'returning' ? RETURNING : NEW;
}

/** 기존 사용자에게 보여 주는 "바뀐 점" 한 줄 (약속 단계 위) */
export const RETURNING_NEWS =
  'pyRoad가 새 모습으로 단장했어요! 이제 진짜 이름·사진 대신 별명과 내 파이뱀으로 보여요. 지금까지 모은 별·경험치·기록은 그대로예요.';

/** 도장 단계 파이뱀 대사 */
export function stampLine(variant: OnboardingVariant, name: string): string {
  return variant === 'returning'
    ? `${name}, 새 등록증 완성! 이어서 모험해 볼까?`
    : `${name}, 모험가 등록 완료! 이제 진짜 모험을 떠나 보자!`;
}

/** 기존 사용자 닉네임 단계: 예전 닉네임이 그대로일 때 / 새 규칙에 맞지 않아 바꿔야 할 때 */
export const RETURNING_NICKNAME_KEPT =
  '예전에 쓰던 별명이 그대로 있어. 그대로 써도 되고 바꿔도 돼!';
export const RETURNING_NICKNAME_RENAME =
  '예전 별명은 새 규칙에 맞지 않아서 새로 정해야 해. 하나 골라 뒀어!';

/** 나이 확인 결과에 따른 파이뱀 대사 (P3-15) */
export const AGE_RESULT_LINE = {
  under14: '알려 줘서 고마워! 다음은 보호자님과 함께 하는 단계야.',
  '14plus': '고마워! 바로 이름을 정하러 가자.',
} as const;

/** 보호자 단계 파이뱀 대사: 다 체크했을 때 / 나중에 하기로 했을 때 */
export const GUARDIAN_DONE_LINE = '보호자님, 고맙습니다! 이제 같이 모험하자!';
export const GUARDIAN_LATER_LINE =
  '괜찮아! 공부는 바로 할 수 있어. 게시판 글쓰기는 보호자님과 함께 동의한 뒤에 하자.';

/** 도장 쪽: 보호자 동의 전(제한 모드)일 때 한 줄 */
export const RESTRICTED_FINALE_NOTE =
  '보호자 동의 전이라 게시판 글쓰기는 잠시 쉬어요. 30일 안에 보호자와 함께 "보호자 동의하기"를 해 주세요.';
