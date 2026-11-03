#!/usr/bin/env bash
# ============================================================
# P0-08 검증 스크립트 (P1-20 RLS 회귀 테스트의 씨앗)
#
# 격리된 로컬 Supabase 스택을 띄워 시나리오별로 마이그레이션을 적용하고,
# PostgREST HTTP API + psql(SET ROLE)로 접근 점검을 실행한 뒤 스택을 내립니다.
# 운영 DB 에는 접속하지 않습니다. 저장소 파일은 읽기만 합니다.
#
# 필요: Docker, Supabase CLI(2.115 에서 확인), Node 22+, git(운영 재현 시나리오용)
#
# 사용
#   bash spikes/p0-08-answer-keys/verify.sh
#
# 환경 변수 (모두 선택)
#   P008_PROJECT_ID   기본 p008answers   (컨테이너 이름 supabase_*_<id>)
#   P008_PORT_BASE    기본 54620         (api=+1 db=+2 … shadow=+0. 다른 로컬 스택과 겹치지 않게)
#   P008_WORKDIR      기본 mktemp -d     (supabase init 할 임시 디렉토리)
#   P008_RESULTS      기본 <이 디렉토리>/results/results.jsonl
#   P008_KEEP=1       끝나도 스택을 내리지 않음 (디버깅용)
#   P008_SKIP_PROD=1  운영 재현 시나리오(git 의 핫픽스 이전 00001 필요) 건너뜀
#   P008_SKIP_NEWDEFAULT=1  "새 테이블 자동 노출 꺼짐" 시나리오 건너뜀 (스택 재시작 1회 절약)
#
# 종료 코드: 모든 점검의 기대값이 맞으면 0, 하나라도 다르면 1
# ============================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PROJECT_ID="${P008_PROJECT_ID:-p008answers}"
PORT_BASE="${P008_PORT_BASE:-54620}"
WORKDIR="${P008_WORKDIR:-$(mktemp -d)}"
RESULTS="${P008_RESULTS:-$HERE/results/results.jsonl}"
KEEP="${P008_KEEP:-0}"
PREHOTFIX_REV="2f0a8f3^"   # 00002 핫픽스 직전 커밋 = 운영 DB 에 적용된 00001
DB_CONTAINER="supabase_db_${PROJECT_ID}"
EXCLUDE="realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
MIG="$REPO/supabase/migrations"
FAILED=0
STARTED=0

log() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }

cleanup() {
  if [[ "$STARTED" == 1 && "$KEEP" != 1 ]]; then
    log "스택 정리 (supabase stop --no-backup)"
    supabase stop --no-backup --workdir "$WORKDIR" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# config.toml 생성: 프로젝트 id·포트·불필요 서비스 끄기·자동 노출 모드
init_project() {
  local mode="$1"   # legacy | new
  rm -rf "$WORKDIR/supabase"
  mkdir -p "$WORKDIR"
  (cd "$WORKDIR" && supabase init --force >/dev/null 2>&1)
  local cfg="$WORKDIR/supabase/config.toml"
  sed -i -E \
    -e "s/^project_id = .*/project_id = \"$PROJECT_ID\"/" \
    -e "s/^port = 54321$/port = $((PORT_BASE + 1))/" \
    -e "s/^port = 54322$/port = $((PORT_BASE + 2))/" \
    -e "s/^shadow_port = 54320$/shadow_port = $((PORT_BASE + 0))/" \
    -e "s/^port = 54323$/port = $((PORT_BASE + 3))/" \
    -e "s/^port = 54324$/port = $((PORT_BASE + 4))/" \
    -e "s/^port = 54327$/port = $((PORT_BASE + 7))/" \
    -e "s/^port = 54329$/port = $((PORT_BASE + 9))/" \
    "$cfg"
  for sec in realtime studio local_smtp storage edge_runtime analytics; do
    sed -i -E "/^\[$sec\]$/,/^enabled = / s/^enabled = true$/enabled = false/" "$cfg"
  done
  if [[ "$mode" == legacy ]]; then
    # 운영(기존 프로젝트)처럼 public 의 새 테이블·함수를 anon/authenticated/service_role 에 자동 부여
    sed -i -E 's/^# auto_expose_new_tables = true$/auto_expose_new_tables = true/' "$cfg"
    grep -q '^auto_expose_new_tables = true$' "$cfg" || { echo "auto_expose_new_tables 설정 실패"; exit 2; }
  fi
  mkdir -p "$WORKDIR/supabase/migrations"
  cp "$REPO/supabase/seed.sql" "$WORKDIR/supabase/seed.sql"
}

# 마이그레이션 폴더 구성: 인자 = "원본경로:대상파일명" 목록
set_migrations() {
  rm -f "$WORKDIR/supabase/migrations/"*.sql
  for pair in "$@"; do
    cp "${pair%%:*}" "$WORKDIR/supabase/migrations/${pair##*:}"
  done
}

start_stack() {
  supabase start -x "$EXCLUDE" --workdir "$WORKDIR" >/dev/null
  STARTED=1
  load_env
}

reset_db() {
  supabase db reset --local --workdir "$WORKDIR" --yes >/dev/null
  load_env
}

load_env() {
  local envs
  envs="$(supabase status -o env --workdir "$WORKDIR" 2>/dev/null)"
  P008_API_URL="$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$envs")"
  P008_ANON_KEY="$(sed -n 's/^ANON_KEY="\(.*\)"$/\1/p' <<<"$envs")"
  P008_SERVICE_ROLE_KEY="$(sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p' <<<"$envs")"
  export P008_API_URL P008_ANON_KEY P008_SERVICE_ROLE_KEY
  export P008_DB_CONTAINER="$DB_CONTAINER" P008_REPO="$REPO" P008_RESULTS="$RESULTS"
  # PostgREST 가 스키마 캐시를 다시 읽을 때까지 대기
  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null -H "apikey: $P008_ANON_KEY" "$P008_API_URL/rest/v1/" && return 0
    sleep 1
  done
  echo "API 준비 안 됨"; exit 2
}

