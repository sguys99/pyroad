#!/bin/sh
# Runs tests/e2e/*.test.ts in a container attached to the Supabase stack network and
# the lab network (scripts/lab-up.sh), so the test client can play the browser.
# Usage:
#   SUPABASE_STACK_DIR=/dir/with/supabase/config.toml LAB_DIR=/scratch/lab sh scripts/e2e.sh [files...]
# Stack keys are read with `supabase status -o env` into a temp file (never printed, deleted on exit).
set -eu
SPIKE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${SUPABASE_PROJECT_ID:-p003naver}"
NODE_IMAGE="${NODE_IMAGE:-public.ecr.aws/supabase/postgres-meta:v0.98.0}"
API_PORT="${SUPABASE_API_PORT:-55421}"
: "${SUPABASE_STACK_DIR:?set SUPABASE_STACK_DIR}"
: "${LAB_DIR:?set LAB_DIR (same as lab-up.sh)}"

ENV_FILE="$(mktemp -p "${TMPDIR:-/tmp}" p003-e2e-env.XXXXXX)"
NAME="p003-e2e-$$"
trap 'rm -f "$ENV_FILE"; docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
(cd "$SUPABASE_STACK_DIR" && supabase status -o env 2>/dev/null) \
  | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' | sed 's/"//g' > "$ENV_FILE"

if [ "$#" -eq 0 ]; then set -- tests/e2e/*.test.ts; fi

docker create --name "$NAME" --network "supabase_network_${PROJECT_ID}" --no-healthcheck \
  -v "$SPIKE_DIR:/spike" -v "$LAB_DIR/ca:/lab-ca:ro" -w /spike --env-file "$ENV_FILE" \
  -e NODE_EXTRA_CA_CERTS=/lab-ca/p003-ca.pem \
  -e SUPABASE_URL="http://supabase_kong_${PROJECT_ID}:8000" \
  -e PUBLIC_API_ORIGIN="http://127.0.0.1:${API_PORT}" \
  -e MOCK_BASE=https://mock-nid.p003.test \
  -e RUN_REAL_NAVER_DISCOVERY="${RUN_REAL_NAVER_DISCOVERY:-1}" \
  --entrypoint node "$NODE_IMAGE" --test --test-concurrency=1 --test-reporter=spec "$@" >/dev/null
docker network connect p003-pubnet "$NAME"
docker start -a "$NAME"
