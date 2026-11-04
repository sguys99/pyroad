#!/usr/bin/env bash
# Kenney CC0 팩 → 스타터 효과음 12종 (정규화 + WebM/Opus + MP3) → sounds/
# 사용: bash scripts/build-sounds.sh <Kenney 팩 압축을 푼 상위 디렉토리>
#   디렉토리 안에 ex-interface-sounds/, ex-digital-audio/, ex-rpg-audio/, ex-music-jingles/ 가 있어야 한다.
#   (팩 다운로드: https://kenney.nl/assets/<slug> → Download → "Continue without donating")
# 처리: 앞쪽 무음 제거 → 모노 → 역할별 RMS 목표로 gain → 리미터(-1.5 dBFS) → Opus 64k(.webm) / AAC 96k(.m4a, 권장 폴백) / MP3 96k(.mp3, 비교용)
# 이 스크립트는 P2-16 에셋 파이프라인의 초안이다.
set -euo pipefail
SRC=${1:?"Kenney 팩 디렉토리를 인자로 주세요"}
cd "$(dirname "$0")/.."
OUT=sounds
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FF="ffmpeg -hide_banner -loglevel error -y"

IS="$SRC/ex-interface-sounds/Audio"
DA="$SRC/ex-digital-audio/Audio"
RPG="$SRC/ex-rpg-audio/Audio"
MJ="$SRC/ex-music-jingles/Audio"

rms_of() { ffmpeg -hide_banner -nostats -i "$1" -af astats=measure_perchannel=none -f null - 2>&1 | awk '/Overall/{o=1} o&&/RMS level dB/{print $NF; exit}'; }

# id | 목표 RMS(dBFS) | 원본 (A[+B@지연ms])
build() {
  local id=$1 target=$2 a=$3 b=${4:-} delay=${5:-0}
  local mixed="$TMP/$id.wav"
  if [[ -n "$b" ]]; then
    $FF -i "$a" -i "$b" -filter_complex "[0:a]aformat=channel_layouts=mono[x];[1:a]aformat=channel_layouts=mono,adelay=${delay}[y];[x][y]amix=inputs=2:normalize=0" -ar 48000 "$mixed"
  else
    $FF -i "$a" -ac 1 -ar 48000 "$mixed"
  fi
  # 앞 무음 제거 (재생 지연 최소화)
  $FF -i "$mixed" -af "silenceremove=start_periods=1:start_threshold=-55dB" "$TMP/$id.trim.wav"
  local rms gain
  rms=$(rms_of "$TMP/$id.trim.wav")
  gain=$(awk -v t="$target" -v r="$rms" 'BEGIN{printf "%.2f", t - r}')
  $FF -i "$TMP/$id.trim.wav" -af "volume=${gain}dB,alimiter=limit=0.84:level=disabled" "$TMP/$id.norm.wav"
  $FF -i "$TMP/$id.norm.wav" -c:a libopus -b:a 64k -ac 1 "$OUT/$id.webm"
  $FF -i "$TMP/$id.norm.wav" -c:a aac -b:a 96k -ac 1 -ar 44100 -movflags +faststart "$OUT/$id.m4a"
  $FF -i "$TMP/$id.norm.wav" -c:a libmp3lame -b:a 96k -ac 1 -ar 44100 "$OUT/$id.mp3"
  printf "%-10s rms %7s → %4s dB (gain %6s dB)\n" "$id" "$rms" "$target" "$gain"
}

mkdir -p "$OUT"
build tap       -24 "$IS/click_001.ogg"
build blip      -24 "$IS/tick_004.ogg"
build correct   -19 "$IS/confirmation_002.ogg"
build wrong     -22 "$IS/error_006.ogg"
build coin      -19 "$RPG/handleCoins2.ogg"
build star      -20 "$IS/glass_001.ogg"
build run       -20 "$DA/phaseJump1.ogg"
build bug       -21 "$DA/lowRandom.ogg"
build unlock    -19 "$RPG/metalLatch.ogg" "$IS/maximize_004.ogg" 150
build chest     -19 "$RPG/creak1.ogg" "$RPG/handleCoins.ogg" 300
build levelup   -18 "$MJ/8-Bit jingles/jingles_NES00.ogg"
build celebrate -18 "$MJ/Steel jingles/jingles_STEEL07.ogg"

# 사용한 4개 팩의 License.txt 원문을 모은다 (모두 CC0 1.0)
: > "$OUT/LICENSE-kenney.txt"
for pack in interface-sounds digital-audio rpg-audio music-jingles; do
  { echo "===== Kenney ${pack} (https://kenney.nl/assets/${pack}) ====="; tr -d '\r' < "$SRC/ex-${pack}/License.txt"; echo; echo; } >> "$OUT/LICENSE-kenney.txt"
done
du -cb "$OUT"/*.webm | tail -1 | awk '{printf "webm 합계 %.1f KB\n", $1/1024}'
du -cb "$OUT"/*.m4a | tail -1 | awk '{printf "m4a 합계 %.1f KB\n", $1/1024}'
du -cb "$OUT"/*.mp3 | tail -1 | awk '{printf "mp3 합계 %.1f KB\n", $1/1024}'
