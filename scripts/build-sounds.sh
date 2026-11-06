#!/usr/bin/env bash
# 사운드 에셋 파이프라인 (P0-15 초안 → P2-14·P2-16). 결과는 public/sounds/{sfx,bgm}/<id>.v<N>.{webm,m4a}
#
#   bash scripts/build-sounds.sh sfx <Kenney 팩 상위 디렉토리>
#   bash scripts/build-sounds.sh bgm <id> <버전> <원본 오디오> [--trim START END]
#   bash scripts/build-sounds.sh bgm-preview <이름> <원본 오디오> <출력 디렉토리> [--trim START END]
#   bash scripts/build-sounds.sh check          # public/sounds 의 모든 파일 길이·피크·라우드니스 표
#
# 파일 이름에 버전(v1, v2 …)이 붙고 `/sounds/*` 는 1년 immutable 캐시라서, 이미 있는 파일을 다른 내용으로 덮어쓰지 않는다
# (내용이 다르면 실패 → 버전을 올리고 src/lib/sound/manifest.ts 한 줄을 바꾼다). 교체 방법: docs/design/sound.md
#
# sfx: Kenney CC0 팩(https://kenney.nl/assets 또는 OpenGameArt의 Kenney 업로드, 출처는 docs/design/sound-sources.md)을
#   ex-<팩>/ 이름으로 푼 상위 디렉토리. 팩 안의 폴더 구조는 상관없이 파일 이름(확장자 제외)으로 찾는다 (.ogg > .wav > .mp3).
#   처리: 모노 48kHz → 앞 무음 제거(-55dB) → 역할별 RMS 목표로 gain → 리미터 -1.5dBFS → Opus 64k(.webm) / AAC 96k(.m4a)
#   MP3는 만들지 않는다 (WebKit 앞뒤 패딩 23~32ms, P0-15 §4.4).
# bgm: 48kHz 스테레오 → 루프 이음매 5.3ms(256샘플) 크로스페이드(끝 → 처음, 딸깍 소리 방지) → -16 LUFS gain
#   → 예상 true peak가 -1.5dBTP를 넘으면 리미터(루프를 세 번 이어 붙여 가운데만 써서 이음매에서도 같은 상태) → Opus 96k / AAC 128k
#   bgm-preview: 같은 처리 + Opus 48k 하나 (청취 검수 페이지에 data URI로 넣는 용도, design/prototypes/src/sound-review)
# 필요: ffmpeg (libopus 포함), awk
set -euo pipefail
cd "$(dirname "$0")/.."
FF=(ffmpeg -hide_banner -loglevel error -nostdin -y)
# 다시 만들어도 같은 바이트가 나오게: 인코더 버전·생성 시각 메타데이터를 넣지 않음
BITEXACT=(-map_metadata -1 -fflags +bitexact -flags:a +bitexact)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

die() { echo "build-sounds: $*" >&2; exit 1; }

# 같은 이름의 파일이 있으면 내용이 같을 때만 통과 (immutable 캐시 보호)
install_versioned() {
  local tmp=$1 dest=$2
  if [[ -e "$dest" ]]; then
    if cmp -s "$tmp" "$dest"; then echo "  = $dest (같음)"; return; fi
    die "$dest 가 이미 있고 내용이 다릅니다. 버전을 올리세요 (immutable 캐시)"
  fi
  mkdir -p "$(dirname "$dest")"
  cp "$tmp" "$dest"
  echo "  + $dest ($(wc -c < "$dest" | awk '{printf "%.1fKB", $1/1024}'))"
}

