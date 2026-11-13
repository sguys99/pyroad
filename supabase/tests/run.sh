#!/usr/bin/env bash
# ============================================================
# pyRoad RLS·권한 회귀 테스트 (P1-20)
# 출발점: spikes/p0-08-answer-keys/verify.sh (P0-08)
#
# 저장소 마이그레이션(supabase/migrations/000NN_*.sql)과 seed.sql 을 적용한 로컬 DB 에
# PostgREST HTTP API + psql(SET ROLE)로 권한 조작을 시도하고, expectations.mjs 의 기대값과 비교합니다.
# 운영 DB 에는 접속하지 않습니다 (API 주소가 127.0.0.1/localhost 가 아니면 중단).
#
# 사용
#   npm run test:rls      = bash supabase/tests/run.sh fast
#   npm run test:rls:ci   = bash supabase/tests/run.sh ci
#
# 모드
#   fast  이미 켜진 pyroad 로컬 스택(npm run db:start)에 db reset 후 점검. 개발자 일상용
#   ci    별도 project id·포트로 임시 스택을 띄워 시나리오를 돌리고 내림. 켜진 pyroad 스택과 무관
#         ① prod_replay       운영 재현: 핫픽스 전 00001 + 운영 seed + Section 6 → 00002~ 를 psql -1 로 적용
#                             (릴리즈 순서대로: 머리 주석이 "릴리즈 단계: ③" 인 파일은 나머지 파일 뒤에)
#                             → 콘텐츠 seed(supabase/seed.sql, P1-12 생성물)를 ③ 뒤에 적용 (런북 "콘텐츠 seed 적용")
#         ② fresh_legacy      새 DB, 새 테이블 자동 노출 켜짐 (운영과 같은 legacy 기본값)
#         ③ fresh_newdefault  새 DB, 자동 노출 꺼짐 (CLI 신규 기본값, 스택 재시작 1회)
#
# 환경 변수 (모두 선택)
#   RLS_NO_RESET=1          fast: db reset 생략 (DB 상태를 직접 만든 뒤 점검할 때)
#   RLS_SKIP_PROD=1         ci: ① 생략 (git 히스토리가 없을 때도 자동 생략)
#   RLS_SKIP_NEWDEFAULT=1   ci: ③ 생략 (스택 재시작 1회 절약)
#   RLS_CRLF=1              ci: ① 운영 재현을 운영 붙여넣기 묶음(scripts/release/build-release-sql.mjs 의 모든 릴리즈, 순서대로)을
#                           CRLF 로 바꾼 사본으로, 파일 그대로(파일 안의 BEGIN/COMMIT, psql -1 아님) 적용 (B39).
#                           Windows SQL Editor 붙여넣기 재현. 적용 뒤 \r 이 없는지(CR-1~3), LF 로 적용한 DB 와
#                           콘텐츠가 같은지(CR-4, db reset 뒤) 점검 (supabase/tests/crlf.mjs)
#                           지금 seed.sql 은 seed 가 있는 마지막 묶음(v0.7 ①, 00046 뒤)에만 들어감 — 앞 묶음은 그때 seed 로 이미 운영 적용됨 (B76). CI 는 이 모드
#   RLS_PROJECT_ID          ci: 기본 pyroadrls   (컨테이너 supabase_*_<id>)
#   RLS_PORT_BASE           ci: 기본 54620       (api=+1 db=+2 … config.toml 의 5452x 를 같은 간격으로 옮김)
#   RLS_WORKDIR             ci: 기본 mktemp -d
#   RLS_KEEP=1              ci: 끝나도 임시 스택을 내리지 않음 (디버깅용)
#   RLS_RESULTS_DIR         기본 supabase/tests/.results (results.jsonl, results.md)
#   RLS_UPDATE_SNAPSHOTS=1  snapshots/*.txt 를 현재 상태로 다시 씀 (의도한 권한 변경 뒤)
#
# 필요: Docker, Supabase CLI 2.115.0, Node 22+, git(① 용)
# 종료 코드: FAIL 이 없으면 0, 있으면 1, 환경 문제면 2
# ============================================================
set -euo pipefail

MODE="${1:-fast}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MIG="$REPO/supabase/migrations"
RESULTS_DIR="${RLS_RESULTS_DIR:-$HERE/.results}"
RESULTS="$RESULTS_DIR/results.jsonl"
PREHOTFIX_REV="2f0a8f3^"   # 00002 핫픽스 직전 커밋 = 운영 DB 에 적용된 00001
PROD_SEED_REV="e800386"    # main 의 마지막 손으로 쓴 seed = 운영 DB 의 콘텐츠 (P1-12 전). 지금 seed.sql 은 00004 이후용 생성물
EXCLUDE="realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
FAILED=0
STARTED=0
T0=$SECONDS

