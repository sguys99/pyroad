#!/usr/bin/env bash
# 측정용 합성 오디오 생성 → generated/ (gitignore)
#  1) loop440.*  : 정확히 4.000초, 440Hz 코사인(1760주기 → 끝과 시작이 이어짐). 포맷별 패딩/루프 틈 측정용
#  2) bgm-world*.*: 75초 합성 BGM 루프 (스테레오, -16 LUFS / -1.5 dBTP). 디코드 시간·스트리밍 측정용
# 필요: ffmpeg (libopus, libmp3lame, aac)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=generated
mkdir -p "$OUT"
FF="ffmpeg -hide_banner -loglevel error -y"

# 1) 루프 틈 측정 신호 (48kHz 모노)
$FF -f lavfi -i "aevalsrc=0.4*cos(2*PI*440*t):s=48000:d=4" -c:a pcm_s16le "$OUT/loop440.wav"
$FF -i "$OUT/loop440.wav" -c:a libopus -b:a 96k "$OUT/loop440.webm"
$FF -i "$OUT/loop440.wav" -c:a libopus -b:a 96k "$OUT/loop440.ogg"
$FF -i "$OUT/loop440.wav" -c:a libmp3lame -b:a 128k "$OUT/loop440.mp3"
$FF -i "$OUT/loop440.wav" -c:a aac -b:a 128k "$OUT/loop440.m4a"

# 2) 75초 BGM 루프 3종. 주파수·리듬 주기가 75초를 나누어떨어지게 잡아 끝과 시작이 이어진다
#    (pad: 화음 3음, arp: 0.5초 단위 음 + 감쇠 엔벨로프)
bgm() {
  local name=$1 f1=$2 f2=$3 f3=$4 arp=$5
  # 필터 문법상 함수 인자 쉼표는 \, 로 이스케이프
  local expr="0.12*sin(2*PI*${f1}*t)+0.09*sin(2*PI*${f2}*t)+0.08*sin(2*PI*${f3}*t)+0.10*sin(2*PI*${arp}*(1+0.5*gt(mod(floor(t*2)\\,4)\\,1))*t)*exp(-6*mod(t\\,0.5))"
  $FF -f lavfi -i "aevalsrc=${expr}|${expr}:s=48000:d=75" \
    -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a pcm_s16le "$OUT/bgm-$name.wav"
  $FF -i "$OUT/bgm-$name.wav" -c:a libopus -b:a 96k "$OUT/bgm-$name.webm"
  $FF -i "$OUT/bgm-$name.wav" -c:a libmp3lame -b:a 128k "$OUT/bgm-$name.mp3"
  $FF -i "$OUT/bgm-$name.wav" -c:a aac -b:a 128k "$OUT/bgm-$name.m4a"
  rm "$OUT/bgm-$name.wav"
}
bgm world1 220 277.2 329.6 440
bgm world2 196 246.92 293.6 392
bgm world3 174.6 220 261.6 349.2

ls -l "$OUT" | awk 'NR>1{printf "%8.1f KB  %s\n", $5/1024, $9}'
