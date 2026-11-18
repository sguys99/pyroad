#!/usr/bin/env bash
# 시각 회귀 (P12-02, e2e/README.md "시각 회귀"). 브라우저만 공식 Playwright Docker 이미지에서 띄우고
# 테스트 러너·앱 서버·로컬 Supabase 는 이 기기에 둔다 → macOS 에서도 리눅스 글꼴 렌더링으로 찍혀 기준 이미지가 한 벌
# (e2e/visual/__screenshots__/). 단 Apple Silicon 은 linux/arm64, CI 는 linux/amd64 라 픽셀이 같다는 보장은 없음 (CI 는 경고만).
# 브라우저의 localhost(앱 3100·Supabase 54521) 요청은 connectOptions.exposeNetwork '<loopback>'으로 러너 쪽에 넘어온다
# (Docker Desktop 의 host 네트워크 설정이 필요 없음).
#
#   npm run test:visual                         # 비교
#   npm run test:visual -- --update-snapshots   # 기준 이미지 다시 만들기 (바뀐 화면을 눈으로 확인하고 커밋)
#
# 컨테이너 이름은 pyroad-visual-<pid> 하나만 만들고 끝나면 지운다 (다른 프로젝트의 컨테이너는 건드리지 않음).
set -euo pipefail
cd "$(dirname "$0")/../.."

PW_VERSION="$(node -p "require('@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${PW_VERSION}-noble"
WS_PORT="${VISUAL_WS_PORT:-53333}"
NAME="pyroad-visual-$$"
# 기본은 이 기기의 아키텍처 이미지. Apple Silicon 에서 CI 와 같은 amd64 로 찍으려면 Docker Desktop 의 Rosetta 를 켜고
# VISUAL_DOCKER_PLATFORM=linux/amd64 (Rosetta 없이 qemu 로는 Chromium 이 죽음)
PLATFORM_ARGS=()
if [[ -n "${VISUAL_DOCKER_PLATFORM:-}" ]]; then PLATFORM_ARGS=(--platform "$VISUAL_DOCKER_PLATFORM"); fi

docker run -d --rm --init --name "$NAME" "${PLATFORM_ARGS[@]}" \
  -p "127.0.0.1:${WS_PORT}:3000" --user pwuser --workdir /home/pwuser \
  "$IMAGE" /bin/sh -c "npx -y playwright@${PW_VERSION} run-server --port 3000 --host 0.0.0.0" >/dev/null
trap 'docker stop "$NAME" >/dev/null 2>&1 || true' EXIT

# run-server 가 뜰 때까지 (처음엔 npx 가 playwright 패키지를 받음)
for _ in $(seq 1 120); do
  if docker logs "$NAME" 2>&1 | grep -q 'Listening on'; then break; fi
  sleep 1
done
docker logs "$NAME" 2>&1 | grep -q 'Listening on' || {
  docker logs "$NAME" >&2
  echo '[visual] Playwright run-server 가 뜨지 않음' >&2
  exit 1
}

E2E_VISUAL_WS="ws://127.0.0.1:${WS_PORT}/" npx playwright test --project=visual "$@"
