#!/usr/bin/env bash
# ============================================================
# P0-13 성능 기준선 전체 재현 (한 번에)
#
#   bash spikes/p0-13-perf-baseline/scripts/run-all.sh <작업 디렉터리> [옵션]
#     --no-build      이미 만든 .next 를 그대로 next start (빌드 생략)
#     --runs N        반복 횟수 (기본 3)
#     --only a,b      일부만: lighthouse,pyodide,frames,reduced,shots
#     --keep          끝나도 앱 서버·로컬 Supabase 를 내리지 않음
#     --out DIR       요약 JSON 을 쓸 디렉터리 (기본 spikes/p0-13-perf-baseline/results). 새 빌드와 비교할 때 다른 폴더로
#
# 순서: 도구 설치(작업 디렉터리) → 폰트(fontconfig) → 로컬 Supabase(5472x) → 테스트 사용자
#       → next build(저장소 루트, 로컬 Supabase 값 주입) → next start :3113
#       → [측정 전마다 3107 포트가 비고 1분 부하 < 6 이 될 때까지 대기]
#       → Lighthouse(모바일·데스크톱 × 5화면 × N) → Pyodide·실행 지연 → 프레임(1×/4×/6×) → reduced-motion → 스크린샷
#       → summary.md → 서버·스택 정리
# 운영 Supabase·LLM 키는 쓰지 않습니다. 저장소에서는 .next 만 다시 만들어집니다.
# ============================================================
set -euo pipefail
WORK="$(mkdir -p "${1:?usage: run-all.sh <work-dir> [--no-build] [--runs N] [--only …] [--keep] [--out DIR]}" && cd "$1" && pwd)"
shift
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPIKE="$(dirname "$HERE")"
REPO="$(cd "$SPIKE/../.." && pwd)"
RUNS=3 BUILD=1 KEEP=0 ONLY="lighthouse,pyodide,frames,reduced,shots" OUTDIR="$SPIKE/results"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build) BUILD=0 ;;
    --runs) RUNS="$2"; shift ;;
    --only) ONLY="$2"; shift ;;
    --keep) KEEP=1 ;;
    --out) OUTDIR="$(mkdir -p "$2" && cd "$2" && pwd)"; shift ;;
  esac
  shift
done
has() { [[ ",$ONLY," == *",$1,"* ]]; }
log() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }

# 1) 도구: 저장소 루트가 아니라 작업 디렉터리에 설치
log "도구 설치 ($WORK/h)"
mkdir -p "$WORK/h"
cp "$SPIKE/package.json" "$WORK/h/"
mkdir -p "$WORK/h/scripts" && cp -r "$HERE/." "$WORK/h/scripts/"
[[ -d "$WORK/h/node_modules/lighthouse" ]] || (cd "$WORK/h" && npm install --no-audit --no-fund --loglevel=error)

# 2) 폰트: 시스템 한글·이모지 폴백 (Android·크롬북의 Noto 계열 흉내). 시스템 설정은 건드리지 않음
if [[ ! -f "$WORK/sysfonts/fonts.conf" ]]; then
  log "폰트 내려받기"
  mkdir -p "$WORK/sysfonts/fonts" "$WORK/sysfonts/cache"
  curl -fsSL -o "$WORK/sysfonts/fonts/NotoSansKR-wght.ttf" "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"
  curl -fsSL -o "$WORK/sysfonts/fonts/NotoColorEmoji.ttf" "https://github.com/google/fonts/raw/main/ofl/notocoloremoji/NotoColorEmoji-Regular.ttf"
  cat >"$WORK/sysfonts/fonts.conf" <<EOF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>$WORK/sysfonts/fonts</dir>
  <cachedir>$WORK/sysfonts/cache</cachedir>
</fontconfig>
EOF
fi

export P013_WORK="$WORK" P013_SPIKE="$SPIKE" FONTCONFIG_FILE="$WORK/sysfonts/fonts.conf"
export CHROME_PATH="${CHROME_PATH:-$HOME/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome}"
RESULTS_REL="$(realpath --relative-to="$SPIKE/results" "$OUTDIR")"

stop_all() {
  [[ "$KEEP" == 1 ]] && return
  local pid
  pid=$(ss -ltnp 2>/dev/null | grep ":${P013_APP_PORT:-3113} " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)
  # 우리가 띄운 next start(작업 디렉터리 = 저장소 루트)만 종료
  if [[ -n "$pid" && "$(readlink "/proc/$pid/cwd")" == "$REPO" ]]; then kill "$pid" || true; fi
  [[ -f "$WORK/supabase.env" ]] && supabase stop --no-backup --workdir "$WORK/supabase-proj" >/dev/null 2>&1 || true
}
trap stop_all EXIT

# 3) 로컬 Supabase + 테스트 사용자
log "로컬 Supabase"
bash "$HERE/supabase-up.sh" "$WORK"
(cd "$WORK/h" && node scripts/seed-users.mjs)

# 4) 빌드 + 실행
log "앱 빌드·실행"
if [[ "$BUILD" == 1 ]]; then bash "$HERE/build-app.sh" "$WORK"; else bash "$HERE/build-app.sh" "$WORK" --no-build; fi
mkdir -p "$OUTDIR"
node "$HERE/routes.mjs" "$WORK/build.log" >"$OUTDIR/build-routes.json" 2>/dev/null || cp "$WORK/build.log" "$OUTDIR/build.log.txt"

# 5) 환경 기록
cat >"$OUTDIR/env.json" <<EOF
{
  "date": "$(date -Iseconds)",
  "git": "$(git -C "$REPO" rev-parse --short HEAD)$(git -C "$REPO" diff --quiet -- src public next.config.ts package.json || echo '+dirty')",
  "node": "$(node --version)",
  "next": "$(node -p "require('$REPO/node_modules/next/package.json').version")",
  "chrome": "$("$CHROME_PATH" --version | tr -d '\n')",
  "lighthouse": "$(node -p "require('$WORK/h/node_modules/lighthouse/package.json').version")",
  "playwrightCore": "$(node -p "require('$WORK/h/node_modules/playwright-core/package.json').version")",
  "supabaseCli": "$(supabase --version 2>/dev/null | head -1)",
  "cpu": "$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | xargs) x$(nproc)",
  "memGB": $(free -g | awk '/Mem:/{print $2}'),
  "kernel": "$(uname -r)"
}
EOF

# 6) 측정 (각 스크립트가 배치마다 waitQuiet 로 부하를 확인하고 기록)
cd "$WORK/h"
has lighthouse && node scripts/lighthouse.mjs --runs "$RUNS" --out "$RESULTS_REL/lighthouse.json"
has pyodide && node scripts/runtime.mjs pyodide --runs "$RUNS" --out "$RESULTS_REL/runtime-pyodide.json"
has frames && node scripts/runtime.mjs frames --runs "$RUNS" --rates 1,4,6 --out "$RESULTS_REL/runtime-frames.json"
has reduced && node scripts/runtime.mjs frames --runs "$RUNS" --rates 4,6 --scenes world,quest,celebration --reduced 1 --out "$RESULTS_REL/runtime-frames.json"
if has shots; then
  node scripts/shots.mjs
  mkdir -p "${P013_IMG_OUT:-$REPO/docs/spikes/img}"
  python3 -P -E scripts/images.py "$WORK/shots" "${P013_IMG_OUT:-$REPO/docs/spikes/img}" --font "$WORK/sysfonts/fonts/NotoSansKR-wght.ttf"
fi
node scripts/summarize.mjs "$OUTDIR" >"$OUTDIR/summary.md"
log "끝: $OUTDIR/summary.md"
