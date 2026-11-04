// ============================================================
// pyRoad RLS·권한 회귀 테스트 기대값 (P1-20)
//
// 점검 동작(무엇을 요청하고 결과를 어떻게 분류하는지)은 checks.mjs 에 있고,
// 이 파일은 "지금 기대하는 결과"만 적습니다. 권한을 바꾸는 작업은 보통 여기 한 줄만 고칩니다.
//
//   expect
//     'deny'       막혀야 함. 열려 있으면 FAIL
//     'allow'      앱 정상 경로라 동작해야 함. 막히면 FAIL
//     'known-gap'  지금 열려 있는 구멍. 열려 있으면 GAP(통과로 집계),
//                  막혀 있으면 FAIL → flipIn 작업에서 'deny' 로 바꿈 (막힌 줄 모르고 지나가지 않게)
//     'snapshot'   snapshots/<파일>.txt 와 같아야 함. 의도한 변경이면 RLS_UPDATE_SNAPSHOTS=1 로 갱신
//     'info'       기록만 (통과/실패에 영향 없음)
//   flipIn      기대값을 바꿀 작업 ID (known-gap → deny, 앱 쿼리가 바뀌는 allow 등)
//   requires    이 객체가 생기기 전까지는 PENDING 으로 건너뜀. 생기면 자동으로 점검 시작
//               'public.t'(테이블·뷰) | 'public.t.col'(컬럼) | 'public.fn()'(함수)
//   activateIn  requires 객체를 만드는 작업 ID (참고용)
//   note        사람이 읽는 설명
// ============================================================

