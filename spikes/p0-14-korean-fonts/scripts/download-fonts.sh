#!/usr/bin/env bash
# P0-14: 후보 폰트 원본을 내려받는다 (폰트 바이너리는 저장소에 커밋하지 않는다).
#
#   bash spikes/p0-14-korean-fonts/scripts/download-fonts.sh <캐시 디렉터리>
#
# 출처마다 빈 디렉터리를 따로 만들고, 압축은 python zipfile로 푼다 (unzip 불필요).
set -euo pipefail

CACHE="${1:?usage: download-fonts.sh <cache-dir>}"
mkdir -p "$CACHE"
cd "$CACHE"

fetch() { # <dir> <url> [out-name]
  local dir="$1" url="$2" out="${3:-$(basename "${2%%\?*}")}"
  mkdir -p "$dir"
  if [ ! -s "$dir/$out" ]; then
    echo "  ↓ $url"
    curl -fsSL --retry 2 --max-time 300 -o "$dir/$out" "$url"
  fi
}
unzip_py() { # <zip> <dest>
  [ -d "$2" ] || python3 -P -E -m zipfile -e "$1" "$2"
}

GF=https://github.com/google/fonts/raw/main/ofl

echo "[1/7] Google Fonts 원본 (OFL)"
fetch gf/jua        "$GF/jua/Jua-Regular.ttf"
fetch gf/jua        "$GF/jua/OFL.txt"
for w in Light Regular Bold; do fetch gf/gaegu "$GF/gaegu/Gaegu-$w.ttf"; done
fetch gf/gaegu      "$GF/gaegu/OFL.txt"
fetch gf/gowundodum "$GF/gowundodum/GowunDodum-Regular.ttf"
fetch gf/gowundodum "$GF/gowundodum/OFL.txt"
fetch gf/jetbrainsmono "$GF/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf" "JetBrainsMono[wght].ttf"
fetch gf/jetbrainsmono "$GF/jetbrainsmono/OFL.txt"
for w in Regular Bold; do fetch gf/nanumgothiccoding "$GF/nanumgothiccoding/NanumGothicCoding-$w.ttf"; done
fetch gf/nanumgothiccoding "$GF/nanumgothiccoding/OFL.txt"

echo "[2/7] Pretendard (npm tarball, OFL)"
mkdir -p pretendard
if [ ! -d pretendard/package ]; then
  (cd pretendard && npm pack pretendard@1.3.9 --silent >/dev/null && tar -xzf pretendard-1.3.9.tgz)
fi

echo "[3/7] D2Coding (naver/d2codingfont GitHub release, OFL)"
fetch d2coding "https://github.com/naver/d2codingfont/releases/download/VER1.3.2/D2Coding-Ver1.3.2-20180524.zip"
unzip_py d2coding/D2Coding-Ver1.3.2-20180524.zip d2coding/x

echo "[4/7] Cafe24 써라운드 v2.0 / 써라운드 에어 v1.1 (카페24 공식 배포)"
fetch cafe24-ssurround     "https://img.cafe24.com/csdstatic/freefonts/download/kr/Cafe24Ssurround-v2.0.zip"
unzip_py cafe24-ssurround/Cafe24Ssurround-v2.0.zip cafe24-ssurround/x
fetch cafe24-ssurround-air "https://img.cafe24.com/csdstatic/freefonts/download/kr/Cafe24SsurroundAir-v1.1.zip"
unzip_py cafe24-ssurround-air/Cafe24SsurroundAir-v1.1.zip cafe24-ssurround-air/x

echo "[5/7] Cafe24 써라운드 커뮤니티 미러 (fonts-archive, 동적 서브셋 CSS 비교용)"
fetch fonts-archive "https://cdn.jsdelivr.net/gh/fonts-archive/Cafe24Ssurround/Cafe24Ssurround.woff2"
fetch fonts-archive "https://cdn.jsdelivr.net/gh/fonts-archive/Cafe24Ssurround/subsets/Cafe24Ssurround-dynamic-subset.css"

echo "[6/7] Google Fonts CSS2 응답 (Chrome UA → woff2 + unicode-range 슬라이스)"
UA='Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36'
mkdir -p gcss
for fam in "Jua" "Gaegu:wght@400;700" "Gowun+Dodum" "Nanum+Gothic+Coding:wght@400;700" "JetBrains+Mono:wght@400;700" "Noto+Sans+KR:wght@400;700"; do
  name=$(echo "$fam" | sed 's/[^A-Za-z]//g; s/wght//')
  [ -s "gcss/$name.css" ] || curl -fsSL -A "$UA" -o "gcss/$name.css" "https://fonts.googleapis.com/css2?family=$fam&display=swap"
done

echo "[7/7] 시스템 한글 폴백 흉내용 Noto Sans KR + fontconfig (Android·크롬북의 Noto Sans CJK KR 대역)"
# 이 리눅스 환경에는 한글 시스템 폰트가 없어 폴백이 두부(□)로 그려진다. 실제 기기처럼 폴백 한글이 보이도록
# 스크래치 fontconfig에만 추가한다 (시스템 설정은 건드리지 않음). 측정 시 FONTCONFIG_FILE=$CACHE/sysfonts/fonts.conf
fetch sysfonts/fonts "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf" "NotoSansKR-wght.ttf"
cat > sysfonts/fonts.conf <<EOF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>$CACHE/sysfonts/fonts</dir>
  <cachedir>$CACHE/sysfonts/cache</cachedir>
</fontconfig>
EOF

echo "done → $CACHE"
find "$CACHE" -type f \( -name '*.ttf' -o -name '*.otf' -o -name '*.ttc' -o -name '*.woff2' \) | wc -l