log() { printf '\n\033[1;34m== %s\033[0m  (%ss)\n' "$*" "$((SECONDS - T0))"; }
die() { echo "오류: $*" >&2; exit 2; }

# supabase status -o env → RLS_* 환경 변수 (workdir 인자)
load_env() {
  local envs api
  envs="$(supabase status -o env --workdir "$1" 2>/dev/null)" || die "스택 정보를 읽지 못함 ($1)"
  api="$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$envs")"
  [[ "$api" =~ ^http://(127\.0\.0\.1|localhost): ]] || die "API_URL 이 로컬 주소가 아님: '$api' (운영 DB 에는 접속하지 않음)"
  export RLS_API_URL="$api"
  RLS_ANON_KEY="$(sed -n 's/^ANON_KEY="\(.*\)"$/\1/p' <<<"$envs")"
  RLS_SERVICE_ROLE_KEY="$(sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p' <<<"$envs")"
  RLS_DB_URL="$(sed -n 's/^DB_URL="\(.*\)"$/\1/p' <<<"$envs")"   # supabase db advisors 용 (ST-7~9, B34)
  export RLS_ANON_KEY RLS_SERVICE_ROLE_KEY RLS_DB_CONTAINER RLS_DB_URL RLS_RESULTS="$RESULTS"
  # PostgREST 가 스키마 캐시를 다시 읽을 때까지 대기
  for _ in $(seq 1 30); do
    curl -fsS -o /dev/null -H "apikey: $RLS_ANON_KEY" "$RLS_API_URL/rest/v1/" && return 0
    sleep 1
  done
  die "API 준비 안 됨 ($RLS_API_URL)"
}

apply_sql() {   # 파일을 한 트랜잭션으로 적용 (운영 SQL Editor 의 BEGIN; … COMMIT; 과 같음)
  local out rc
  out="$(docker exec -i "$RLS_DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -1 <"$1" 2>&1)" && rc=0 || rc=$?
  grep -v 'does not exist, skipping' <<<"$out" || true
  [[ "$rc" == 0 ]] || die "SQL 적용 실패 ($rc): $1"
  docker exec -i "$RLS_DB_CONTAINER" psql -U postgres -d postgres -q -c "NOTIFY pgrst, 'reload schema';" >/dev/null
  sleep 1
}

apply_sql_as_is() {   # 파일 그대로 적용 (파일 안에 BEGIN; … COMMIT;, SQL Editor 붙여넣기와 같음). NOTICE 는 보여 줌
  local out rc
  out="$(docker exec -i "$RLS_DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 <"$1" 2>&1)" && rc=0 || rc=$?
  grep -v 'does not exist, skipping' <<<"$out" | tr -d '\r' || true
  [[ "$rc" == 0 ]] || die "SQL 적용 실패 ($rc): $1"
  docker exec -i "$RLS_DB_CONTAINER" psql -U postgres -d postgres -q -c "NOTIFY pgrst, 'reload schema';" >/dev/null
  sleep 1
}

run_checks() {
  log "점검: $1"
  node "$HERE/checks.mjs" "$1" || FAILED=1
}

summarize() {
  log "요약"
  node "$HERE/summarize.mjs" "$RESULTS" "$RESULTS_DIR/results.md" || FAILED=1
  echo
  echo "상세: $RESULTS_DIR/results.md · 소요 $((SECONDS - T0))초"
}

mkdir -p "$RESULTS_DIR"
: >"$RESULTS"

# ── fast: 켜져 있는 pyroad 로컬 스택 ─────────────────────────
if [[ "$MODE" == fast ]]; then
  PROJECT_ID="$(sed -n 's/^project_id = "\(.*\)"$/\1/p' "$REPO/supabase/config.toml")"
  RLS_DB_CONTAINER="supabase_db_${PROJECT_ID}"
  docker inspect -f '{{.State.Running}}' "$RLS_DB_CONTAINER" 2>/dev/null | grep -q true \
    || die "$RLS_DB_CONTAINER 가 꺼져 있음. 먼저 npm run db:start"
  if [[ "${RLS_NO_RESET:-0}" != 1 ]]; then
    log "db reset (npm run db:reset: migrations + seed.sql)"
    (cd "$REPO" && supabase db reset --local --yes >/dev/null 2>&1) || die "db reset 실패 (npm run db:reset 로 오류 확인)"
  fi
  load_env "$REPO"
  run_checks local
  summarize
  exit "$FAILED"
fi

[[ "$MODE" == ci ]] || die "알 수 없는 모드 '$MODE' (fast | ci)"