apply_sql() {   # 파일을 한 트랜잭션으로 적용 (실패하면 중단)
  local out rc
  out="$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -1 <"$1" 2>&1)" && rc=0 || rc=$?
  grep -v 'does not exist, skipping' <<<"$out" || true
  [[ "$rc" == 0 ]] || { echo "SQL 적용 실패 ($rc): $1"; exit 2; }
  # PostgREST 스키마 캐시 갱신 (새 테이블·함수 인식)
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -c "NOTIFY pgrst, 'reload schema';" >/dev/null
  sleep 1
}

section6() {   # 00001 Section 6 (solution_code UPDATE) 만 추출
  sed -n '/^-- Section 6/,/^-- Section 7/p' "$MIG/00001_v0.1.0_initial_schema.sql"
}

run() {
  log "점검: $1"
  node "$HERE/checks.mjs" "$1" || FAILED=1
}

mkdir -p "$(dirname "$RESULTS")"
: >"$RESULTS"
log "작업 디렉토리 $WORKDIR · 포트 $((PORT_BASE + 1))(api) $((PORT_BASE + 2))(db)"

# ── 1) 운영 재현: 핫픽스 이전 00001 + seed + Section 6 재실행 ──
init_project legacy
if [[ "${P008_SKIP_PROD:-0}" != 1 ]] && git -C "$REPO" cat-file -e "$PREHOTFIX_REV:supabase/migrations/00001_v0.1.0_initial_schema.sql" 2>/dev/null; then
  git -C "$REPO" show "$PREHOTFIX_REV:supabase/migrations/00001_v0.1.0_initial_schema.sql" >"$WORKDIR/00001_prehotfix.sql"
  set_migrations "$WORKDIR/00001_prehotfix.sql:00001_v0.1.0_initial_schema.sql"
  log "스택 시작 (운영 재현)"
  start_stack
  section6 >"$WORKDIR/section6.sql"
  apply_sql "$WORKDIR/section6.sql"
  run prod_baseline

  log "00002 핫픽스 적용 (2회: 멱등성 확인)"
  apply_sql "$MIG/00002_v0.3.1_security_hotfix.sql"
  apply_sql "$MIG/00002_v0.3.1_security_hotfix.sql"
  run prod_plus_00002
  log "운영 읽기 전용 점검 쿼리 (prod_readonly_checks.sql) 로컬 실행"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 <"$HERE/prod_readonly_checks.sql"

  log "00003 초안 적용 (기존 데이터가 있는 DB)"
  apply_sql "$HERE/00003_quest_answer_keys.draft.sql"
  run prod_plus_00003

  log "00003 되돌리기 → 원본과 동일한지 → 재적용"
  snap="select md5(string_agg(id::text || expected_output || prompt_skeleton::text, '|' order by id)) from public.quests"
  apply_sql "$HERE/00003_quest_answer_keys.rollback.draft.sql"
  after_rb="$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -At -c "$snap")"
  pristine="$( { echo 'BEGIN;'; cat "$REPO/supabase/seed.sql"; section6; echo "$snap;"; echo 'ROLLBACK;'; } \
    | docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -At -q -v ON_ERROR_STOP=1 | tail -1)"
  if [[ "$after_rb" == "$pristine" ]]; then
    echo "PASS  [rollback] RB-1 되돌린 quests 가 seed+Section6 원본과 동일 ($after_rb)"
    echo '{"scenario":"prod_plus_00003","group":"rollback","id":"RB-1","role":"postgres","op":"rollback 후 quests 전체 md5 = seed+Section6 원본 md5","expected":"identical","actual":"identical","pass":true,"kind":"security","detail":"'"$after_rb"'"}' >>"$RESULTS"
  else
    echo "FAIL  [rollback] RB-1 $after_rb != $pristine"; FAILED=1
    echo '{"scenario":"prod_plus_00003","group":"rollback","id":"RB-1","role":"postgres","op":"rollback 후 quests 전체 md5 = seed+Section6 원본 md5","expected":"identical","actual":"different","pass":false,"kind":"security","detail":""}' >>"$RESULTS"
  fi
  apply_sql "$HERE/00003_quest_answer_keys.draft.sql"
