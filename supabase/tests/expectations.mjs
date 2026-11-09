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
  'B03-3': {
    expect: 'allow',
    note: '게시판 작성자 표시. 컬럼은 id·display_name·avatar_url(NULL)·avatar_skin (P3-13 ① 00021)',
  },
  'B03-4': { expect: 'deny' },
  'B03-5': { expect: 'deny' },
  'B03-6': { expect: 'deny' },
  'B03-7': { expect: 'deny' },
  'B03-7b': { expect: 'deny' },
  'B03-8': { expect: 'deny' },
  'B03-11': { expect: 'allow' },
  'VIEW-1': { expect: 'deny', note: '앞으로 만드는 뷰에도 적용' },
  'VIEW-2': {
    expect: 'deny',
    note: 'B34 ① 00018: user_profiles_public 은 security_invoker 로 user_public_profiles 를 읽음 (Advisors security_definer_view 0). 앞으로 만드는 뷰에도 적용',
  },
  // 공개 프로필 테이블 (B34, 00018)
  'PP-1': {
    expect: 'deny',
    requires: 'public.user_public_profiles',
    activateIn: 'B34',
    note: '비로그인은 공개 이름도 못 봄 (B03 과 같음)',
  },
  'PP-2': {
    expect: 'deny',
    requires: 'public.user_public_profiles',
    activateIn: 'B34',
    note: '다른 아이의 공개 이름 바꾸기(사칭)·행 지우기(게시글 연쇄 삭제)·끼워 넣기',
  },
  'PP-3': {
    expect: 'allow',
    requires: 'public.user_public_profiles',
    activateIn: 'B34',
    note: '동기화 트리거: 가입 → 모험가NNNN, 닉네임 변경 → 공개 이름 (P3-11 처럼 authenticated 에 UPDATE (nickname) 을 줘도 트리거가 씀)',
  },
  'PP-4': {
    expect: 'deny',
    requires: 'public.user_public_profiles',
    activateIn: 'B34',
    note: 'users 행이 있는데 공개 프로필 행이 없거나 이름이 다른 사용자 수 = 0 (FK 대상이 없으면 게시판 쓰기가 실패)',
  },
  'PP-5': {
    expect: 'allow',
    requires: 'public.user_public_profiles.avatar_skin',
    activateIn: 'P3-13',
    note: '① 00021: 공개 아바타 = avatar_config.skin 을 동기화 트리거가 6종 id 만 복사 (모르는 값·다른 키는 공개 안 됨, 직접 쓰기 거부, CHECK)',
  },
  'NM-1': {
    expect: 'allow',
    requires: 'public.placeholder_display_name()',
    activateIn: 'P3-13',
    note: '③ 00022: 기존 사용자 users.display_name 실명 → 모험가NNNN, avatar_url 사진 → 빈 값 (되돌릴 수 없음, 닉네임은 그대로)',
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
    expect: 'deny',
    note: 'P1-01 ③ 00008: users UPDATE 는 preferred_provider 컬럼만 (XP·레벨은 complete_quest·reset_progress RPC)',
  },
  'B04-2': {
    expect: 'deny',
    note: 'P1-01 ③ 00008 (황금키는 use_golden_key RPC)',
  },
  'B04-3': { expect: 'deny' },
  'B04-4': {
    expect: 'deny',
    note: 'P1-04 ③ 00011: user_progress INSERT 는 진행 저장 컬럼만 (완료는 complete_quest RPC)',
  },
  'B04-4b': {
    expect: 'deny',
    note: 'P1-04 ③ 00011: status·completed_at UPDATE 권한 없음',
  },
  'B04-5': {
    expect: 'deny',
    note: 'P1-04 ③ 00011: user_badges 는 SELECT 만 (지급은 complete_quest)',
  },
  'B04-5b': {
    expect: 'deny',
    note: 'P1-04 ③ 00011: user_badges DELETE 권한·정책 없음 (reset_progress RPC, 탈퇴는 admin deleteUser 의 cascade)',
  },
  'B04-6': { expect: 'deny' },
  'B04-7': { expect: 'deny', note: 'P1-01 ③ 00008 (psql 직접 UPDATE)' },
  'B04-8': {
    expect: 'deny',
    note: 'B13 ③ 00009: users.custom_api_keys 컬럼 삭제 (키는 service_role 전용 user_api_keys 에 암호문으로, apikey 그룹 UK-*)',
  },
  'B04-9': { expect: 'deny' },
  'B04-10': { expect: 'deny' },
  'B04-11': {
    expect: 'deny',
    note: 'P1-04 ③ 00011 (B05): hints_used 는 record_hint RPC 전용 (튜터 API 가 힌트를 보낼 때 기록)',
  },
  'B04-12': {
    expect: 'deny',
    note: 'P1-04 ③ 00011 (B05): used_golden_key 는 use_golden_key RPC 전용',
  },
  'B04-13': {
    expect: 'deny',
    requires: 'public.users.coins',
    activateIn: 'P8-03',
    note: 'coins 는 Phase 8 에서 만듦 (P1-08 범위 아님)',
  },
  'B04-14': {
    expect: 'deny',
    requires: 'public.user_progress.stars',
    activateIn: 'P1-08',
    note: 'P1-08 00012: 서버 값. ③ 00011 컬럼 권한에 없음 + 보호 트리거(①만 적용된 동안)',
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
  'B04-19': {
    expect: 'deny',
    note: 'P1-01: UPDATE 권한은 앱이 쓰는 preferred_provider 만. 새 프로필 컬럼(nickname·settings 등)은 그 컬럼을 만드는 작업(P1-08·P3)에서 GRANT UPDATE (…) 추가',
  },
  'B04-20': {
    expect: 'deny',
    note: '허용 컬럼에 서버 값을 섞으면 요청 전체가 42501',
  },
  'B04-21': {
    expect: 'deny',
    note: 'P1-01: users INSERT 권한·users_insert_own 정책 제거 (가입은 handle_new_user 트리거)',
  },
  'B04-22': {
    expect: 'deny',
    note: 'P1-04 ③ 00011: 이전 앱 auto-save payload(hints_used·status 포함)는 42501. 허용 컬럼에 서버 값을 섞으면 요청 전체가 거부됨',
  },
  'B04-23': {
    expect: 'deny',
    note: 'P1-04 ③ 00011: upsert 때문에 UPDATE (quest_id) 권한이 있어도 키 고정 트리거가 막음 (완료 행을 다른 퀘스트로 옮기기)',
  },
  'B04-24': {
    expect: 'deny',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
    note: 'P1-04 ③ 00011: progress DELETE 권한·progress_delete_own 정책 제거 → 지우고 다시 완료해 XP 반복 획득 불가',
  },
  'B04-25': {
    expect: 'deny',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
    note: 'P1-04 ③ 00011: status 를 되돌리고 다시 완료해 XP 반복 획득 불가',
  },
  'B04-26': {
    expect: 'deny',
    note: 'P1-04 ③ 00011 (B05): psql 직접 UPDATE hints_used',
  },

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
    note: '새 DB 에도 solution_code 가 있음 (P1-12부터 content/에서 생성한 seed.sql이 quest_answer_keys 에 직접 씀). 운영 재현 시나리오에서는 생략',
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

  // ── apikey: 사용자 API 키 테이블 (B13, service_role 전용) ───
  ...Object.fromEntries(
    [
      ['UK-1', 'deny'],
      ['UK-2', 'deny'],
      ['UK-3', 'deny'],
      ['UK-4', 'deny'],
      ['UK-5', 'deny'],
      ['UK-6', 'deny'],
      ['UK-7', 'deny'],
      ['UK-8', 'deny'],
      ['UK-9', 'deny'],
      ['UK-10', 'deny'],
      ['UK-11', 'allow', '설정·튜터·월드맵 서버 경로'],
      ['UK-12', 'allow', '/api/settings 키 저장 (서버 경로)'],
      ['UK-13', 'allow', '탈퇴(/api/account/delete) 시 키도 함께 삭제'],
    ].map(([id, expect, note]) => [
      id,
      {
        expect,
        requires: 'public.user_api_keys',
        activateIn: 'B13',
        ...(note ? { note } : {}),
      },
    ]),
  ),

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
  'RPC-3': {
    expect: 'deny',
    requires: 'public.use_golden_key()',
    activateIn: 'P1-03',
  },
  'RPC-4': {
    expect: 'deny',
    requires: 'public.reset_progress()',
    activateIn: 'P1-03',
    note: '다른 사용자 id 로 리셋 시도',
  },
  'RPC-5': {
    expect: 'deny',
    requires: 'public.reset_progress()',
    activateIn: 'P1-03',
  },
  'RPC-6': {
    expect: 'deny',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
    note: '보상 규칙 함수·트리거 함수 포함 (모두 service_role 전용). P1-04 의 record_hint·user_progress_lock_keys 도',
  },
  'RPC-7': {
    expect: 'deny',
    requires: 'public.record_hint()',
    activateIn: 'P1-04',
    note: '힌트 수는 튜터 API(service_role)만 기록',
  },
  'SET-1': {
    expect: 'deny',
    requires: 'public.patch_user_settings()',
    activateIn: 'P2-14',
    note: '설정(motion·sound) 쓰기는 /api/settings(service_role)만. 클라이언트 settings UPDATE 권한도 없음(PF-2)',
  },
  'SET-2': {
    expect: 'allow',
    requires: 'public.patch_user_settings()',
    activateIn: 'P2-14',
    note: 'P2-15 이월: 읽고-합쳐-쓰기 대신 settings || patch 한 문장 (00020). motion·sound 동시 갱신에도 둘 다 남음',
  },

  // ── reward: 보상 RPC 동작 (P1-03, B05·B06·B11·B12) ─────────
  'RW-1': {
    expect: 'allow',
    requires: 'public.quest_xp()',
    activateIn: 'P1-03',
    note: 'fixtures/reward-rules.json = SQL. TS 쪽은 vitest rewardRules.test.ts 가 같은 표로 확인',
  },
  'RW-2': {
    expect: 'allow',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
    note: 'B06 동시 완료 → 1회 지급',
  },
  'RW-3': {
    expect: 'allow',
    requires: 'public.use_golden_key()',
    activateIn: 'P1-03',
  },
  'RW-4': {
    expect: 'allow',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
    note: 'B05·B11, Q25(00019): 황금키 첫 완료는 뱃지 없음 → 처음 직접 푼 완료에서 first_code',
  },
  'RW-12': {
    expect: 'allow',
    requires: 'public.complete_quest()',
    activateIn: 'Q25',
    note: '00019: 황금키 완료로 스테이지 클리어는 되지만 stage_clear 없음, 황금키 퀘스트가 섞인 스테이지를 직접 풀어 클리어하면 받음',
  },
  'RW-13': {
    expect: 'allow',
    requires: 'public.complete_quest()',
    activateIn: 'Q25',
    note: '00019: streak_3 는 직접 푼 완료일만 셈',
  },
  'RW-5': {
    expect: 'allow',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
    note: 'B05 스테이지 잠금 + 채점 미통과',
  },
  'RW-6': {
    expect: 'allow',
    requires: 'public.complete_quest()',
    activateIn: 'P1-03',
  },
  'RW-7': {
    expect: 'allow',
    requires: 'public.reset_progress()',
    activateIn: 'P1-03',
    note: 'B12',
  },
  'RW-8': {
    expect: 'allow',
    requires: 'public.reset_progress()',
    activateIn: 'P1-03',
    note: 'B12',
  },
  'RW-9': {
    expect: 'deny',
    requires: 'public.user_progress.earned_xp',
    activateIn: 'P1-03',
  },
  'RW-10': {
    expect: 'allow',
    requires: 'public.user_progress.earned_xp',
    activateIn: 'P1-03',
    note: '런북 ②-확인 뒤 백필 재실행과 같은 동작',
  },
  'RW-11': {
    expect: 'allow',
    requires: 'public.record_hint()',
    activateIn: 'P1-04',
    note: 'record_hint: 코드 퀘스트는 받은 최고 단계, 프로젝트는 누적, 완료 뒤에는 그대로, 새 행은 in_progress',
  },

  // ── schema: P1-08 스키마 확장 (00012) ──────────────────────
  ...Object.fromEntries(
    [
      ['WD-1', 'deny', 'public.worlds', '비로그인은 worlds 권한 없음 (stages·quests 처럼 로그인 사용자만)'],
      ['WD-2', 'allow', 'public.worlds', '로그인 사용자 월드 조회 (1월드 고정 id c1000000-…-01)'],
      ['WD-3', 'deny', 'public.worlds', '쓰기는 service_role(콘텐츠 seed)만'],
      ['WD-4', 'allow', 'public.worlds', '00012 백필 + 콘텐츠 seed 결과'],
      ['WD-5', 'allow', 'public.worlds', 'is_stage_unlocked·reset_progress 가 (월드 order, 스테이지 order) 순서'],
      ['WD-6', 'allow', 'public.worlds'],
      ['QA-1', 'deny', 'public.quiz_attempts', '시도 기록은 채점 RPC(service_role)만 씀'],
      ['QA-2', 'deny', 'public.quiz_attempts'],
      ['QA-3', 'deny', 'public.quiz_attempts'],
      ['QA-4', 'deny', 'public.quiz_attempts'],
      ['QA-5', 'allow', 'public.quiz_attempts', '본인 시도만 조회 (quiz_attempts_select_own)'],
      ['PF-1', 'deny', 'public.users.nickname', '지금은 UI 가 없어 UPDATE 권한 없음. P3-11 닉네임 설정에서 GRANT UPDATE (nickname) 와 함께 allow 로'],
      ['PF-2', 'deny', 'public.users.settings', 'P2-15·P0-15 설정 화면에서 GRANT UPDATE (settings) 와 함께 allow 로'],
      ['PF-3', 'deny', 'public.users.avatar_config', 'P3-11 캐릭터·학년에서 GRANT UPDATE (avatar_config, grade) 와 함께 allow 로'],
      ['PF-4', 'deny', 'public.users.last_login_provider', '서버 값 (로그인 트리거 00013)'],
      ['PF-5', 'allow', 'public.users.settings', '§2.2 settings 기본 형태'],
      ['NK-1', 'allow', 'public.users.nickname', '§12-Q14: 완성형 2,350자를 DB CHECK 로 정확히 판정'],
      ['NK-2', 'allow', 'public.users.nickname'],
      ['NK-3', 'allow', 'public.users.nickname', 'P3-11 중복 확인을 DB 가 보장 (lower(nickname) UNIQUE)'],
    ].map(([id, expect, requires, note]) => [
      id,
      { expect, requires, activateIn: 'P1-08', ...(note ? { note } : {}) },
    ]),
  ),
  'KST-1': {
    expect: 'allow',
    requires: 'public.kst_date()',
    activateIn: 'P1-08',
    note: 'TS 는 src/lib/time/kst.ts (P1-05)',
  },
  'RPC-8': {
    expect: 'deny',
    requires: 'public.kst_date()',
    activateIn: 'P1-08',
  },

  // ── auth: 가입·로그인 트리거 (B24, B16, 00013) ──────────────
  'B16-1': {
    expect: 'deny',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
    note: '§2.8: provider 이름·사진을 공개 필드에 넣지 않음. 00013 전에 가입한 운영 사용자 행은 P3-12·P3-13',
  },
  'B16-2': {
    expect: 'allow',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
  },
  'B24-1': {
    expect: 'allow',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
  },
  'B24-2': {
    expect: 'allow',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
    note: 'app_metadata.provider 는 첫 identity 로 고정이라 쓰지 않음 (§2.2, P0-04)',
  },
  // P3-06: 실측 메타데이터 모양(P0-03·P0-04)으로 가입·로그인 (00013 동작 고정)
  'SU-1': {
    expect: 'allow',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
    note: 'P3-06: Google·Kakao(동의/미동의)·custom:kakao·custom:naver(id_token 클레임만)·모르는 OIDC·email 가입. 이메일 없어도 가입, 공개 필드는 자리표시자뿐',
  },
  'SU-2': {
    expect: 'allow',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
    note: 'P3-06: provider·iss 정규화 표. src/lib/auth 의 TS 정규화(providerFromIssuer 등)와 같은 값이어야 함',
  },
  'SU-3': {
    expect: 'deny',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
    note: 'P3-06·§2.8: 트리거는 provider·iss 만 읽음. 이메일·실명·닉네임·사진은 읽지도 않음 (온보딩 제안값은 클라이언트가 만들고 DB 에 저장하지 않음)',
  },
  'SU-4': {
    expect: 'allow',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
    note: 'P3-06: 소셜이 아닌 provider 는 NULL (모르는 값을 그대로 넣으면 CHECK 위반으로 가입 실패)',
  },
  'LG-1': {
    expect: 'allow',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
    note: 'P3-06·P3-08: 연결 계정은 로그인한 identity 의 iss 로. 로그인 트리거는 last_login_* 만 바꿈',
  },
  'RPC-9': {
    expect: 'deny',
    requires: 'public.handle_user_signed_in()',
    activateIn: 'B24',
  },

  // ── app: 앱이 실제로 보내는 쿼리 (정상 경로) ────────────────
  'APP-1': { expect: 'allow' },
  'APP-2': { expect: 'allow' },
  'APP-3': { expect: 'allow' },
  'APP-4': {
    expect: 'allow',
    note: 'B13 이후 custom_api_keys 를 select 하지 않음. P3-13: display_name·avatar_url 대신 user_public_profiles(public_name, avatar_skin) 임베딩 (src/lib/avatar/ownProfile.ts)',
  },
  'APP-5': { expect: 'allow' },
  'APP-6': { expect: 'allow' },
  'APP-7': { expect: 'allow' },
  'APP-8': { expect: 'allow' },
  'APP-9': { expect: 'allow' },
  'APP-10': { expect: 'allow' },
  'APP-11': { expect: 'allow' },
  'APP-12': { expect: 'allow' },
  'APP-16': {
    expect: 'allow',
    requires: 'public.user_seen_unlocks',
    activateIn: 'P5-05',
    note: '월드맵 서버 조회의 본 기록 (본인 행만 돌아옴)',
  },
  'APP-15': {
    expect: 'allow',
    requires: 'public.users.age_band',
    activateIn: 'P3-15',
    note: '로그인 레이아웃의 users 조회 한 번 (움직임·사운드 설정 + 온보딩 관문 + 보호자 동의 상태, P3-11·P3-15)',
  },
  'APP-13': {
    expect: 'allow',
    note: '게시판 목록 작성자 표시 (user_profiles_public 임베딩). P1-18 00014: 닉네임 없는 사용자는 모험가NNNN (실명이면 real-name 으로 FAIL)',
  },
  'APP-14': {
    expect: 'allow',
    note: '게시글 댓글 작성자 표시 (APP-13 과 같음)',
  },
  'APP-W1': {
    expect: 'allow',
    note: 'P1-04 이후 QuestShell auto-save payload {user_id, quest_id, code_submitted}. 새 행의 status 는 기본값 in_progress(00010). 이전 payload 는 B04-22',
  },
  'APP-W2': {
    expect: 'allow',
    note: 'P1-04 이후에도 허용되어야 하는 진행 저장 컬럼',
  },
  'APP-W3': {
    expect: 'allow',
    note: '/api/settings 의 AI 선택 저장. P1-01 이후 users 에서 클라이언트가 UPDATE 할 수 있는 유일한 컬럼',
  },
  'APP-W4': {
    expect: 'allow',
    note: 'P1-18: /api/board/posts 가 금칙어 검사 후 service_role 로 INSERT (사용자 클라이언트 경로는 BW-1 deny)',
  },
  'APP-W5': { expect: 'allow', note: 'P1-18: 글 수정 service_role (BW-2)' },
  'APP-W6': { expect: 'allow', note: 'P1-18: 댓글 쓰기 service_role (BW-4)' },
  'APP-W7': { expect: 'allow', note: 'P1-18: 댓글 삭제 service_role (BW-5)' },
  'APP-W8': { expect: 'allow', note: 'P1-18: 글 삭제 service_role (BW-3)' },
  'APP-W9': { expect: 'deny' },
  'APP-W10': {
    expect: 'deny',
    note: 'P1-04 ③ 00011: 이전 리셋 API 의 경로. 지금 앱은 reset_progress RPC·admin cascade 로만 지움',
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

  // ── board: 게시판 안전장치 (P1-18, B19, 00014·00015) ───────
  'B19-1': {
    expect: 'deny',
    note: '① 00014 CHECK board_posts_title_check: 제목 100자 이하 (service_role 도 막힘 = DB 가 마지막 방어선)',
  },
  'B19-2': { expect: 'deny', note: '① 00014: 공백뿐인 제목' },
  'B19-3': { expect: 'deny', note: '① 00014: 내용 2,000자 이하' },
  'B19-4': { expect: 'deny', note: '① 00014: 댓글 500자 이하' },
  'B19-5': { expect: 'deny', note: '① 00014: 빈 댓글' },
  'B19-6': {
    expect: 'allow',
    note: '경계: 이모지 제목 100자(코드 포인트)·내용 2,000자는 저장. API 도 같은 기준(src/lib/board/limits.ts charCount)',
  },
  'B19-7': {
    expect: 'deny',
    note: '원래 B19: 로그인 사용자가 REST 로 직접 긴 제목 INSERT. ①만이면 CHECK(23514), ③ 00015 뒤에는 권한(42501)',
  },
  'B19-8': {
    expect: 'deny',
    note: '새 DB 는 위반 행이 없어 3개 모두 VALID. 운영에 위반 행이 있으면 00014 가 NOT VALID 로 추가 → 런북에서 정리 후 VALIDATE',
  },
  'BW-1': {
    expect: 'deny',
    note: '③ 00015: board_posts INSERT 권한·정책 없음 (금칙어 필터 우회 차단). 앱은 APP-W4 (service_role)',
  },
  'BW-2': { expect: 'deny', note: '③ 00015: 본인 글 UPDATE 도 서버 경유 (APP-W5)' },
  'BW-3': { expect: 'deny', note: '③ 00015: 본인 글 DELETE 도 서버 경유 (APP-W8)' },
  'BW-4': { expect: 'deny', note: '③ 00015: board_comments INSERT (APP-W6)' },
  'BW-5': { expect: 'deny', note: '③ 00015: 본인 댓글 DELETE (APP-W7)' },
  'BW-6': { expect: 'deny' },
  'BH-1': { expect: 'deny', note: '① 00014: 신고로 숨긴 남의 글은 안 보임' },
  'BH-2': {
    expect: 'deny',
    note: '① 00014: 숨긴 글의 댓글은 (내가 쓴 것이라도) 글이 안 보이면 안 보임',
  },
  'BH-3': { expect: 'allow', note: '① 00014: 작성자는 자기 숨긴 글을 봄 ("나만 볼 수 있어요" 안내)' },
  'BH-4': {
    expect: 'deny',
    note: '① 00014 보호 트리거: ③ 전(클라이언트 쓰기 권한이 남은 동안) is_hidden·hidden_at 을 바꿔도 버림',
  },
  'BR-1': { expect: 'deny' },
  'BR-2': { expect: 'deny', note: '① 00014: board_reports 는 service_role 전용 (신고자 비공개)' },
  'BR-3': { expect: 'deny' },
  'BR-4': {
    expect: 'deny',
    note: '① 00014: report_board_content 는 service_role 전용 (신고자 id 는 API 가 getUser() 로)',
  },
  'BR-5': { expect: 'allow', note: '/api/board/reports 경로' },
  'BR-6': {
    expect: 'allow',
    note: '신고 규칙: UNIQUE(신고자, 대상), 본인 글 불가, 서로 다른 3명이면 is_hidden (REPORT_HIDE_THRESHOLD)',
  },
  'BR-7': { expect: 'deny' },
  'VIEW-3': {
    expect: 'deny',
    note: 'P1-18 ① 00014: 뷰 이름 = coalesce(nickname, 모험가NNNN), avatar_url NULL. 실명·사진이 있는 기존 사용자도 (X1). 뷰 구조 교체는 P3-13(VIEW-2)',
  },

  // ── ratelimit: 사용자별 요청 한도 (P1-19, 00016) ───────────
  // 첫 로그인 온보딩 (P3-11, ① 00023)
  'OB-1': { expect: 'deny', requires: 'public.user_agreements', activateIn: 'P3-11' },
  'OB-2': {
    expect: 'deny',
    requires: 'public.user_agreements',
    activateIn: 'P3-11',
    note: '약관 동의 기록은 service_role 전용 (본인도 읽기·지우기 불가, 법적 기록)',
  },
  'OB-3': { expect: 'deny', requires: 'public.user_agreements', activateIn: 'P3-11' },
  'OB-4': {
    expect: 'deny',
    requires: 'public.complete_onboarding()',
    activateIn: 'P3-11',
    note: '닉네임·완료 시각은 /api/onboarding(금칙어 검사) → service_role RPC 로만. users UPDATE 는 ③ 00008 그대로 preferred_provider 만',
  },
  'OB-5': {
    expect: 'deny',
    requires: 'public.is_nickname_taken()',
    activateIn: 'P3-11',
    note: '중복 확인은 /api/profile/nickname(사용자별 한도) 경유만',
  },
  'OB-6': {
    expect: 'allow',
    requires: 'public.complete_onboarding()',
    activateIn: 'P3-11',
    note: '① 00023 complete_onboarding 한 트랜잭션 · avatar_config 합치기 · 처음 시각 유지 · 23505 롤백',
  },
  // 잠금 해제 연출 본 기록 (P5-05, ① 00025)
  'UL-1': { expect: 'deny', requires: 'public.user_seen_unlocks', activateIn: 'P5-05' },
  'UL-2': {
    expect: 'deny',
    requires: 'public.user_seen_unlocks',
    activateIn: 'P5-05',
    note: '본인 행만 (RLS (select auth.uid()))',
  },
  'UL-3': {
    expect: 'deny',
    requires: 'public.record_seen_unlocks()',
    activateIn: 'P5-05',
    note: '쓰기는 /api/world/unlocks → service_role RPC 만 (잠긴 스테이지는 is_stage_unlocked 로 거름). authenticated 는 SELECT 만',
  },
  'UL-4': {
    expect: 'allow',
    requires: 'public.record_seen_unlocks()',
    activateIn: 'P5-05',
    note: '① 00025 record_seen_unlocks: 열린 스테이지만 · ON CONFLICT DO NOTHING · 상한 256 · users ON DELETE CASCADE',
  },
  // 만 14세 미만 법정대리인 동의 (P3-15, ① 00024)
  'GC-1': {
    expect: 'deny',
    requires: 'public.users.age_band',
    activateIn: 'P3-15',
    note: '나이 확인 결과·동의 시각·파기 기한은 클라이언트가 못 바꿈 (③ 00008 UPDATE 는 preferred_provider 만)',
  },
  'GC-2': {
    expect: 'deny',
    requires: 'public.record_guardian_consent()',
    activateIn: 'P3-15',
    note: '보호자 동의 기록·파기 대상 목록은 service_role 전용 (/api/consent/guardian · /api/cron/purge-unconsented)',
  },
  'GC-3': {
    expect: 'allow',
    requires: 'public.record_guardian_consent()',
    activateIn: 'P3-15',
    note: '① 00024 complete_onboarding 9인자: 결과만 저장·한 번 정하면 그대로, 미동의 30일 기한, 보호자 동의 method guardian_in_person',
  },
  'GC-4': {
    expect: 'allow',
    requires: 'public.list_expired_unconsented()',
    activateIn: 'P3-15',
    note: '파기 대상은 기한 지난 미동의 만 14세 미만만',
  },
  'RL-1': { expect: 'deny', requires: 'public.api_rate_limits', activateIn: 'P1-19' },
  'RL-2': {
    expect: 'deny',
    requires: 'public.api_rate_limits',
    activateIn: 'P1-19',
    note: '① 00016: api_rate_limits 는 service_role 전용 (튜터 사용 시각 비공개)',
  },
  'RL-3': {
    expect: 'deny',
    requires: 'public.api_rate_limits',
    activateIn: 'P1-19',
    note: '클라이언트가 카운터를 0 으로 되돌리면 한도가 풀림',
  },
  'RL-4': { expect: 'deny', requires: 'public.api_rate_limits', activateIn: 'P1-19' },
  'RL-5': {
    expect: 'deny',
    requires: 'public.consume_rate_limit()',
    activateIn: 'P1-19',
    note: '① 00016: consume_rate_limit 는 service_role 전용 (사용자 id 는 튜터 API 가 getUser() 로). 열리면 남의 한도를 다 써 버릴 수 있음',
  },
  'RL-5b': { expect: 'deny', requires: 'public.consume_rate_limit()', activateIn: 'P1-19' },
  'RL-6': {
    expect: 'allow',
    requires: 'public.consume_rate_limit()',
    activateIn: 'P1-19',
    note: '동시 요청에서 한도 정확 (행 FOR UPDATE). 튜터 API 의 service_role 경로',
  },
  'RL-7': {
    expect: 'allow',
    requires: 'public.consume_rate_limit()',
    activateIn: 'P1-19',
    note: '창 경과·KST 하루 창·버킷 독립·인자 검증·2일 넘은 행 정리·탈퇴 cascade',
  },
  'RL-8': { expect: 'deny', requires: 'public.api_rate_limits', activateIn: 'P1-19' },

  // ── analytics: 익명 분석 이벤트 (P1-17, 00017) ─────────────
  'AN-1': { expect: 'deny', requires: 'public.analytics_events', activateIn: 'P1-17' },
  'AN-2': {
    expect: 'deny',
    requires: 'public.analytics_events',
    activateIn: 'P1-17',
    note: '① 00017: analytics_events 는 service_role 전용 (다른 아이의 이용 기록 비공개)',
  },
  'AN-3': {
    expect: 'deny',
    requires: 'public.analytics_events',
    activateIn: 'P1-17',
    note: '클라이언트가 직접 쓰면 퍼널·완료 지표를 부풀림. 브라우저 이벤트는 /api/analytics(zod 허용 목록) 경유',
  },
  'AN-4': { expect: 'deny', requires: 'public.analytics_events', activateIn: 'P1-17' },
  'AN-5': { expect: 'deny', requires: 'public.analytics_events', activateIn: 'P1-17' },
  'AN-6': {
    expect: 'deny',
    requires: 'public.consume_global_rate_limit()',
    activateIn: 'P1-17',
    note: 'prune_analytics_events·consume_global_rate_limit 는 service_role 전용 (기록 지우기·비로그인 한도 소진)',
  },
  'AN-7': {
    expect: 'allow',
    requires: 'public.consume_global_rate_limit()',
    activateIn: 'P1-17',
    note: '서버 경로: upsert dedupe(ON CONFLICT DO NOTHING), CHECK, UPDATE 불가, 180일 정리, 전역 한도',
  },
  'AN-8': { expect: 'deny', requires: 'public.analytics_events', activateIn: 'P1-17' },

  // ── account: 탈퇴 (B28) ────────────────────────────────────
  'B28-1': {
    expect: 'deny',
    note: '사용자를 가리키는 FK 는 모두 ON DELETE CASCADE (board_reports.target_user_id SET NULL 만 의도한 예외), FK 없는 사용자 열 없음',
  },
  'B28-2': {
    expect: 'allow',
    note: '/api/account/delete 경로(auth.admin.deleteUser + HMAC 분석 기록 삭제) 뒤 public·auth 의 모든 uuid 열과 analytics_events 에 그 사용자 값 0',
  },
  'B28-3': {
    expect: 'deny',
    note: '클라이언트는 users 를 지울 수 없음 (DELETE 권한·정책 없음, P1-01 00008). 탈퇴는 서버 API 만',
  },

  // ── static: 카탈로그 점검 ─────────────────────────────────
  'ST-1': { expect: 'deny', note: 'public 의 모든 테이블에 RLS' },
  'ST-2': {
    expect: 'deny',
    note: 'anon/authenticated 가 RPC 로 부를 수 있는 SECURITY DEFINER 함수 없음',
  },
  'ST-3': {
    expect: 'deny',
    note: 'B24 ③ 00013: handle_new_user·handle_user_signed_in EXECUTE 회수 (트리거는 권한 없이도 동작: createUser·APP-W1·W2)',
  },
  'ST-4': {
    expect: 'deny',
    note: 'B24 ③ 00013: SECURITY DEFINER 함수 모두 SET search_path',
  },
  'ST-6': {
    expect: 'deny',
    note: 'B24 ③ 00013: prevent_status_downgrade 포함 public 함수 모두 search_path 고정. kst_date 는 인라인용 예외 (P1-08)',
  },
  'ST-5': {
    expect: 'deny',
    note: 'B34 auth_rls_initplan: auth.uid()/auth.role() 를 (select …) 로 감싸지 않은 정책 수 = 0 (P1-01 users 3 + P1-04 ③ 00011 나머지 16). 새 정책도 감싸서 씀',
  },
  'ST-7': {
    expect: 'deny',
    note: 'B34: supabase db advisors (CLI 내장 splinter) Security·Performance ERROR 0. Phase 1 완료 목표, P12-05 재점검',
  },
  'ST-8': {
    expect: 'deny',
    note: 'B34: 의도한 WARN(function_search_path_mutable: kst_date, P1-08) 말고 WARN 없음. 새 WARN 은 고치거나 여기 목록에 이유와 함께 추가',
  },
  'ST-9': { expect: 'info', note: 'Advisors INFO (unused_index·rls_enabled_no_policy 등) 기록' },
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
