#!/usr/bin/env bash
# P0-14 전체 재현: 폰트 내려받기 → 실험 앱 복사·설치 → 폰트 생성 → next build(webpack) → 포트 3114 실행
#                 → 측정·스크린샷 → 서버 종료
#
#   bash spikes/p0-14-korean-fonts/scripts/run-all.sh <작업 디렉터리(스크래치)> [runs=3]
#
# - 저장소 루트에서 npm install / next 실행을 하지 않는다. 앱은 <작업>/lab 에 복사해서 설치한다.
# - Playwright는 저장소에 이미 설치된 것(node_modules/playwright)을 쓴다. 설치된 브라우저 빌드가
#   패키지(1.58.2)와 다르면 PW_CHROMIUM=<chrome-headless-shell 실행 파일>을 지정한다.
# - 측정용 빌드는 webpack이다. Turbopack(15.5.14)은 라우트 그룹 간 font preload가 섞여 변형 비교가 안 된다.
set -euo pipefail
WORK="${1:?usage: run-all.sh <work-dir> [runs]}"
RUNS="${2:-3}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SPIKE="$(dirname "$HERE")"
REPO="$(cd "$SPIKE/../.." && pwd)"
IMG="$REPO/docs/spikes/img"
mkdir -p "$WORK" "$SPIKE/results"

bash "$HERE/download-fonts.sh" "$WORK/fonts"
mkdir -p "$WORK/lab" && cp -r "$SPIKE/next-app/." "$WORK/lab/"
(cd "$WORK/lab" && npm install --no-audit --no-fund --loglevel=error)
[ -f "$WORK/lab/generated/d2coding/D2Coding.css" ] || bash "$HERE/build-fonts.sh" "$WORK/fonts" "$WORK/lab"
(cd "$WORK/lab" && NEXT_TELEMETRY_DISABLED=1 npx next build)

export FONTCONFIG_FILE="$WORK/fonts/sysfonts/fonts.conf"
(cd "$WORK/lab" && NEXT_TELEMETRY_DISABLED=1 npx next start -p 3114 > "$WORK/server.log" 2>&1 &)
stop_server() {
  local pid
  pid=$(ss -ltnp 2>/dev/null | grep ':3114 ' | grep -o 'pid=[0-9]*' | cut -d= -f2 || true)
  [ -n "$pid" ] && [ "$(readlink "/proc/$pid/cwd")" = "$WORK/lab" ] && kill "$pid" || true
}
trap stop_server EXIT
until curl -fs -o /dev/null http://localhost:3114/system; do sleep 1; done

node "$HERE/measure.mjs" --runs "$RUNS" --out "$SPIKE/results/measure.json"
node "$HERE/screenshot.mjs" specimen "$WORK/shots"      # 1280px 전체 + alignment.json
node "$HERE/screenshot.mjs" mobile "$WORK/shots"        # 390px 위쪽·코드 섹션
node "$HERE/screenshot.mjs" filmstrip "$WORK/film" system,a-next,a-landing,a-subset,b-next,b-landing fast3g

shrink() { python3 -P -E "$HERE/images.py" shrink "$1" "$2" --max-kb 240; }
shrink "$WORK/shots/specimen-a-1280.png" "$IMG/P0-14-specimen-a-1280.png"
shrink "$WORK/shots/specimen-b-1280.png" "$IMG/P0-14-specimen-b-1280.png"
for s in a b; do
  shrink "$WORK/shots/mobile-$s-top.png" "$IMG/P0-14-specimen-$s-390-top.png"
  shrink "$WORK/shots/mobile-$s-code.png" "$IMG/P0-14-specimen-$s-390-code.png"
done
python3 -P -E "$HERE/images.py" filmstrip "$WORK/film" "$IMG/P0-14-filmstrip-fast3g.png" \
  --variants system,a-next,a-landing,a-subset,b-next,b-landing --times 1500,2000,2500,3500,4500,5500,7000 \
  --font "$WORK/fonts/d2coding/x/D2Coding/D2CodingBold-Ver1.3.2-20180524.ttf" --max-kb 240 \
  --labels "system=시스템 폰트;a-next=A 슬라이스;a-landing=A 랜딩 서브셋;a-subset=A KS X 서브셋;b-next=B 슬라이스;b-landing=B 랜딩 서브셋"
cp "$WORK/shots/alignment.json" "$SPIKE/results/alignment.json"
echo "done"