# ── ci: 임시 스택 ────────────────────────────────────────────
PROJECT_ID="${RLS_PROJECT_ID:-pyroadrls}"
PORT_BASE="${RLS_PORT_BASE:-54620}"
[[ "$PROJECT_ID" != pyroad ]] || die "RLS_PROJECT_ID 가 개발 스택(pyroad)과 같음"
[[ "$PORT_BASE" != 54520 ]] || die "RLS_PORT_BASE 가 개발 스택 포트와 같음"
OWN_WORKDIR=0
if [[ -z "${RLS_WORKDIR:-}" ]]; then RLS_WORKDIR="$(mktemp -d)"; OWN_WORKDIR=1; fi
WORKDIR="$RLS_WORKDIR"
RLS_DB_CONTAINER="supabase_db_${PROJECT_ID}"

cleanup() {
  if [[ "$STARTED" == 1 && "${RLS_KEEP:-0}" != 1 ]]; then
    log "임시 스택 정리 (supabase stop --no-backup)"
    supabase stop --no-backup --workdir "$WORKDIR" >/dev/null 2>&1 || true
  fi
  if [[ "$OWN_WORKDIR" == 1 && "${RLS_KEEP:-0}" != 1 ]]; then rm -rf "$WORKDIR"; fi
}
trap cleanup EXIT

# 저장소 config.toml 을 복사해 project id·포트만 바꿈. legacy 면 새 테이블 자동 노출을 켬
init_project() {
  local mode="$1"   # legacy | new
  rm -rf "$WORKDIR/supabase"
  mkdir -p "$WORKDIR/supabase/migrations"
  local cfg="$WORKDIR/supabase/config.toml"
  cp "$REPO/supabase/config.toml" "$cfg"
  cp "$REPO/supabase/seed.sql" "$WORKDIR/supabase/seed.sql"
  sed -i -E "s/^project_id = .*/project_id = \"$PROJECT_ID\"/" "$cfg"
  # port = 545NN / shadow_port / inspector_port → PORT_BASE + (NN - 20)
  perl -pi -e "s/^(\\w*port = )(545\\d\\d)\$/\$1.(\$2 - 54520 + $PORT_BASE)/e" "$cfg"
  if grep -qE '^\w*port = 545[0-9]{2}$' "$cfg"; then die "포트 변환 실패: $cfg"; fi
  if [[ "$mode" == legacy ]]; then
    sed -i -E 's/^# auto_expose_new_tables = true$/auto_expose_new_tables = true/' "$cfg"
    grep -q '^auto_expose_new_tables = true$' "$cfg" || die "auto_expose_new_tables 설정 실패"
  fi
}