else
  log "운영 재현 시나리오 건너뜀 (P008_SKIP_PROD 또는 git 히스토리 없음)"
  set_migrations "$MIG/00001_v0.1.0_initial_schema.sql:00001_v0.1.0_initial_schema.sql"
  start_stack
fi

# ── 2) 새 DB: 현재 저장소 그대로 (00001 + 00002 → seed) ──
log "db reset: 현재 저장소 마이그레이션 + seed"
set_migrations \
  "$MIG/00001_v0.1.0_initial_schema.sql:00001_v0.1.0_initial_schema.sql" \
  "$MIG/00002_v0.3.1_security_hotfix.sql:00002_v0.3.1_security_hotfix.sql"
reset_db
run fresh_repo

log "대안: 컬럼 단위 권한 (비교 실험)"
apply_sql "$HERE/alt_column_privileges.sql"
run alt_column_privs

# ── 3) 새 DB: 00003 을 마이그레이션에 포함 (00003 → seed 순서) ──
log "db reset: 00001 + 00002 + 00003 초안 → seed"
set_migrations \
  "$MIG/00001_v0.1.0_initial_schema.sql:00001_v0.1.0_initial_schema.sql" \
  "$MIG/00002_v0.3.1_security_hotfix.sql:00002_v0.3.1_security_hotfix.sql" \
  "$HERE/00003_quest_answer_keys.draft.sql:00003_quest_answer_keys.sql"
reset_db
run fresh_with_00003

log "퀴즈 픽스처 + 채점 RPC 초안 + 노출형 대안"
apply_sql "$HERE/fixtures/quiz_fixture.sql"
apply_sql "$HERE/grade_quiz_rpc.draft.sql"
apply_sql "$HERE/alt_grade_quiz_exposed.sql"
run quiz_rpc

log "supabase db lint / advisors (참고용, 실패해도 계속)"
supabase db lint --local --workdir "$WORKDIR" --level warning 2>/dev/null | head -20 || true
ADV="$(dirname "$RESULTS")/advisors.json"
supabase db advisors --local --workdir "$WORKDIR" --type all --level info --output-format json 2>/dev/null >"$ADV" || true
node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).results ?? [];
  const by = {};
  for (const x of r) (by[`${x.level} ${x.name}`] ??= []).push(x.metadata?.name);
  for (const [k, v] of Object.entries(by).sort()) console.log(`${k}: ${[...new Set(v)].join(", ")}`);
' "$ADV" || true

# ── 4) 새 테이블 자동 노출이 꺼진 신규 기본값 ──
if [[ "${P008_SKIP_NEWDEFAULT:-0}" != 1 ]]; then
  log "스택 재시작: auto_expose_new_tables 미설정 (신규 기본값)"
  supabase stop --no-backup --workdir "$WORKDIR" >/dev/null
  STARTED=0
  init_project new
  set_migrations \
    "$MIG/00001_v0.1.0_initial_schema.sql:00001_v0.1.0_initial_schema.sql" \
    "$MIG/00002_v0.3.1_security_hotfix.sql:00002_v0.3.1_security_hotfix.sql" \
    "$HERE/00003_quest_answer_keys.draft.sql:00003_quest_answer_keys.sql"
  start_stack
  run new_default_privs
fi

node "$HERE/summarize.mjs" "$RESULTS" >"$(dirname "$RESULTS")/results.md"
log "결과: $(dirname "$RESULTS")/results.md"
tail -n 3 "$(dirname "$RESULTS")/results.md"
exit "$FAILED"
