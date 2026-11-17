#!/usr/bin/env bash
# ============================================================
# v1.0 운영 DB 마이그레이션 리허설 (P12-07) — 결과: docs/release/v1.0-rehearsal.md
#
# 별도 스테이징 Supabase 프로젝트가 없어서, 격리 로컬 스택에 운영(v0.9)을 재현하고 기존 사용자 복제본 대신
# 합성 데이터(rehearsal-data.sql)를 넣은 뒤 v1.0 묶음을 운영과 같은 방식(CRLF, 파일 그대로)으로 적용합니다.
# 운영 DB 에는 접속하지 않습니다(로컬 컨테이너 docker exec 만). 켜진 pyroad 스택과 무관합니다.
#
#   bash scripts/release/rehearse-v1.0.sh all     # up → data → 전 스냅샷 → 적용 → 후 스냅샷·비교 → 점검 → 롤백 → 재적용 → down
#   bash scripts/release/rehearse-v1.0.sh up|data|snap <이름>|apply|rollback|checks|scale|down   # 단계별 (REH_KEEP=1 과 함께 디버깅)
#
# 환경 변수: REH_PROJECT_ID(기본 pyroadreh) · REH_PORT_BASE(기본 54920, api +1 db +2) · REH_WORKDIR(기본 /tmp/pyroad-rehearsal)
#            REH_KEEP=1  all 이 끝나도 스택을 내리지 않음 · REH_SCALE_USERS(scale: 기본 2000명)
# 필요: Docker, Supabase CLI 2.115.0, Node 22+, git (운영 재현에 00001 핫픽스 전 판과 운영 seed 를 git 에서 꺼냄)
# ============================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PROJECT_ID="${REH_PROJECT_ID:-pyroadreh}"
PORT_BASE="${REH_PORT_BASE:-54920}"
WORKDIR="${REH_WORKDIR:-/tmp/pyroad-rehearsal}"
OUT="$WORKDIR/out"
DB="supabase_db_${PROJECT_ID}"
PREHOTFIX_REV="2f0a8f3^" # supabase/tests/run.sh 와 같음: 운영에 적용된 00001
PROD_SEED_REV="e800386"  #                              운영의 첫 콘텐츠 seed
EXCLUDE="realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
V10="v1.0-phase12"
T0=$SECONDS

