/**
 * 랜딩 `#parents` 보호자 안내 문구 (P4-07). 보호자께 하는 말이라 존댓말, 간결하게.
 * **모든 문장은 지금 코드·문서로 확인한 사실만** 쓴다. 근거를 문장 옆 주석에 두고, 바뀌면 같이 고친다.
 * 아직 없는 기능은 `soon`(준비 중)으로만 적는다.
 */

export interface LetterColumn {
  id: 'safety' | 'ai' | 'learning';
  title: string;
  items: readonly string[];
}

export const LETTER: readonly LetterColumn[] = [
  {
    id: 'safety',
    title: '안전',
    items: [
      // §2.6 · P3-13: 공개 뷰는 닉네임 + 아바타 스킨만, display_name·avatar_url을 읽는 화면 없음
      '다른 이용자에게는 닉네임과 캐릭터만 보여요. 실명·이메일·사진은 공개하지 않아요.',
      // 약관 제11조 "결제, 유료 아이템, 확률형 뽑기를 제공하지 않습니다" · 처리방침 "광고를 하지 않고", 쿠키는 인증용만
      '결제·확률형 뽑기·광고가 없고, 광고 추적 쿠키도 쓰지 않아요.',
      // P3-15: 동의 전 제한 모드(학습은 그대로, 게시판 쓰기 403), 30일 안에 동의가 없으면 파기
      '만 14세 미만은 보호자 동의 전까지 학습만 할 수 있어요.',
      // P1-18 · 처리방침 9-5: 금칙어·개인정보 필터, 서로 다른 3명 신고 시 자동 숨김
      '게시판 글은 금칙어·개인정보 필터와 신고 기능으로 지켜요.',
    ],
  },
  {
    id: 'ai',
    title: 'AI 튜터 원칙',
    items: [
      // src/lib/tutor/prompts.ts "절대 정답 코드를 직접 알려주지 마세요", 힌트 1~3단계(VALID_HINT_LEVELS)
      '파이뱀은 정답 코드를 바로 주지 않고, 3단계 힌트로 스스로 풀게 도와요.',
      // src/app/api/tutor/helpers.ts VALID_TYPES: 도입·힌트·피드백·격려·프로젝트 안내·정리뿐, 자유 입력 대화 없음
      '아이가 AI와 자유롭게 대화하지 않아요. 퀘스트 안내·힌트·코드 피드백만 받아요.',
      // prompts.ts "안전 지침": 개인정보 요청 금지, 폭력·성적·차별 내용 금지
      '아이에게 맞지 않는 내용을 다루지 않도록 안전 지침을 두었어요.',
      // 처리방침 7: AI 튜터 요청에 닉네임·이메일·계정 식별자는 보내지 않음
      'AI에는 닉네임·이메일 같은 계정 정보를 보내지 않아요.',
    ],
  },
  {
    id: 'learning',
    title: '배움',
    items: [
      // Pyodide(CPython) 브라우저 실행 · 코드 에디터 직접 입력
      '진짜 파이썬 코드를 직접 쓰고 브라우저에서 바로 실행해요.',
      // OutputPanel: 에러 메시지를 보여 주고 "여기를 한번 살펴볼까요?", 버그버그 · 튜터 code_feedback "방향만"
      '에러 메시지를 읽고 틀린 곳을 스스로 찾는 연습을 해요.',
      // stageOrder.ts · is_stage_unlocked: 스테이지는 순서대로 열린다
      '스테이지가 순서대로 열려 개념을 한 단계씩 쌓아요.',
    ],
  },
];

/** 아직 없는 것 (P8-12 휴식 알림). 생기면 LETTER로 옮긴다 */
export const SOON: readonly string[] = ['40분 연속 학습 때 쉬어 가기 알림'];

export interface Stop {
  world: 1 | 2 | 3;
  /** 월드 이름 (§12-Q40, 2·3은 가칭) */
  name: string;
  /** 지금 열려 있으면 open, 아니면 준비 중 */
  status: 'open' | 'soon';
  summary: string;
}

/** 월드 1 스테이지 이름 (content/worlds/python-island/*\/stage.yaml title, 테스트가 확인) */
export const WORLD1_STAGES = [
  '파이썬 마을 입구',
  '변수의 숲',
  '조건의 갈림길',
  '반복의 동굴',
  '리스트 호수',
  '함수의 탑',
  '프로젝트 왕국',
] as const;

/** 월드 1 퀘스트 수 (content 퀘스트 YAML 수, 테스트가 확인) */
export const WORLD1_QUESTS = 44;

export const ROADMAP: readonly Stop[] = [
  {
    world: 1,
    name: '파이썬 섬',
    status: 'open',
    summary: `print()부터 함수까지, ${WORLD1_STAGES.length}개 스테이지 · ${WORLD1_QUESTS}개 퀘스트`,
  },
  {
    // §5 2월드 초안 (Phase 10)
    world: 2,
    name: '코드 바다',
    status: 'soon',
    summary: '문자열·딕셔너리·랜덤·에러 처리 같은 응용',
  },
  {
    // §5 3월드 초안 (Phase 11)
    world: 3,
    name: '메이커 시티',
    status: 'soon',
    summary: '거북이 그림, 텍스트 게임 같은 나만의 작품',
  },
];
