#!/bin/sh
# P0-03 test lab on top of a LOCAL Supabase CLI stack (default project_id p003naver).
#
# GoTrue only accepts custom OAuth/OIDC providers that are https:// and resolve to a
# non-private IP (SSRF guard, both at provider creation and at runtime for OIDC
# discovery/JWKS). To exercise the real GoTrue code path against a mock Naver:
#   1. make a throwaway test CA + server cert for mock-nid.p003.test
#   2. create a Docker network on 100.64.53.0/24 (CGNAT range: not RFC1918, so allowed)
#   3. run the mock Naver (HTTPS :443) on that network at 100.64.53.10
#   4. re-create the CLI's auth container (same name/env/image) with SSL_CERT_DIR
#      pointing at the test CA and attach it to that network
# Nothing is published to the host. Undo with scripts/lab-down.sh.
set -eu
SPIKE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ID="${SUPABASE_PROJECT_ID:-p003naver}"
NET_SB="supabase_network_${PROJECT_ID}"
AUTH="supabase_auth_${PROJECT_ID}"
API_PORT="${SUPABASE_API_PORT:-55421}"
NODE_IMAGE="${NODE_IMAGE:-public.ecr.aws/supabase/postgres-meta:v0.98.0}"
: "${LAB_DIR:?set LAB_DIR to a scratch directory (certs + auth env are written there)}"
mkdir -p "$LAB_DIR/ca" && chmod 700 "$LAB_DIR"

# 1. test CA + server cert (2-day validity)
if [ ! -f "$LAB_DIR/mock.pem" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=p003 throwaway test CA" \
    -keyout "$LAB_DIR/ca.key" -out "$LAB_DIR/ca/p003-ca.pem" 2>/dev/null
  openssl req -newkey rsa:2048 -nodes -subj "/CN=mock-nid.p003.test" \
    -keyout "$LAB_DIR/mock.key" -out "$LAB_DIR/mock.csr" 2>/dev/null
  printf 'subjectAltName=DNS:mock-nid.p003.test\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' > "$LAB_DIR/ext.cnf"
  openssl x509 -req -days 2 -in "$LAB_DIR/mock.csr" -CA "$LAB_DIR/ca/p003-ca.pem" -CAkey "$LAB_DIR/ca.key" \
    -CAcreateserial -extfile "$LAB_DIR/ext.cnf" -out "$LAB_DIR/mock.pem" 2>/dev/null
  chmod 644 "$LAB_DIR/mock.key" # read by the node user inside the mock container
fi

# 2. "public-looking" network
docker network inspect p003-pubnet >/dev/null 2>&1 || docker network create --subnet 100.64.53.0/24 p003-pubnet >/dev/null

# 3. mock Naver
docker rm -f p003-mock-naver >/dev/null 2>&1 || true
docker run -d --name p003-mock-naver --no-healthcheck \
  --network p003-pubnet --ip 100.64.53.10 --network-alias mock-nid.p003.test \
  -v "$SPIKE_DIR:/spike:ro" -v "$LAB_DIR:/lab:ro" \
  -e PORT=443 -e MOCK_TLS_CERT=/lab/mock.pem -e MOCK_TLS_KEY=/lab/mock.key \
  -e NODE_EXTRA_CA_CERTS=/lab/ca/p003-ca.pem \
  -e MOCK_ISSUER=https://mock-nid.p003.test -e MOCK_PUBLIC_BASE=https://mock-nid.p003.test \
  -e MOCK_REDIRECT_URIS="http://127.0.0.1:${API_PORT}/auth/v1/callback,http://127.0.0.1:3000/auth/naver/callback" \
  --entrypoint node "$NODE_IMAGE" /spike/mock-naver/server.ts >/dev/null

# 4. auth container with the test CA (same image, env, name, alias, labels)
if ! docker inspect "$AUTH" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^SSL_CERT_DIR='; then
  IMAGE="$(docker inspect "$AUTH" --format '{{.Config.Image}}')"
  docker inspect "$AUTH" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -v '^$' > "$LAB_DIR/auth.env"
  chmod 600 "$LAB_DIR/auth.env"
  docker rm -f "$AUTH" >/dev/null
  docker create --name "$AUTH" --network "$NET_SB" --network-alias auth \
    --env-file "$LAB_DIR/auth.env" -e SSL_CERT_DIR=/p003-ca \
    -v "$LAB_DIR/ca:/p003-ca:ro" --add-host host.docker.internal:host-gateway \
    --label "com.supabase.cli.project=${PROJECT_ID}" --label "com.docker.compose.project=${PROJECT_ID}" \
    "$IMAGE" auth >/dev/null
  docker network connect p003-pubnet "$AUTH"
  docker start "$AUTH" >/dev/null
fi

docker exec p003-mock-naver node -e "
  const t0 = Date.now();
  (async function poll() {
    try { const r = await fetch('https://mock-nid.p003.test/__mock/health'); if (r.ok) { console.log('mock-naver up:', (await r.json()).issuer); return; } } catch (e) {}
    if (Date.now() - t0 > 15000) { console.error('mock-naver not ready'); process.exit(1); }
    setTimeout(poll, 300);
  })();
"
docker exec "$AUTH" sh -c 'for i in $(seq 1 30); do wget -q -O- http://127.0.0.1:9999/health >/dev/null 2>&1 && exit 0; sleep 0.5; done; exit 1' \
  && echo "auth up with test CA ($(docker inspect "$AUTH" --format '{{.Config.Image}}'))"