[[ "$PROJECT_ID" != pyroad && "$PORT_BASE" != 54520 ]] || { echo "개발 스택(pyroad·5452x)과 겹침" >&2; exit 2; }
log() { printf '\n\033[1;34m== %s\033[0m  (%ss)\n' "$*" "$((SECONDS - T0))"; }
die() { echo "오류: $*" >&2; exit 1; }
psql_q() { docker exec -i "$DB" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

# SQL Editor 붙여넣기와 같게: CRLF 사본을 파일 그대로(안의 BEGIN/COMMIT) 적용, NOTICE 를 보여 주고 걸린 시간을 남김
paste_sql() { # <파일> <기록 이름>
  local crlf="$OUT/$2.crlf.sql" t
  perl -pe "s/\n/\r\n/" "$1" >"$crlf"
  grep -q $'\r$' "$crlf" || die "CRLF 변환 실패"
  t=$(date +%s%N)
  psql_q <"$crlf" 2>&1 | tr -d '\r' | tee "$OUT/$2.log"
  echo "$2 $(((($(date +%s%N) - t)) / 1000000))ms" | tee -a "$OUT/timings.txt"
  psql_q -c "NOTIFY pgrst, 'reload schema';" >/dev/null </dev/null
}

snap() { # <이름> → out/snap-<이름>.tsv (scripts/release/snapshot.sql, 읽기 전용) + 스키마 덤프
  psql_q -At -F $'\t' <"$HERE/snapshot.sql" >"$OUT/snap-$1.tsv"
  docker exec "$DB" pg_dump -U postgres -d postgres --schema-only --schema=public --schema=auth --no-owner | grep -vE '^\\(un)?restrict ' >"$OUT/schema-$1.sql"
  echo "스냅샷 $1: $(wc -l <"$OUT/snap-$1.tsv") 줄"
}

cmd_up() {
  log "격리 스택 $PROJECT_ID (api $((PORT_BASE + 1)) · db $((PORT_BASE + 2))) · $WORKDIR"
  rm -rf "$WORKDIR/supabase" "$OUT"
  mkdir -p "$WORKDIR/supabase/migrations" "$OUT"
  local cfg="$WORKDIR/supabase/config.toml"
  cp "$REPO/supabase/config.toml" "$cfg"
  perl -pi -e "s/^project_id = .*/project_id = \"$PROJECT_ID\"/" "$cfg"
  perl -pi -e "s/^(\\w*port = )(545\\d\\d)\$/\$1.(\$2 - 54520 + $PORT_BASE)/e" "$cfg"
  ! grep -qE '^\w*port = 545[0-9]{2}$' "$cfg" || die "포트 변환 실패"
  # 운영은 legacy 기본값(새 테이블 자동 노출)
  perl -pi -e "s/^# auto_expose_new_tables = true\$/auto_expose_new_tables = true/" "$cfg"
  grep -q "^auto_expose_new_tables = true$" "$cfg" || die "auto_expose_new_tables 설정 실패"
  # 운영 재현 (supabase/tests/run.sh ① RLS_CRLF=1 과 같은 경로): 핫픽스 전 00001 + 운영 seed → Section 6 → 00002 → 릴리즈 묶음(CRLF)
  git -C "$REPO" show "$PREHOTFIX_REV:supabase/migrations/00001_v0.1.0_initial_schema.sql" >"$WORKDIR/supabase/migrations/00001_v0.1.0_initial_schema.sql"
  git -C "$REPO" show "$PROD_SEED_REV:supabase/seed.sql" >"$WORKDIR/supabase/seed.sql"
  supabase start -x "$EXCLUDE" --workdir "$WORKDIR" >/dev/null || die "supabase start 실패"
  sed -n '/^-- Section 6/,/^-- Section 7/p' "$WORKDIR/supabase/migrations/00001_v0.1.0_initial_schema.sql" | psql_q -1 >/dev/null
  psql_q -1 <"$REPO"/supabase/migrations/00002_*.sql >/dev/null
  # v0.9 까지의 릴리즈 묶음 = 운영에 붙여 넣은 것 (v1.0 묶음 제외)
  local rels=() f
  while IFS= read -r r; do [[ "$r" == "$V10" ]] || rels+=(--release "$r"); done < <(
    node -e "import('$HERE/build-release-sql.mjs').then(m=>console.log(m.RELEASES.map(r=>r.name).join('\n')))")
  while IFS= read -r f; do
    log "v0.9 운영 재현: ${f#"$WORKDIR/release/"}"
    paste_sql "$f" "v09-$(basename "$(dirname "$f")")-$(basename "$f" .sql)" >/dev/null
  done < <(node "$HERE/build-release-sql.mjs" --out "$WORKDIR/release" "${rels[@]}" --list)
  local last
  last=$(psql_q -At -c "select count(*) from public.quests; select count(*) from public.achievements; select count(*) from public.shop_items; select to_regprocedure('public.list_expired_incomplete(integer,uuid,timestamptz)') is null")
  echo "운영 재현 상태 (퀘스트 · 업적 · 상점 · 00061 없음): $(tr '\n' ' ' <<<"$last")"
  : >"$OUT/timings.txt"
}

cmd_data() {
  log "합성 기존 사용자 데이터 (rehearsal-data.sql)"
  psql_q <"$HERE/rehearsal-data.sql" 2>&1 | tr -d '\r' | tee "$OUT/data.log"
}

cmd_apply() { # [기록 이름]
  local name="${1:-apply1}"
  node "$HERE/build-release-sql.mjs" --out "$WORKDIR/release" --release "$V10" >/dev/null
  log "v1.0 묶음 적용 ($name): CRLF, 파일 그대로"
  paste_sql "$WORKDIR/release/$V10/1_먼저실행.sql" "$name"
}

# 런북 1-2 백업(pg_dump 데이터 전용 2개 + 스키마)을 뜨고 → 사용자 표를 모두 비운 뒤 → pg_restore 로 되살려 스냅샷이 같은지
cmd_restore() {
  log "백업·복원 리허설 (런북 1-2 의 pg_dump 명령, 로컬 컨테이너의 pg_dump 17)"
  docker exec "$DB" pg_dump -U postgres -d postgres --data-only --schema=public -Fc >"$OUT/public.dump"
  docker exec "$DB" pg_dump -U postgres -d postgres --data-only --table=auth.users --table=auth.identities -Fc >"$OUT/auth.dump"
  docker exec "$DB" pg_dump -U postgres -d postgres --schema-only --schema=public >"$OUT/schema-dump.sql"
  ls -l "$OUT"/*.dump | awk '{print $5, $NF}'
  log "사고 흉내: public 의 모든 표 + auth.users·identities 비우기"
  psql_q -c "do \$\$ begin execute (select 'truncate ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' cascade'
              from pg_tables where schemaname = 'public' or (schemaname = 'auth' and tablename in ('users', 'identities'))); end \$\$;" </dev/null
  psql_q -At -c "select count(*) from public.users" </dev/null | sed 's/^/비운 뒤 users: /'
  # 데이터 전용 복원은 트리거(가입 → public.users 등)를 꺼야 두 번 들어가지 않음 → 슈퍼유저(supabase_admin)로
  docker exec -i "$DB" pg_restore -U supabase_admin -d postgres --data-only --disable-triggers <"$OUT/auth.dump"
  docker exec -i "$DB" pg_restore -U supabase_admin -d postgres --data-only --disable-triggers <"$OUT/public.dump"
  snap restored
}

# B132: 다른 트랜잭션이 user_progress 를 오래 잡고 있으면 묶음은 10초 뒤 잠금 시간 초과로 전체가 되돌려져야 함
cmd_locktest() {
  log "잠금 시험: user_progress 를 20초 잡은 세션이 있을 때 v1.0 묶음"
  psql_q -c "begin; lock table public.user_progress in access share mode; select pg_sleep(20); commit;" </dev/null >/dev/null &
  sleep 1
  node "$HERE/build-release-sql.mjs" --out "$WORKDIR/release" --release "$V10" >/dev/null
  perl -pe 's/\n/\r\n/' "$WORKDIR/release/$V10/1_먼저실행.sql" >"$OUT/locktest.crlf.sql"
  local t=$SECONDS
  if psql_q <"$OUT/locktest.crlf.sql" >"$OUT/locktest.log" 2>&1; then die "잠금 시험: 묶음이 성공함 (lock_timeout 없음?)"; fi
  grep -q 'lock timeout' "$OUT/locktest.log" || { cat "$OUT/locktest.log"; die "잠금 시험: lock timeout 이 아닌 오류"; }
  [[ "$(psql_q -At -c "select to_regprocedure('public.strip_google_profile()') is null and to_regprocedure('public.list_expired_incomplete(integer,uuid,timestamptz)') is null" </dev/null)" == t ]] \
    || die "잠금 시험: 실패했는데 일부가 남음"
  echo "PASS 잠금 시험: $((SECONDS - t))초 뒤 '$(grep -o 'ERROR: .*' "$OUT/locktest.log" | head -1)' → 전체 되돌림 (00059 트리거·00061 함수 없음)"
  wait
}

cmd_rollback() {
  log "롤백 (런북 3-3 SQL 그대로 = supabase/rollback/00061 → 00060 → 00059)"
  runbook_sql '-- 00061' >"$OUT/rollback.sql"
  # 런북 블록이 supabase/rollback/ 파일과 같은 문장인지 (주석·대소문자·공백 무시)
  norm() { sed -e 's/--.*$//' "$@" | tr 'A-Z' 'a-z' | tr -s ' \n' ' ' | sed 's/; */;\n/g' | sed 's/^ *//' | grep -v '^$' | grep -vE '^(begin|commit);' | sort; }
  diff <(norm "$OUT/rollback.sql") <(norm "$REPO"/supabase/rollback/0006[01]_*.sql "$REPO"/supabase/rollback/00059_*.sql) \
    || die "런북 3-3 롤백 SQL 이 supabase/rollback/ 과 다름"
  paste_sql "$OUT/rollback.sql" rollback
}

cmd_checks() {
  log "점검 (rehearsal-checks.sql + 런북 2-7 정리 SQL)"
  runbook_sql '-- 정리 (Google identity' | grep -viE '^(begin|commit);$' >"$OUT/clean-google.sql"
  CLEAN="$OUT/clean-google.sql" perl -pe 'BEGIN { local $/; open my $f, "<", $ENV{CLEAN}; $c = <$f>; } s/^-- \@runbook .*\n/$c/' "$HERE/rehearsal-checks.sql" >"$OUT/checks.sql"
  grep -q 'update auth.users u set raw_user_meta_data' "$OUT/checks.sql" || die "런북 2-7 SQL 을 끼워 넣지 못함"
  psql_q <"$OUT/checks.sql" 2>&1 | tr -d '\r' | tee "$OUT/checks.log"
  ! grep -q '^FAIL\|ERROR' "$OUT/checks.log" || die "점검 실패 (위 FAIL)"
}

same() { # <스냅샷 A> <스냅샷 B> <설명>
  if diff -u "$OUT/snap-$1.tsv" "$OUT/snap-$2.tsv" >"$OUT/diff-$1-$2.txt"; then
    echo "PASS 스냅샷 $1 = $2 ($3)"
  else
    cat "$OUT/diff-$1-$2.txt"; die "스냅샷 $1 ≠ $2 ($3)"
  fi
}
schema_same() { # <A> <B> <설명>  (00061 의 유예 시작 상수만 다를 수 있음)
  if diff <(sed -E 's/to_timestamp\([0-9.]+\)/to_timestamp(T)/' "$OUT/schema-$1.sql") \
          <(sed -E 's/to_timestamp\([0-9.]+\)/to_timestamp(T)/' "$OUT/schema-$2.sql") >"$OUT/schemadiff-$1-$2.txt"; then
    echo "PASS 스키마 $1 = $2 ($3)"
  else
    cat "$OUT/schemadiff-$1-$2.txt"; die "스키마 $1 ≠ $2 ($3)"
  fi
}

# 런북(docs/release/v1.0-runbook.md)에서 <표시> 가 들어 있는 ```sql 블록을 그대로 꺼냄 → 리허설이 런북 문장을 그대로 돌림
runbook_sql() {
  awk -v m="$1" '/^```sql$/ {b = ""; on = 1; next} on && /^```$/ {on = 0; if (index(b, m)) {printf "%s", b; found = 1; exit}} on {b = b $0 "\n"} END {exit !found}' \
    "$REPO/docs/release/v1.0-runbook.md" || die "런북에서 '$1' SQL 블록을 찾지 못함"
}

# 00060 이 NOT VALID 로 들어갔을 때 런북 2-1 ⚠️ 정리 → VALIDATE (런북 SQL 그대로)
cmd_validate() {
  log "00060 넘는 행 정리 → VALIDATE (런북 2-1 ⚠️, 런북 SQL 그대로)"
  runbook_sql '-- 정리 (5만 자' >"$OUT/validate.sql"
  paste_sql "$OUT/validate.sql" validate
}

# 운영 규모 가늠: 롤백한 DB 에 진행 행을 REH_SCALE_USERS × 100개(코드 1KB) 더 넣고 묶음 적용 시간과
# 그동안 다른 세션의 user_progress 쓰기가 기다린 시간(= ACCESS EXCLUSIVE 잠금 시간)을 잼
cmd_scale() {
  local n="${REH_SCALE_USERS:-2000}"
  log "규모 시험: 사용자 $n 명 × 진행 100행"
  psql_q -1 <<SQL >/dev/null
insert into auth.users (instance_id, id, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', md5('scale:' || g)::uuid, 'authenticated', 'authenticated',
       '{"provider":"kakao"}', '{"iss":"https://kauth.kakao.com"}', now(), now() from generate_series(1, $n) as g
on conflict (id) do nothing;
insert into public.user_progress (user_id, quest_id, status, code_submitted)
select md5('scale:' || g)::uuid, q.id, 'in_progress', repeat(md5(g::text || q.id::text), 32)
  from generate_series(1, $n) as g, (select id from public.quests order by id limit 100) as q
on conflict (user_id, quest_id) do nothing;
analyze public.user_progress;
SQL
  psql_q -At -c "select count(*), pg_size_pretty(pg_total_relation_size('public.user_progress')) from public.user_progress" </dev/null | tee "$OUT/scale-size.txt"
  node "$HERE/build-release-sql.mjs" --out "$WORKDIR/release" --release "$V10" >/dev/null
  # 묶음이 user_progress 에 ACCESS EXCLUSIVE 를 잡는 순간 학생 자동 저장 1건 → 기다린 시간 = 잠금 시간
  (until [[ "$(psql_q -At -c "select count(*) from pg_locks where relation = 'public.user_progress'::regclass and mode = 'AccessExclusiveLock'" </dev/null)" != 0 ]]; do :; done
   psql_q -c '\timing on' -c "update public.user_progress set current_step = current_step where user_id = md5('scale:1')::uuid and quest_id = (select id from public.quests order by id limit 1)" </dev/null >"$OUT/scale-writer.log" 2>&1) &
  { echo '\timing on'; perl -pe 's/\n/\r\n/' "$WORKDIR/release/$V10/1_먼저실행.sql"; } | psql_q 2>&1 | tr -d '\r' | grep -E 'Time:|NOTICE' | tee "$OUT/scale-apply.log"
  wait
  echo "자동 저장 1건이 기다린 시간: $(grep -o 'Time: .*' "$OUT/scale-writer.log")" | tee -a "$OUT/scale-apply.log"
}

cmd_down() {
  log "스택 정리 (supabase stop --no-backup)"
  supabase stop --no-backup --workdir "$WORKDIR" >/dev/null 2>&1 || true
}

cmd_all() {
  [[ "${REH_KEEP:-0}" == 1 ]] || trap cmd_down EXIT
  cmd_up
  cmd_data
  snap before
  cmd_restore
  same before restored "백업에서 복원하면 모든 표가 같음"
  cmd_locktest
  snap locktest
  same before locktest "잠금 시간 초과로 되돌린 뒤 그대로"
  schema_same before locktest "잠금 시간 초과로 되돌린 뒤 그대로"
  cmd_apply apply1
  grep -q '^NOTICE:  \[00060\] ⚠️ 이미 상한을 넘는 행: 코드 1 · 단계 코드 1 · provider 0' "$OUT/apply1.log" || die "00060 NOT VALID NOTICE 가 다름"
  snap after1
  same before after1 "적용 전후 데이터 손실 0"
  cmd_apply apply2
  snap after2
  same after1 after2 "두 번 적용해도 같음"
  schema_same after1 after2 "두 번 적용해도 같음"
  cmd_rollback
  snap rolledback
  same before rolledback "롤백은 사용자 데이터를 지우지 않음"
  schema_same before rolledback "롤백하면 v0.9 스키마"
  cmd_apply apply3
  snap after3
  same before after3 "롤백 뒤 다시 적용"
  cmd_checks
  if diff "$OUT/schema-before.sql" "$OUT/schema-after1.sql" | grep -q '^<'; then die "v1.0 이 기존 스키마를 바꾸거나 지움 (옛 앱 호환)"; fi
  echo "PASS 스키마 before → after1 은 추가만 (diff 에 '<' 없음: 옛 앱이 쓰는 객체 그대로)"
  cmd_validate
  cmd_apply apply4
  grep -q '^NOTICE:  \[00060\] 크기 CHECK 3개 (모두 VALID)' "$OUT/apply4.log" || die "정리 뒤 00060 이 VALID 가 아님"
  snap after4
  echo; cat "$OUT/timings.txt"
  cmd_rollback
  cmd_scale
}

case "${1:-}" in
  all | up | data | apply | restore | locktest | rollback | checks | validate | scale | down) "cmd_$1" "${@:2}" ;;
  snap) snap "$2" ;;
  same) same "$2" "$3" "${4:-}" ;;
  *) echo "사용: $0 all|up|data|snap <이름>|apply [이름]|restore|locktest|rollback|checks|validate|scale|down" >&2; exit 2 ;;
esac