export const EXPECT = {
  // ── env: 스택 기본 권한 (참고) ──────────────────────────────
  'ENV-1': {
    expect: 'info',
    note: '새 테이블 자동 노출(legacy) 여부. 시나리오마다 다름',
  },
  'ENV-2': { expect: 'info', note: '새 함수 EXECUTE 기본 권한' },

  // ── view: 뷰를 통한 조회·쓰기 (B03) ────────────────────────
  'B03-1': { expect: 'deny' },
  'B03-2': { expect: 'deny' },
  'B03-3': { expect: 'allow', note: '게시판 작성자 표시' },
  'B03-4': { expect: 'deny' },
  'B03-5': { expect: 'deny' },
  'B03-6': { expect: 'deny' },
  'B03-7': { expect: 'deny' },
  'B03-7b': { expect: 'deny' },
  'B03-8': { expect: 'deny' },
  'B03-11': { expect: 'allow' },
  'VIEW-1': { expect: 'deny', note: '앞으로 만드는 뷰에도 적용' },
  'VIEW-2': {
    expect: 'known-gap',
    flipIn: 'P3-13',
    note: 'user_profiles_public 이 security_invoker 가 아님 (Advisors security_definer_view)',
  },

  // ── notice: 공지 쓰기 (B02) ────────────────────────────────
  'B02-1': { expect: 'allow', note: '비로그인 공지 목록' },
  'B02-2': { expect: 'deny' },
  'B02-3': { expect: 'deny' },
  'B02-4': { expect: 'deny' },
  'B02-5': { expect: 'deny' },
  'B02-6': { expect: 'deny' },
  'B02-7': { expect: 'deny' },
  'B02-8': { expect: 'allow', note: '/api/notice 관리자 경로 (service_role)' },
  'B02-9': { expect: 'deny' },

  // ── write: XP·코인·별·뱃지·진행 상태 직접 쓰기 (B04, B05, B13) ─
  'B04-1': {
    expect: 'known-gap',
    flipIn: 'P1-01',
    note: '지금은 /api/quest/complete 가 이 경로로 XP 를 씀 → P1-03 RPC 로 옮긴 뒤 회수',
  },
  'B04-2': {
    expect: 'known-gap',
    flipIn: 'P1-01',
    note: '지금은 /api/quest/golden-key 가 이 경로로 씀',
  },
  'B04-3': { expect: 'deny' },
  'B04-4': {
    expect: 'known-gap',
    flipIn: 'P1-04',
    note: '지금은 /api/quest/complete 가 이 경로로 완료 처리',
  },
  'B04-4b': { expect: 'known-gap', flipIn: 'P1-04' },
  'B04-5': {
    expect: 'known-gap',
    flipIn: 'P1-04',
    note: '지금은 checkBadges 가 사용자 클라이언트로 INSERT',
  },
  'B04-5b': {
    expect: 'known-gap',
    flipIn: 'P1-04',
    note: '지금은 /api/account/reset·delete 가 사용자 클라이언트로 DELETE',
  },
  'B04-6': { expect: 'deny' },
  'B04-7': { expect: 'known-gap', flipIn: 'P1-01' },
  'B04-8': {
    expect: 'known-gap',
    flipIn: 'P1-01',
    note: 'B13: custom_api_keys 를 service_role 전용 테이블로 분리',
  },
  'B04-9': { expect: 'deny' },
  'B04-10': { expect: 'deny' },
  'B04-11': {
    expect: 'known-gap',
    flipIn: 'P1-04',
    note: 'B05: hints_used 는 RPC 전용',
  },
  'B04-12': {
    expect: 'known-gap',
    flipIn: 'P1-04',
    note: 'B05: used_golden_key 는 RPC 전용',
  },
  'B04-13': {
    expect: 'deny',
    requires: 'public.users.coins',
    activateIn: 'P1-08',
  },
  'B04-14': {
    expect: 'deny',
    requires: 'public.user_progress.stars',
    activateIn: 'P1-08',
  },
  'B04-15': {
    expect: 'deny',
    requires: 'public.user_progress.best_stars',
    activateIn: 'P1-08',
  },
  'B04-16': {
    expect: 'deny',
    requires: 'public.user_progress.attempts',
    activateIn: 'P1-08',
  },
  'B04-17': {
    expect: 'deny',
    requires: 'public.user_progress.earned_xp',
    activateIn: 'P1-03',
  },
  'B04-18': { expect: 'deny' },

  // ── answer: 정답 데이터 (B07, B08) ─────────────────────────
  'B07-1': { expect: 'deny' },
  'B07-2': {
    expect: 'deny',
    note: 'quests.expected_output (P1-02: 00005 이후 항상 빈 문자열)',
  },
  'B07-3': {
    expect: 'deny',
    note: 'quests.prompt_skeleton 의 hints·solution_code·steps (P1-02: quest_answer_keys 로 이동)',
  },
  'B07-4': {
    expect: 'allow',
    note: 'select=* 가 깨지지 않음 (SELECT 컬럼 권한을 회수하지 않음)',
  },
  'B08-0': {
    expect: 'info',
    note: '운영 재현 시나리오 전용: 운영처럼 solution_code 가 채워졌는지 (44)',
  },
  'B08-1': {
    expect: 'deny',
    note: '새 DB 에도 solution_code 가 있음 (P1-02: seed.sql 끝의 정답 보정 섹션 → 트리거가 quest_answer_keys 로). 운영 재현 시나리오에서는 생략',
  },
  // quest_answer_keys 가 생기면(P1-02) 자동으로 점검 시작
  'AK-1': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-2': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-3': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-4': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-5': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-6': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-7': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-8': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-9': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-10': {
    expect: 'allow',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-11': {
    expect: 'allow',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-12': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-13': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-14': {
    expect: 'allow',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-15': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-16': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
  },
  'AK-17': {
    expect: 'deny',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
    note: "'deny' = 정답이 모두 quest_answer_keys 로 분리됨 (기준값: 퀘스트 44 · solution_code 43 + 프로젝트 단계 5)",
  },

  // ── rpc: 서버 전용 함수 (P1-03) ────────────────────────────
  'RPC-1': {
    expect: 'deny',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
  },
  'RPC-2': {
    expect: 'deny',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
  },

  // ── app: 앱이 실제로 보내는 쿼리 (정상 경로) ────────────────
  'APP-1': { expect: 'allow' },
  'APP-2': { expect: 'allow' },
  'APP-3': { expect: 'allow' },
  'APP-4': {
    expect: 'allow',
    flipIn: 'P1-01',
    note: 'B13 으로 custom_api_keys 가 빠지면 앱 쿼리와 함께 이 점검의 select 를 바꿈',
  },
  'APP-5': { expect: 'allow' },
  'APP-6': { expect: 'allow' },
  'APP-7': { expect: 'allow' },
  'APP-8': { expect: 'allow' },
  'APP-9': { expect: 'allow' },
  'APP-10': { expect: 'allow' },
  'APP-11': { expect: 'allow' },
  'APP-12': { expect: 'allow' },
  'APP-13': {
    expect: 'allow',
    note: '게시판 목록 작성자 표시 (user_profiles_public 임베딩)',
  },
  'APP-14': { expect: 'allow', note: '게시글 댓글 작성자 표시' },
  'APP-W1': {
    expect: 'allow',
    flipIn: 'P1-04',
    note: '지금 앱 auto-save payload(hints_used·status 포함). P1-04 에서 payload 를 바꾸면 점검도 새 payload 로 교체',
  },
  'APP-W2': {
    expect: 'allow',
    note: 'P1-04 이후에도 허용되어야 하는 진행 저장 컬럼',
  },
  'APP-W3': {
    expect: 'allow',
    note: '/api/settings 의 AI 선택 저장. P1-01 이후에도 허용',
  },
  'APP-W4': { expect: 'allow' },
  'APP-W5': { expect: 'allow' },
  'APP-W6': { expect: 'allow' },
  'APP-W7': { expect: 'allow' },
  'APP-W8': { expect: 'allow' },
  'APP-W9': { expect: 'deny' },
  'APP-W10': {
    expect: 'allow',
    note: '/api/account/reset·delete 의 진행 삭제 (사용자 클라이언트)',
  },
  'APP-S1': { expect: 'allow' },
  'APP-S2': {
    expect: 'allow',
    note: '채점 라우트의 quests 조회 (정답은 APP-S4, quests 행은 폴백용). 폴백 제거 때 select 를 줄임',
  },
  'APP-S3': { expect: 'allow', note: '황금키 라우트의 quests 조회 (폴백용)' },
  'APP-S4': {
    expect: 'allow',
    requires: 'public.quest_answer_keys',
    activateIn: 'P1-02',
    note: 'answerKeys.ts fetchAnswerKeyRow (채점·황금키·튜터 힌트)',
  },

  // ── static: 카탈로그 점검 ─────────────────────────────────
  'ST-1': { expect: 'deny', note: 'public 의 모든 테이블에 RLS' },
  'ST-2': {
    expect: 'deny',
    note: 'anon/authenticated 가 RPC 로 부를 수 있는 SECURITY DEFINER 함수 없음',
  },
  'ST-3': {
    expect: 'known-gap',
    flipIn: 'B24',
    note: 'handle_new_user (트리거라 RPC 호출은 실패하지만 EXECUTE 회수)',
  },
  'ST-4': {
    expect: 'known-gap',
    flipIn: 'B24',
    note: 'handle_new_user 에 search_path 미설정',
  },
  'ST-5': {
    expect: 'info',
    note: 'B34 auth_rls_initplan: auth.uid() 를 (select auth.uid()) 로 감싸지 않은 정책 수',
  },
  'SNAP-1': {
    expect: 'snapshot',
    note: 'anon/authenticated 가 실행할 수 있는 SECURITY DEFINER 함수 목록',
  },
  'SNAP-2': {
    expect: 'snapshot',
    note: 'anon/authenticated 의 테이블·뷰·컬럼 권한',
  },
  'SNAP-3': { expect: 'snapshot', note: 'RLS 정책' },
};
