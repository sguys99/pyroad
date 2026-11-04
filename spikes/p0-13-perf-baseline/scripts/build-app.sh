#!/usr/bin/env bash
# ============================================================
# P0-13: 저장소 루트에서 로컬 Supabase를 가리키는 운영 빌드(next build --turbopack) 후 3113 포트로 실행
#
#   bash spikes/p0-13-perf-baseline/scripts/build-app.sh <작업 디렉터리> [--no-build]
#
# - NEXT_PUBLIC_* 는 빌드 때 번들에 박히므로 로컬 값을 빌드 시점에 넘긴다.
#   process env 가 저장소 .env/.env.local 보다 우선한다 (@next/env: 이미 정의된 키는 덮어쓰지 않음).
# - LLM 키는 빈 문자열로 "정의"해서 .env 값이 들어오지 않게 한다 → 튜터는 정적 폴백 문구.
# - 빌드 로그(라우트 표)는 <작업>/build.log, 서버 로그는 <작업>/server.log.
# - 끝난 뒤 .next 에는 로컬 Supabase 빌드가 남는다 (npm run dev / build 하면 다시 만들어짐).
# ============================================================
set -euo pipefail
WORK="${1:?usage: build-app.sh <work-dir> [--no-build]}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PORT="${P013_APP_PORT:-3113}"
# shellcheck disable=SC1091
source "$WORK/supabase.env"

app_env() {
  env NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
      NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
      SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
      ANTHROPIC_API_KEY= OPENAI_API_KEY= GEMINI_API_KEY= ADMIN_EMAIL= \
      NEXT_TELEMETRY_DISABLED=1 "$@"
}

if [[ "${2:-}" != "--no-build" ]]; then
  echo "== next build (turbopack) in $REPO"
  start=$(date +%s)
  (cd "$REPO" && app_env npm run build) 2>&1 | tee "$WORK/build.log" | tail -60
  echo "build_seconds=$(( $(date +%s) - start ))" | tee -a "$WORK/build.log"
fi

if ss -ltn | grep -q ":$PORT "; then
  echo "포트 $PORT 이미 사용 중"; exit 2
fi
echo "== next start -p $PORT"
(cd "$REPO" && app_env nohup npx next start -p "$PORT" >"$WORK/server.log" 2>&1 &)
for _ in $(seq 1 60); do
  curl -fs -o /dev/null "http://localhost:$PORT/" && { echo "== up: http://localhost:$PORT"; exit 0; }
  sleep 1
done
echo "서버가 뜨지 않음"; tail -20 "$WORK/server.log"; exit 2
