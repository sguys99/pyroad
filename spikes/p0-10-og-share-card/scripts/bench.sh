#!/usr/bin/env bash
# 렌더 시간 측정: `next start`(프로덕션 빌드)를 카드마다 새로 띄워 첫 요청(cold)과 이후 요청(warm)을 잽니다.
#   bash bench.sh <APP_DIR> <OUT.tsv> [warm 횟수=8] [케이스 이름 정규식=.]   (OUT 파일이 있으면 이어 씀)
# cold = 프로세스 시작 직후 첫 요청 (모듈 로드 + wasm 초기화 + 폰트 읽기/파싱 포함, Vercel 컨테이너 부팅은 제외)
set -uo pipefail
APP="${1:?}"; OUT="${2:?}"; N="${3:-8}"; ONLY="${4:-.}"; PORT=3110
[ -f "$OUT" ] || echo -e "case\tphase\ttotal_ms\tserver_timing\tpng_bytes\trss_mb" > "$OUT"

start_server() {
  if ss -ltn | grep -q ":$PORT "; then echo "port $PORT busy"; exit 1; fi
  # setsid로 새 프로세스 그룹을 만들어, 끝낼 때 이 그룹만 정확히 종료합니다 (다른 next 프로세스는 건드리지 않음)
  setsid bash -c "cd '$APP' && exec npx next start -p $PORT" > "$APP/../start.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 100); do curl -s -o /dev/null "http://localhost:$PORT/_not-found" && return 0; sleep 0.2; done
  echo "server did not start"; exit 1
}
stop_server() {
  kill -TERM -- "-$SERVER_PID" 2>/dev/null || true
  for _ in $(seq 1 50); do (ss -ltn | grep -q ":$PORT ") || return 0; sleep 0.2; done
  kill -KILL -- "-$SERVER_PID" 2>/dev/null || true
}
hit() { # name phase url
  local h; h=$(mktemp)
  local t; t=$(curl -sS -o /dev/null -D "$h" -w "%{time_total}" "$3") || t="-0.001"
  local st png rss
  st=$(grep -i '^server-timing' "$h" | cut -d' ' -f2- | tr -d '\r')
  png=$(grep -i '^x-png-bytes' "$h" | awk '{print $2}' | tr -d '\r')
  rss=$(grep -i '^x-rss-mb' "$h" | awk '{print $2}' | tr -d '\r')
  rm -f "$h"
  echo -e "$1\t$2\t$(awk "BEGIN{printf \"%.0f\", $t*1000}")\t$st\t$png\t$rss" | tee -a "$OUT"
}
run_case() { # name url
  [[ "$1" =~ $ONLY ]] || return 0
  start_server
  hit "$1" cold "$2"
  for i in $(seq 1 "$N"); do hit "$1" warm "$2"; done
  stop_server
}

B="http://localhost:$PORT"
run_case node-levelup "$B/api/og/levelup"
run_case node-stage-b "$B/api/og/stage?style=b"
run_case node-achievement "$B/api/og/achievement"
run_case node-weekly "$B/api/og/weekly"
run_case node-stage-a "$B/api/og/stage?style=a"
run_case edge-levelup "$B/api/og-edge/levelup"
run_case edge-achievement "$B/api/og-edge/achievement"
run_case node-share-ogimage "$B/share/hzEbwb74Pa6krPzNTNoMbQ/opengraph-image"
run_case node-share-route "$B/api/share-cards/hzEbwb74Pa6krPzNTNoMbQ/image?v=1"
# 폰트 전략 비교 (같은 레벨업 카드)
for s in ks woff full ui google; do run_case "fonts-$s" "$B/api/og/levelup?fonts=$s"; done
run_case fonts-ks-nomemo "$B/api/og/levelup?fonts=ks&memo=0"
run_case fonts-ks-nofallback "$B/api/og/levelup?fonts=ks&fallback=0"
run_case stage-b-grain "$B/api/og/stage?style=b&grain=1"
