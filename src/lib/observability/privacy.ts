import type { init } from '@sentry/nextjs';

type DataCollection = NonNullable<
  NonNullable<Parameters<typeof init>[0]>['dataCollection']
>;

/**
 * Sentry SDK가 스스로 모으는 데이터를 최소로 줄인다 (아동 개인정보 §2.6).
 *
 * SDK v11은 `sendDefaultPii`를 없애고 `dataCollection`으로 바꿨으며, 기본값이 v10의 `sendDefaultPii: true`보다
 * 더 많이 모은다(사용자 정보·IP, 요청/응답 본문, 쿠키, 쿼리, 생성형 AI 입출력, 지역 변수).
 * 여기서는 `sendDefaultPii: false`보다 엄격하게 모두 끄고, `beforeSend`(`scrub.ts`)가 한 번 더 지운다.
 */
export const PRIVACY_DATA_COLLECTION = {
  // user.id·email·username·ip_address 자동 수집 안 함 (브라우저는 IP 추론도 `never`)
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: {
      allow: ['user-agent', 'content-type', 'accept', 'accept-language'],
    },
    response: false,
  },
  // 요청·응답 본문(학생 코드, stdout, 튜터 답변) 수집 안 함
  httpBodies: [],
  // `/auth/callback?code=…` 같은 쿼리 수집 안 함
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  // LLM 프롬프트(학생 코드 포함)와 답변 수집 안 함
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  // 스택 프레임 지역 변수(학생 코드·프롬프트가 들어 있음) 수집 안 함
  stackFrameVariables: false,
} satisfies DataCollection;