rms_of() { ffmpeg -hide_banner -nostats -i "$1" -af astats=measure_perchannel=none -f null - 2>&1 | awk '/Overall/{o=1} o&&/RMS level dB/{print $NF; exit}'; }
peak_of() { ffmpeg -hide_banner -nostats -i "$1" -af astats=measure_perchannel=none -f null - 2>&1 | awk '/Overall/{o=1} o&&/Peak level dB/{print $NF; exit}'; }
dur_of() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
# 통합 라우드니스(LUFS)와 true peak(dBTP)
loud_of() { ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/I:/{i=$2} /Peak:/{p=$2} END{print i, p}'; }

# ───────────────────────────── 효과음 ─────────────────────────────

find_src() {
  local root=$1 pack=$2 name=$3 ext f
  [[ -d "$root/ex-$pack" ]] || die "팩 디렉토리 없음: $root/ex-$pack"
  for ext in ogg wav mp3; do
    f=$(find "$root/ex-$pack" -type f -name "$name.$ext" | sort | head -1)
    [[ -n "$f" ]] && { echo "$f"; return; }
  done
  die "원본 없음: ex-$pack/**/$name.{ogg,wav,mp3}"
}

# sfx_one <id> <버전> <목표 RMS dB> <팩> <파일> [<팩2> <파일2> <지연ms>]
sfx_one() {
  local root=$1 id=$2 ver=$3 target=$4 pack=$5 name=$6 pack2=${7:-} name2=${8:-} delay=${9:-0}
  local a b mixed="$TMP/$id.wav"
  a=$(find_src "$root" "$pack" "$name")
  if [[ -n "$pack2" ]]; then
    b=$(find_src "$root" "$pack2" "$name2")
    "${FF[@]}" -i "$a" -i "$b" -filter_complex \
      "[0:a]aformat=channel_layouts=mono,aresample=48000[x];[1:a]aformat=channel_layouts=mono,aresample=48000,adelay=${delay}[y];[x][y]amix=inputs=2:normalize=0" \
      -ar 48000 "$mixed"
  else
    "${FF[@]}" -i "$a" -ac 1 -ar 48000 "$mixed"
  fi
  # 앞 무음 제거 (첫 탭 지연 최소화)
  "${FF[@]}" -i "$mixed" -af "silenceremove=start_periods=1:start_threshold=-55dB" "$TMP/$id.trim.wav"
  local rms gain
  rms=$(rms_of "$TMP/$id.trim.wav")
  gain=$(awk -v t="$target" -v r="$rms" 'BEGIN{printf "%.2f", t - r}')
  "${FF[@]}" -i "$TMP/$id.trim.wav" -af "volume=${gain}dB,alimiter=limit=0.84:level=disabled" "$TMP/$id.norm.wav"
  "${FF[@]}" -i "$TMP/$id.norm.wav" -c:a libopus -b:a 64k -ac 1 "${BITEXACT[@]}" "$TMP/$id.webm"
  "${FF[@]}" -i "$TMP/$id.norm.wav" -c:a aac -b:a 96k -ac 1 -ar 44100 -movflags +faststart "${BITEXACT[@]}" "$TMP/$id.m4a"
  printf "%-10s v%s  %-34s rms %7s → %4s dB (gain %6s dB)  %.2fs\n" "$id" "$ver" "$name${name2:+ + $name2}" "$rms" "$target" "$gain" "$(dur_of "$TMP/$id.norm.wav")"
  install_versioned "$TMP/$id.webm" "public/sounds/sfx/$id.v$ver.webm"
  install_versioned "$TMP/$id.m4a" "public/sounds/sfx/$id.v$ver.m4a"
}

build_sfx() {
  local root=${1:?"Kenney 팩 상위 디렉토리를 인자로 주세요"}
  # id | 버전 | 목표 RMS | 팩 | 원본 (+ 팩2 원본2 지연ms). 바꾸면 버전을 올리고 manifest.ts 도 같이 바꾼다
  # wrong·bug 는 P0-15 초안(error_006·lowRandom: 스펙트럼 중심 120~160Hz의 낮은 웅웅 소리, 노트북·태블릿 스피커에서 거의
  # 안 들리고 "실패 부저"처럼 들릴 수 있음)을 P2-14에서 중음역의 부드러운 소리로 바꿨다 (docs/design/sound.md)
  sfx_one "$root" tap       1 -24 interface-sounds click_001
  sfx_one "$root" blip      1 -24 interface-sounds tick_004
  sfx_one "$root" correct   1 -19 interface-sounds confirmation_002
  sfx_one "$root" wrong     1 -23 interface-sounds question_002
  sfx_one "$root" coin      1 -19 rpg-audio        handleCoins2
  sfx_one "$root" star      1 -20 interface-sounds glass_001
  sfx_one "$root" run       1 -20 digital-audio    phaseJump1
  sfx_one "$root" bug       1 -21 digital-audio    phaserDown1
  sfx_one "$root" unlock    1 -19 rpg-audio        metalLatch interface-sounds maximize_004 150
  sfx_one "$root" chest     1 -19 rpg-audio        creak1     rpg-audio        handleCoins 300
  sfx_one "$root" levelup   1 -18 music-jingles    jingles_NES00
  sfx_one "$root" celebrate 1 -18 music-jingles    jingles_STEEL07
}

# ───────────────────────────── 배경음악 ─────────────────────────────

XFADE_SAMPLES=256

# bgm_master <원본> <출력 wav> [START END]: 루프 이음매 크로스페이드 + -16 LUFS + 필요하면 정상 상태 리미터
bgm_master() {
  local src=$1 out=$2 start=${3:-} end=${4:-}
  local trim=""
  [[ -n "$start" ]] && trim=",atrim=start=${start}:end=${end},asetpts=N/SR/TB"
  "${FF[@]}" -i "$src" -af "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo${trim}" -c:a pcm_f32le "$TMP/bgm.src.wav"
  local n k=$XFADE_SAMPLES
  n=$(ffprobe -v error -select_streams a:0 -count_packets -show_entries stream=duration_ts -of csv=p=0 "$TMP/bgm.src.wav")
  [[ "$n" =~ ^[0-9]+$ ]] || n=$(awk -v d="$(dur_of "$TMP/bgm.src.wav")" 'BEGIN{printf "%d", d*48000}')
  # 루프 = 가운데[k, n-k) + (끝 k샘플이 사라지며 처음 k샘플이 들어옴). 끝 → 처음이 이어져 딸깍 소리가 나지 않는다
  "${FF[@]}" -i "$TMP/bgm.src.wav" -filter_complex \
    "[0:a]asplit=3[s0][s1][s2];\
     [s0]atrim=start_sample=$k:end_sample=$((n - k)),asetpts=N/SR/TB[mid];\
     [s1]atrim=start_sample=$((n - k)):end_sample=$n,asetpts=N/SR/TB[tail];\
     [s2]atrim=start_sample=0:end_sample=$k,asetpts=N/SR/TB[head];\
     [tail]afade=t=out:ss=0:ns=$k:curve=qsin[tf];\
     [head]afade=t=in:ss=0:ns=$k:curve=qsin[hf];\
     [tf][hf]amix=inputs=2:normalize=0[seam];\
     [mid][seam]concat=n=2:v=0:a=1[out]" \
    -map "[out]" -c:a pcm_f32le "$TMP/bgm.loop.wav"
  local lufs tp gain ptp
  read -r lufs tp < <(loud_of "$TMP/bgm.loop.wav")
  gain=$(awk -v i="$lufs" 'BEGIN{printf "%.2f", -16 - i}')
  ptp=$(awk -v p="$tp" -v g="$gain" 'BEGIN{printf "%.2f", p + g}')
  if awk -v p="$ptp" 'BEGIN{exit !(p > -1.5)}'; then
    # 리미터 상태가 루프 앞뒤에서 같도록 세 번 이어 붙여 처리하고 가운데 한 바퀴만 쓴다
    local m
    m=$(ffprobe -v error -show_entries stream=duration_ts -of csv=p=0 "$TMP/bgm.loop.wav")
    "${FF[@]}" -i "$TMP/bgm.loop.wav" -i "$TMP/bgm.loop.wav" -i "$TMP/bgm.loop.wav" -filter_complex \
      "[0:a][1:a][2:a]concat=n=3:v=0:a=1,volume=${gain}dB,alimiter=limit=0.84:attack=5:release=50:level=disabled,atrim=start_sample=$m:end_sample=$((2 * m)),asetpts=N/SR/TB[o]" \
      -map "[o]" -c:a pcm_f32le "$out"
    echo "  라우드니스 ${lufs} LUFS (TP ${tp}) → gain ${gain}dB + 리미터 (예상 TP ${ptp})"
  else
    "${FF[@]}" -i "$TMP/bgm.loop.wav" -af "volume=${gain}dB" -c:a pcm_f32le "$out"
    echo "  라우드니스 ${lufs} LUFS (TP ${tp}) → gain ${gain}dB (TP ${ptp})"
  fi
}

build_bgm() {
  local id=${1:?id} ver=${2:?버전} src=${3:?원본}; shift 3
  local start="" end=""
  if [[ "${1:-}" == "--trim" ]]; then start=$2; end=$3; fi
  [[ -f "$src" ]] || die "원본 없음: $src"
  echo "bgm $id v$ver ← $src"
  bgm_master "$src" "$TMP/$id.master.wav" "$start" "$end"
  "${FF[@]}" -i "$TMP/$id.master.wav" -c:a libopus -b:a 96k -ac 2 -application audio "${BITEXACT[@]}" "$TMP/$id.webm"
  "${FF[@]}" -i "$TMP/$id.master.wav" -c:a aac -b:a 128k -ac 2 -ar 48000 -movflags +faststart "${BITEXACT[@]}" "$TMP/$id.m4a"
  read -r lufs tp < <(loud_of "$TMP/$id.webm")
  printf "  결과 %.2fs, %s LUFS, TP %s dBTP\n" "$(dur_of "$TMP/$id.master.wav")" "$lufs" "$tp"
  install_versioned "$TMP/$id.webm" "public/sounds/bgm/$id.v$ver.webm"
  install_versioned "$TMP/$id.m4a" "public/sounds/bgm/$id.v$ver.m4a"
}

build_bgm_preview() {
  local name=${1:?이름} src=${2:?원본} dir=${3:?출력 디렉토리}; shift 3
  local start="" end=""
  if [[ "${1:-}" == "--trim" ]]; then start=$2; end=$3; fi
  [[ -f "$src" ]] || die "원본 없음: $src"
  echo "bgm-preview $name ← $src"
  bgm_master "$src" "$TMP/$name.master.wav" "$start" "$end"
  mkdir -p "$dir"
  "${FF[@]}" -i "$TMP/$name.master.wav" -c:a libopus -b:a 48k -ac 2 -application audio "${BITEXACT[@]}" "$dir/$name.webm"
  printf "  → %s/%s.webm (%sKB, %.2fs)\n" "$dir" "$name" "$(wc -c < "$dir/$name.webm" | awk '{printf "%.1f", $1/1024}')" "$(dur_of "$TMP/$name.master.wav")"
}

check_all() {
  printf "%-36s %7s %9s %9s %8s\n" 파일 길이s 피크dB RMSdB LUFS
  local f
  for f in public/sounds/sfx/*.webm public/sounds/bgm/*.webm; do
    [[ -e "$f" ]] || continue
    read -r lufs tp < <(loud_of "$f")
    printf "%-36s %7.2f %9s %9s %8s\n" "$f" "$(dur_of "$f")" "$(peak_of "$f")" "$(rms_of "$f")" "$lufs"
  done
}

cmd=${1:-}
shift || true
case "$cmd" in
  sfx) build_sfx "$@" ;;
  bgm) build_bgm "$@" ;;
  bgm-preview) build_bgm_preview "$@" ;;
  check) check_all ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
