import type { JsonLd } from '@/lib/seo/structuredData';

/**
 * 랜딩 `#faq` 자주 묻는 질문 (P4-08). 아이와 보호자가 함께 읽는 말이라 쉬운 해요체, 답은 1~2문장.
 * **답은 지금 코드·문서로 확인한 사실만**. 근거는 항목 옆 주석에. 답 글자도 랜딩 텍스트 서브셋에 들어가므로 짧게 둔다.
 */
export interface FaqItem {
  id: string;
  q: string;
  a: string;
  /** 답 뒤에 붙는 자세히 보기 링크 (같은 사이트 공개 페이지만) */
  more?: { href: '/terms' | '/privacy'; label: string };
}

export const FAQ: readonly FaqItem[] = [
  {
    // 약관 제11조 "서비스는 무료이며 결제, 유료 아이템, 확률형 뽑기를 제공하지 않습니다"
    id: 'free',
    q: '정말 무료인가요?',
    a: '네, 모두 무료예요. 결제·유료 아이템·확률형 뽑기가 없어요.',
    more: { href: '/terms', label: '이용약관' },
  },
  {
    // Pyodide 자체 호스팅 + Web Worker: 파이썬이 브라우저 안에서 실행된다
    id: 'install',
    q: '프로그램을 설치해야 하나요?',
    a: '아니요. 웹 브라우저에서 바로 시작하고, 파이썬도 브라우저 안에서 실행돼요.',
  },
  {
    // PRD 대상 초등 4~6학년(튜터 시스템 프롬프트도 같은 눈높이) · P3-15 만 14세 미만 보호자 동의
    id: 'age',
    q: '몇 살부터 할 수 있나요?',
    a: '초등학교 4~6학년 눈높이에 맞췄어요. 만 14세 미만은 보호자 동의가 필요해요.',
  },
  {
    // 반응형(360·768·1280) 웹. 코드 입력은 키보드가 편함 (모바일 문제 유형은 Phase 7)
    id: 'device',
    q: '휴대폰이나 태블릿에서도 되나요?',
    a: '네, 브라우저로 열 수 있어요. 코드를 칠 때는 키보드가 있으면 더 편해요.',
  },
  {
    // LoginSheet: 카카오·네이버·Google 소셜 로그인만 (비밀번호 가입 없음)
    id: 'login',
    q: '어떻게 로그인하나요?',
    a: '카카오, 네이버, Google 계정으로 로그인해요. 따로 비밀번호를 만들지 않아요.',
  },
  {
    // prompts.ts 정답 코드 금지·힌트, api/tutor VALID_TYPES(자유 대화 없음), 처리방침 7(닉네임·이메일 미전송)
    id: 'ai',
    q: 'AI 튜터는 안전한가요?',
    a: '파이뱀은 정답 대신 힌트를 주고, 자유 대화 없이 퀘스트만 도와요. 닉네임·이메일은 AI에 보내지 않아요.',
  },
  {
    // AccountManagementSection(프로필 화면 "회원 탈퇴") · 처리방침 "탈퇴하면 바로 삭제"
    id: 'leave',
    q: '탈퇴하면 기록은 어떻게 되나요?',
    a: '프로필 화면의 "회원 탈퇴"에서 할 수 있어요. 내 정보와 기록은 바로 지워져요.',
    more: { href: '/privacy', label: '개인정보처리방침' },
  },
];

/**
 * FAQPage 구조화 데이터 (schema.org). 화면에 보이는 질문·답과 글자 그대로 같아야 한다(검색엔진 지침).
 * 직렬화는 `serializeJsonLd`(P4-10, `src/lib/seo/structuredData.ts`)를 그대로 쓴다.
 */
export function buildFaqStructuredData(items: readonly FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'ko-KR',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
