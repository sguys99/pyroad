#!/usr/bin/env bash
# P0-10 스파이크 재현 스크립트.
# 저장소 루트가 아닌 작업 디렉토리(WORK)에 Next 15 앱을 만들고, 스파이크 소스·캐릭터 컴포넌트·폰트를 복사합니다.
#
#   bash spikes/p0-10-og-share-card/scripts/setup.sh <WORK> [fonts|subset|app|sync|all]
#
#   fonts  : OFL 폰트 원본 다운로드 (Google Fonts GitHub, Pretendard npm, Cafe24 써라운드 noonnu CDN)
#   subset : fontTools로 ks2350 / full / ui 서브셋 생성 (python3 + fonttools 필요, 약 2분)
#   app    : 스크래치 앱 생성 + npm install (next 15.5.14, react 19.2.4 — 저장소와 같은 버전)
#   sync   : 스파이크 소스와 src/components/characters 를 앱으로 복사 (수정 후 매번)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
SPIKE="$REPO/spikes/p0-10-og-share-card"
WORK="${1:?작업 디렉토리를 지정하세요}"
STEP="${2:-all}"
RAW="$WORK/fonts"
SUB="$WORK/fonts-subset"
APP="$WORK/next-app"

fonts() {
  mkdir -p "$RAW"/{jua,gaegu,gowundodum,pretendard,cafe24}
  local G=https://raw.githubusercontent.com/google/fonts/main/ofl
  curl -fsSL -o "$RAW/jua/Jua-Regular.ttf" "$G/jua/Jua-Regular.ttf"
  curl -fsSL -o "$RAW/jua/OFL.txt" "$G/jua/OFL.txt"
  curl -fsSL -o "$RAW/gaegu/Gaegu-Bold.ttf" "$G/gaegu/Gaegu-Bold.ttf"
  curl -fsSL -o "$RAW/gaegu/OFL.txt" "$G/gaegu/OFL.txt"
  curl -fsSL -o "$RAW/gowundodum/GowunDodum-Regular.ttf" "$G/gowundodum/GowunDodum-Regular.ttf"
  curl -fsSL -o "$RAW/gowundodum/OFL.txt" "$G/gowundodum/OFL.txt"
  local P=https://cdn.jsdelivr.net/npm/pretendard@1.3.9
  for w in Bold ExtraBold; do curl -fsSL -o "$RAW/pretendard/Pretendard-$w.otf" "$P/dist/public/static/Pretendard-$w.otf"; done
  curl -fsSL -o "$RAW/pretendard/LICENSE.txt" "$P/LICENSE"
  # 카페24 써라운드: OFL 1.1 (name 레코드 13에 전문 포함). 공식 배포처 https://fonts.cafe24.com
  curl -fsSL -o "$RAW/cafe24/Cafe24Ssurround.woff" "https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24Ssurround.woff"
}

subset() {
  (cd "$SPIKE" && python3 scripts/subset_fonts.py "$RAW" "$SUB")
}

app() {
  mkdir -p "$APP"
  cp "$SPIKE/scratch-app/package.json" "$SPIKE/scratch-app/next.config.ts" "$SPIKE/scratch-app/tsconfig.json" "$APP/"
  (cd "$APP" && npm install --no-audit --no-fund)
}

sync() {
  mkdir -p "$APP/vendor/characters" "$APP/assets/fonts/orig"
  rsync -a --delete "$SPIKE/app/" "$APP/app/"
  rsync -a --delete "$SPIKE/lib/" "$APP/lib/"
  rsync -a --delete "$SPIKE/cards/" "$APP/cards/"
  # 설정 파일은 바뀐 경우에만 복사 (dev 서버 재시작 방지)
  for f in next.config.ts tsconfig.json; do cmp -s "$SPIKE/scratch-app/$f" "$APP/$f" || cp "$SPIKE/scratch-app/$f" "$APP/$f"; done
  # 실제 마스코트 컴포넌트를 수정 없이 복사 (src/ 는 건드리지 않음)
  for f in PybaemSvg.tsx BugBugSvg.tsx ByeolttongiSvg.tsx expressions.ts; do
    cp "$REPO/src/components/characters/$f" "$APP/vendor/characters/$f"
  done
  cp "$SUB"/*.ttf "$SUB"/*.otf "$SUB"/*.woff "$APP/assets/fonts/" 2>/dev/null || true
  cp "$RAW/jua/Jua-Regular.ttf" "$RAW/gaegu/Gaegu-Bold.ttf" "$RAW/gowundodum/GowunDodum-Regular.ttf" \
     "$RAW/pretendard/Pretendard-Bold.otf" "$RAW/pretendard/Pretendard-ExtraBold.otf" "$RAW/cafe24/Cafe24Ssurround.woff" \
     "$APP/assets/fonts/orig/"
}

case "$STEP" in
  fonts) fonts ;;
  subset) subset ;;
  app) app ;;
  sync) sync ;;
  all) fonts; subset; app; sync ;;
  *) echo "unknown step $STEP"; exit 1 ;;
esac
echo "done: $STEP"
