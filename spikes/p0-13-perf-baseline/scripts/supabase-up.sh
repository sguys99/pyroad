#!/usr/bin/env bash
# ============================================================
# P0-13: 운영과 비슷한 로컬 Supabase 스택 띄우기 (P0-08 verify.sh 방식 재사용)
#
#   bash spikes/p0-13-perf-baseline/scripts/supabase-up.sh <작업 디렉터리>
#
# - 00001 + 00002 마이그레이션 → seed.sql → 00001 Section 6(solution_code) 재실행
#   (운영처럼 solution_code 가 들어 있는 상태. P0-08 §3 참고)
# - auto_expose_new_tables = true: 운영(기존 프로젝트)처럼 public 의 새 테이블에
#   anon/authenticated/service_role 권한이 자동 부여되게 함 (P0-08 덤 2번)
# - 포트 5472x (api 54721, db 54722). 다른 로컬 스택(54321~, 54421~)과 겹치지 않음
# - 끝나면 <작업>/supabase.env 에 API_URL / ANON_KEY / SERVICE_ROLE_KEY 를 남김 (커밋 금지)
# 운영 DB 에는 접속하지 않습니다. 저장소 파일은 읽기만 합니다.
# ============================================================
set -euo pipefail
WORK="${1:?usage: supabase-up.sh <work-dir>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PROJECT_ID="${P013_PROJECT_ID:-p013perf}"
PORT_BASE="${P013_PORT_BASE:-54720}"
SB="$WORK/supabase-proj"
MIG="$REPO/supabase/migrations"
EXCLUDE="realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
DB_CONTAINER="supabase_db_${PROJECT_ID}"

mkdir -p "$SB"
rm -rf "$SB/supabase"
(cd "$SB" && supabase init --force >/dev/null 2>&1)
cfg="$SB/supabase/config.toml"
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
sed -i -E 's/^# auto_expose_new_tables = true$/auto_expose_new_tables = true/' "$cfg"
grep -q '^auto_expose_new_tables = true$' "$cfg" || { echo "auto_expose_new_tables 설정 실패"; exit 2; }
mkdir -p "$SB/supabase/migrations"
cp "$MIG/00001_v0.1.0_initial_schema.sql" "$SB/supabase/migrations/"
cp "$MIG/00002_v0.3.1_security_hotfix.sql" "$SB/supabase/migrations/"
cp "$REPO/supabase/seed.sql" "$SB/supabase/seed.sql"

echo "== supabase start ($PROJECT_ID, api $((PORT_BASE + 1)), db $((PORT_BASE + 2)))"
supabase start -x "$EXCLUDE" --workdir "$SB" >/dev/null

# 운영처럼 solution_code 채우기 (00001 Section 6 만 추출해 seed 뒤에 실행)
sed -n '/^-- Section 6/,/^-- Section 7/p' "$MIG/00001_v0.1.0_initial_schema.sql" \
  | docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -1 >/dev/null
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q -c "NOTIFY pgrst, 'reload schema';" >/dev/null

envs="$(supabase status -o env --workdir "$SB" 2>/dev/null)"
{
  echo "API_URL=$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$envs")"
  echo "ANON_KEY=$(sed -n 's/^ANON_KEY="\(.*\)"$/\1/p' <<<"$envs")"
  echo "SERVICE_ROLE_KEY=$(sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p' <<<"$envs")"
  echo "DB_CONTAINER=$DB_CONTAINER"
  echo "SB_WORKDIR=$SB"
} >"$WORK/supabase.env"
chmod 600 "$WORK/supabase.env"
source "$WORK/supabase.env"
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null -H "apikey: $ANON_KEY" "$API_URL/rest/v1/" && break
  sleep 1
done
echo "== ready: $API_URL (키는 $WORK/supabase.env)"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -At -c \
  "select 'stages='||(select count(*) from stages)||' quests='||(select count(*) from quests)||' solution_code='||(select count(*) from quests where prompt_skeleton ? 'solution_code')"
