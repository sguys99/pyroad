#!/usr/bin/env bash
# 보고서용 이미지 렌더: 프로덕션 빌드(next start)를 띄워 카드·실험 시트를 PNG로 저장하고 헤더를 확인합니다.
#   bash render_samples.sh <APP_DIR> <OUT_DIR>
set -uo pipefail
APP="${1:?}"; F="${2:?}"; mkdir -p "$F"
setsid bash -c "cd '$APP' && exec npx next start -p 3110" > "$F/../start-final.log" 2>&1 &
PID=$!
for _ in $(seq 1 100); do curl -s -o /dev/null http://localhost:3110/_not-found && break; sleep 0.2; done
B=http://localhost:3110
shot() { local n="$1" p="$2"; shift 2; curl -sS -G -o "$F/$n.png" -w "$n %{http_code} %{size_download}B %{time_total}s\n" "$B$p" "$@"; }
shot levelup-a /api/og/levelup
shot stage-b /api/og/stage --data-urlencode style=b
shot stage-a /api/og/stage --data-urlencode style=a
shot achievement-a /api/og/achievement
shot weekly-b /api/og/weekly
shot long-levelup /api/og/levelup --data-urlencode "nick=엄청나게긴닉네임을가진모험가입니다" --data-urlencode lv=47 --data-urlencode "title=전설의 파이썬 마스터"
shot long-stage-b /api/og/stage --data-urlencode style=b --data-urlencode "nick=SuperCoder_Minjun2016" --data-urlencode "stage=아주아주 긴 이름의 신비한 조건문 갈림길 대모험" --data-urlencode stars=2
shot long-stage-a /api/og/stage --data-urlencode style=a --data-urlencode "nick=햏햏뷁똠방각하" --data-urlencode "stage=딕셔너리 도서관의 비밀 서고" --data-urlencode stars=1
shot costume /api/og/levelup --data-urlencode "costumes=explorer-hat,scarf" --data-urlencode expr=proud --data-urlencode lv=8 --data-urlencode "title=꼬마 탐험가" --data-urlencode "nick=별빛소녀"
shot grain-b /api/og/stage --data-urlencode style=b --data-urlencode grain=1
shot lab-svg /api/og-lab/svg
shot lab-css /api/og-lab/css
shot lab-inline /api/og-lab/inline --data-urlencode mode=all
shot lab-stack /api/og-lab/stack
shot lab-offline /api/og-lab/fallback --data-urlencode mode=offline --data-urlencode "line1=쀍 펲 샾 믜 코딩" --data-urlencode "line2=쉩쉩 똽뙇 민준"
shot lab-emoji /api/og-lab/emoji --data-urlencode set=twemoji
shot share-route /api/share-cards/BjvMSYokkrlDKV81Iu2Emg/image --data-urlencode v=2
echo "--- 권장 라우트 헤더"; curl -sS -o /dev/null -D - "$B/api/share-cards/BjvMSYokkrlDKV81Iu2Emg/image?v=2" | grep -i -E "^HTTP|cache-control|vercel|content-disp|x-robots"
echo "--- opengraph-image 헤더 덮어쓰기 시험"; curl -sS -o /dev/null -D - "$B/share/hzEbwb74Pa6krPzNTNoMbQ/opengraph-image" | grep -i -E "^HTTP|cache-control|vercel"
echo "--- 비공개 카드"; curl -sS -o /dev/null -D - "$B/api/share-cards/kJyqr-dfS79a7K4bQKCMFA/image" | grep -i -E "^HTTP|cache-control|vercel"
kill -TERM -- "-$PID"; sleep 1
ss -ltn | grep -q ":3110 " && echo "server still running" || echo "stopped"