# 마이그레이션 폴더 구성: 인자 = "원본경로:대상파일명" 목록
set_migrations() {
  rm -f "$WORKDIR/supabase/migrations/"*.sql
  for pair in "$@"; do
    cp "${pair%%:*}" "$WORKDIR/supabase/migrations/${pair##*:}"
  done
}
repo_migrations() {   # 저장소 마이그레이션 전부 ("경로:이름")
  for f in "$MIG"/*.sql; do printf '%s:%s\n' "$f" "$(basename "$f")"; done
}

start_stack() {
  supabase start -x "$EXCLUDE" --workdir "$WORKDIR" >/dev/null || die "supabase start 실패 ($PROJECT_ID)"
  STARTED=1
  load_env "$WORKDIR"
}

log "임시 스택 $PROJECT_ID · api $((PORT_BASE + 1)) db $((PORT_BASE + 2)) · $WORKDIR"
init_project legacy
# macOS 기본 bash 3.2에는 mapfile이 없어 while read로 (P5-14)
ALL_MIGRATIONS=()
while IFS= read -r line; do ALL_MIGRATIONS+=("$line"); done < <(repo_migrations)

# ① 운영 재현
if [[ "${RLS_SKIP_PROD:-0}" != 1 ]] \
  && git -C "$REPO" cat-file -e "$PREHOTFIX_REV:supabase/migrations/00001_v0.1.0_initial_schema.sql" 2>/dev/null \
  && git -C "$REPO" cat-file -e "$PROD_SEED_REV:supabase/seed.sql" 2>/dev/null; then
  git -C "$REPO" show "$PREHOTFIX_REV:supabase/migrations/00001_v0.1.0_initial_schema.sql" >"$WORKDIR/00001_prehotfix.sql"
  set_migrations "$WORKDIR/00001_prehotfix.sql:00001_v0.1.0_initial_schema.sql"
  # 생성 seed 는 quest_answer_keys(00004)에 쓰므로 핫픽스 전 스키마에는 운영에 들어 있던 예전 seed 를 씀
  git -C "$REPO" show "$PROD_SEED_REV:supabase/seed.sql" >"$WORKDIR/supabase/seed.sql"
  log "스택 시작 (legacy, 운영 재현: 핫픽스 전 00001 + 운영 seed $PROD_SEED_REV)"
  start_stack
  # 운영 데이터처럼 solution_code 채우기 (00001 Section 6 을 seed 뒤에 다시 실행)
  sed -n '/^-- Section 6/,/^-- Section 7/p' "$WORKDIR/00001_prehotfix.sql" >"$WORKDIR/section6.sql"
  apply_sql "$WORKDIR/section6.sql"
  if [[ "${RLS_CRLF:-0}" == 1 ]]; then
    # Windows SQL Editor 붙여넣기 재현 (B39): 00002 는 운영에 이미 적용됨(LF). 그 뒤는 릴리즈마다의 운영 붙여넣기 묶음을
    # CRLF 로 바꾼 사본을 릴리즈 순서대로 파일 그대로 적용 (v0.4: ① → ② 앱 배포 → ③ + 콘텐츠 seed → 00009, v0.5-phase2: ① 00020 …)
    for pair in "${ALL_MIGRATIONS[@]}"; do
      f="${pair%%:*}"
      [[ "$(basename "$f")" == 00002_* ]] || continue
      log "운영 적용 리허설 (이미 운영에 있음): $(basename "$f") (psql -1)"
      apply_sql "$f"
    done
    RELEASE_FILES=()
    while IFS= read -r line; do RELEASE_FILES+=("$line"); done < <(node "$REPO/scripts/release/build-release-sql.mjs" --out "$WORKDIR/release-crlf" --crlf --list)
    [[ "${#RELEASE_FILES[@]}" -gt 0 ]] || die "운영 붙여넣기 묶음을 만들지 못함 (scripts/release/build-release-sql.mjs)"
    for f in "${RELEASE_FILES[@]}"; do
      grep -q $'\r$' "$f" || die "CRLF 변환 실패: $f"
      log "운영 적용 리허설 (CRLF 묶음, 파일 그대로): ${f#"$WORKDIR/release-crlf/"}"
      apply_sql_as_is "$f"
    done
    run_checks prod_replay
    log "점검: CRLF 적용 결과에 \\r 없음 (B39)"
    node "$HERE/crlf.mjs" scan prod_replay "$WORKDIR/crlf-snapshot.json" || FAILED=1
  else
    # 운영 릴리즈 순서: ① 추가형(단계 표시가 없는 예전 파일 포함) → (앱 배포) → ③ 회수형
    for stage in 1 3; do
      for pair in "${ALL_MIGRATIONS[@]}"; do
        f="${pair%%:*}"
        [[ "$(basename "$f")" == 00001_* ]] && continue
        if grep -q '^-- 릴리즈 단계: ③' "$f"; then fstage=3; else fstage=1; fi
        [[ "$fstage" == "$stage" ]] || continue
        log "운영 적용 리허설 (단계 $( [[ $stage == 1 ]] && echo ① || echo ③ )): $(basename "$f") (psql -1)"
        apply_sql "$f"
      done
    done
    log "운영 적용 리허설 (③ 뒤): 콘텐츠 seed supabase/seed.sql (psql -1)"
    apply_sql "$REPO/supabase/seed.sql"
    run_checks prod_replay
  fi
  log "db reset (legacy): 저장소 마이그레이션 + seed"
  set_migrations "${ALL_MIGRATIONS[@]}"
  cp "$REPO/supabase/seed.sql" "$WORKDIR/supabase/seed.sql"
  supabase db reset --local --workdir "$WORKDIR" --yes >/dev/null 2>&1 || die "db reset 실패"
  load_env "$WORKDIR"
  if [[ "${RLS_CRLF:-0}" == 1 ]]; then
    log "점검: CRLF 운영 재현 = LF 로 적용한 DB (B39)"
    node "$HERE/crlf.mjs" compare prod_replay "$WORKDIR/crlf-snapshot.json" || FAILED=1
  fi
else
  log "운영 재현 생략 (RLS_SKIP_PROD 또는 git 히스토리 없음)"
  set_migrations "${ALL_MIGRATIONS[@]}"
  log "스택 시작 (legacy): 저장소 마이그레이션 + seed"
  start_stack
fi
# ② 새 DB, legacy 기본값
run_checks fresh_legacy

# ③ 새 DB, 신규 기본값 (저장소 config.toml 그대로 = 개발 스택과 같은 설정)
if [[ "${RLS_SKIP_NEWDEFAULT:-0}" != 1 ]]; then
  log "스택 재시작 (신규 기본값: 자동 노출 꺼짐)"
  supabase stop --no-backup --workdir "$WORKDIR" >/dev/null 2>&1 || true
  STARTED=0
  init_project new
  set_migrations "${ALL_MIGRATIONS[@]}"
  start_stack
  run_checks fresh_newdefault
else
  log "신규 기본값 시나리오 생략 (RLS_SKIP_NEWDEFAULT)"
fi

summarize
exit "$FAILED"
