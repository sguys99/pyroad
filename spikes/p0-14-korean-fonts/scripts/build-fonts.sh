#!/usr/bin/env bash
# P0-14: 내려받은 원본(download-fonts.sh)으로 실험 앱용 폰트를 만든다.
#
#   bash spikes/p0-14-korean-fonts/scripts/build-fonts.sh <캐시 디렉터리> <앱 디렉터리>
#
#  <앱>/generated/d2coding/   D2Coding Regular → 구글 한글 슬라이스 규칙으로 자른 woff2 + CSS (자가 호스팅용)
#  <앱>/generated/cafe24/     Cafe24 써라운드 → 같은 방식
#  <앱>/generated/cafe24air/  Cafe24 써라운드 에어 → 같은 방식
#  <앱>/generated/cafe24-full/ 카페24 공식 webfont woff2 (비교용, 통파일)
#  <앱>/generated/ksx/        KS X 1001 고정 서브셋 (Jua, Pretendard 400/700, D2Coding, Gaegu 700, Gowun Dodum)
set -euo pipefail
CACHE="${1:?usage: build-fonts.sh <cache-dir> <app-dir>}"
APP="${2:?usage: build-fonts.sh <cache-dir> <app-dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
KIT=(python3 -P -E "$HERE/fontkit.py")
OUT="$APP/generated"
RANGES="$CACHE/gcss/NotoSansKR.css"   # 구글 한글 슬라이스 규칙 (unicode-range 묶음 120개 + latin 등)
HINT="${HINT:---no-hinting}"          # 기본: 힌팅 제거 (크기 ↓). 유지하려면 HINT= 로 실행
mkdir -p "$OUT"

D2="$CACHE/d2coding/x/D2Coding/D2Coding-Ver1.3.2-20180524.ttf"
C24="$CACHE/cafe24-ssurround/x/Cafe24Ssurround-v2.0/Cafe24Ssurround-v2.0.ttf"
C24A="$CACHE/cafe24-ssurround-air/x/Cafe24SsurroundAir-v1.1/Cafe24SsurroundAir-v1.1.ttf"
PRET="$CACHE/pretendard/package/dist/web/static/woff2"

echo "[slice] D2Coding"
"${KIT[@]}" slice "$D2" "$OUT/d2coding" --family D2Coding --ranges "$RANGES" --prefix D2Coding --no-hanja $HINT
echo "[slice] Cafe24 Ssurround"
"${KIT[@]}" slice "$C24" "$OUT/cafe24" --family 'Cafe24 Ssurround' --ranges "$RANGES" --prefix Cafe24Ssurround $HINT
echo "[slice] Cafe24 Ssurround Air"
"${KIT[@]}" slice "$C24A" "$OUT/cafe24air" --family 'Cafe24 Ssurround Air' --ranges "$RANGES" --prefix Cafe24SsurroundAir $HINT

mkdir -p "$OUT/cafe24-full"
cp "$CACHE/cafe24-ssurround/x/Cafe24Ssurround-v2.0/webfont/Cafe24Ssurround-v2.0.woff2" "$OUT/cafe24-full/"

echo "[subset] KS X 1001"
mkdir -p "$OUT/ksx"
"${KIT[@]}" subset "$CACHE/gf/jua/Jua-Regular.ttf" "$OUT/ksx/Jua-ksx.woff2" $HINT
"${KIT[@]}" subset "$PRET/Pretendard-Regular.woff2" "$OUT/ksx/Pretendard-Regular-ksx.woff2" $HINT
"${KIT[@]}" subset "$PRET/Pretendard-Bold.woff2" "$OUT/ksx/Pretendard-Bold-ksx.woff2" $HINT
"${KIT[@]}" subset "$D2" "$OUT/ksx/D2Coding-ksx.woff2" $HINT
"${KIT[@]}" subset "$CACHE/gf/gaegu/Gaegu-Bold.ttf" "$OUT/ksx/Gaegu-Bold-ksx.woff2" $HINT
"${KIT[@]}" subset "$CACHE/gf/gowundodum/GowunDodum-Regular.ttf" "$OUT/ksx/GowunDodum-ksx.woff2" $HINT

echo "[subset] 랜딩 페이지 텍스트 서브셋 (content.js 문구에 쓰인 글자만)"
mkdir -p "$OUT/textsub"
node "$HERE/extract-text.mjs" "$APP/content.js" "$OUT/textsub"
T="$OUT/textsub"
"${KIT[@]}" subset "$CACHE/gf/jua/Jua-Regular.ttf" "$T/Jua-landing.woff2" --profile text --text-file "$T/landing-title.txt" $HINT
"${KIT[@]}" subset "$PRET/Pretendard-Regular.woff2" "$T/Pretendard-Regular-landing.woff2" --profile text --text-file "$T/landing-body.txt" $HINT
"${KIT[@]}" subset "$PRET/Pretendard-Bold.woff2" "$T/Pretendard-Bold-landing.woff2" --profile text --text-file "$T/landing-body.txt" $HINT
"${KIT[@]}" subset "$D2" "$T/D2Coding-landing.woff2" --profile text --text-file "$T/landing-code.txt" $HINT
"${KIT[@]}" subset "$CACHE/gf/gaegu/Gaegu-Bold.ttf" "$T/Gaegu-Bold-landing.woff2" --profile text --text-file "$T/landing-title.txt" $HINT
"${KIT[@]}" subset "$CACHE/gf/gowundodum/GowunDodum-Regular.ttf" "$T/GowunDodum-landing.woff2" --profile text --text-file "$T/landing-body.txt" $HINT

# OFL 고지: 재배포(자가 호스팅)하는 폰트 옆에 라이선스 전문을 둔다
cp "$CACHE/gf/jua/OFL.txt" "$OUT/ksx/OFL-Jua.txt"
cp "$CACHE/gf/gaegu/OFL.txt" "$OUT/ksx/OFL-Gaegu.txt"
cp "$CACHE/gf/gowundodum/OFL.txt" "$OUT/ksx/OFL-GowunDodum.txt"
echo "done → $OUT"
du -sh "$OUT"/*
