#!/bin/sh
# P0-04 e2e: 로컬 Supabase Postgres + GoTrue v2.197.0 2대 + Kakao 목업(TLS, 별칭 kapi.kakao.com)
# - 호스트에 여는 포트는 Postgres 55532(127.0.0.1) 하나뿐. 나머지는 docker 네트워크 p004net 안에서만 통신
# - p004net 은 CGNAT 대역(100.64.54.0/24): GoTrue 의 SSRF 가드가 사설 IP(RFC1918)를 막기 때문 (custom OIDC discovery/JWKS)
# - 끝나면(실패해도) 컨테이너·네트워크를 모두 지운다
# 사용: sh spikes/p0-04-kakao/e2e/run.sh   (P004_KEEP=1 이면 정리하지 않음)
set -eu

SPIKE=$(cd "$(dirname "$0")/.." && pwd)
REPO=$(cd "$SPIKE/../.." && pwd)
WORK=${P004_WORK:-${TMPDIR:-/tmp}/p004-kakao-e2e}
NET=p004net
PG_IMAGE=public.ecr.aws/supabase/postgres:17.6.1.171
AUTH_IMAGE=public.ecr.aws/supabase/gotrue:v2.197.0
NODE_IMAGE=node:24-trixie-slim
JWT_SECRET=$(openssl rand -hex 24)   # 로컬 일회용
OUT="$SPIKE/e2e/observed"

remove_all() {
  docker rm -f p004pg p004auth p004auth-strict p004mock >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
cleanup() {
  if [ "${P004_KEEP:-0}" = "1" ]; then echo "(P004_KEEP=1: 컨테이너 유지, 정리: docker rm -f p004pg p004auth p004auth-strict p004mock; docker network rm $NET)"; return; fi
  remove_all
}
trap cleanup EXIT INT TERM
remove_all

mkdir -p "$WORK/certs" "$OUT"

echo "== 1. 임시 CA + kapi.kakao.com 인증서"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=p004-test-ca" \
  -keyout "$WORK/certs/ca.key" -out "$WORK/certs/ca.pem" >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -subj "/CN=kapi.kakao.com" \
  -keyout "$WORK/certs/leaf.key" -out "$WORK/certs/leaf.csr" >/dev/null 2>&1
printf 'subjectAltName=DNS:kapi.kakao.com,DNS:mock-kauth.p004.test\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' > "$WORK/certs/ext.cnf"
openssl x509 -req -in "$WORK/certs/leaf.csr" -CA "$WORK/certs/ca.pem" -CAkey "$WORK/certs/ca.key" \
  -CAcreateserial -days 2 -extfile "$WORK/certs/ext.cnf" -out "$WORK/certs/leaf.pem" >/dev/null 2>&1
# GoTrue 는 실제 kauth.kakao.com(S12) 에도 접속하므로 시스템 CA + 임시 CA 를 합친 번들을 쓴다
docker run --rm --entrypoint cat "$AUTH_IMAGE" /etc/ssl/certs/ca-certificates.crt > "$WORK/certs/bundle.pem"
cat "$WORK/certs/ca.pem" >> "$WORK/certs/bundle.pem"
chmod 644 "$WORK/certs/"*

echo "== 2. 네트워크 + Postgres (127.0.0.1:55532)"
docker network create --subnet 100.64.54.0/24 "$NET" >/dev/null
docker run -d --name p004pg --network "$NET" -p 127.0.0.1:55532:5432 \
  -e POSTGRES_PASSWORD=postgres "$PG_IMAGE" >/dev/null
i=0
until docker exec p004pg pg_isready -U postgres -h localhost >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -gt 60 ] && { echo "postgres 시작 실패"; docker logs p004pg | tail -20; exit 1; }
  sleep 1
done
sleep 3
docker exec p004pg psql -U supabase_admin -d postgres -qc "ALTER ROLE supabase_auth_admin WITH PASSWORD 'postgres';"

echo "== 3. Kakao 목업 (https://kapi.kakao.com, 네트워크 내부 전용)"
docker run -d --name p004mock --network "$NET" --network-alias kapi.kakao.com --network-alias mock-kauth.p004.test \
  -v "$SPIKE/e2e:/app:ro" -v "$WORK/certs:/certs:ro" \
  -e PORT=443 -e TLS_CERT=/certs/leaf.pem -e TLS_KEY=/certs/leaf.key -e MOCK_OIDC_HOST=mock-kauth.p004.test \
  -e MOCK_REDIRECT_URIS=http://p004auth:9999/callback,http://p004auth-strict:9999/callback \
  "$NODE_IMAGE" node /app/mock-kakao.mjs >/dev/null

start_gotrue() { # name email_optional
  docker run -d --name "$1" --network "$NET" -v "$WORK/certs:/certs:ro" \
    -e SSL_CERT_FILE=/certs/bundle.pem \
    -e GOTRUE_API_HOST=0.0.0.0 -e PORT=9999 -e API_EXTERNAL_URL="http://$1:9999" \
    -e GOTRUE_DB_DRIVER=postgres \
    -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@p004pg:5432/postgres?sslmode=disable" \
    -e GOTRUE_SITE_URL=http://localhost:3000 -e GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" \
    -e GOTRUE_JWT_SECRET="$JWT_SECRET" -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
    -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
    -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_LOG_LEVEL=warn \
    -e GOTRUE_EXTERNAL_KAKAO_ENABLED=true \
    -e GOTRUE_EXTERNAL_KAKAO_CLIENT_ID=mock-rest-api-key \
    -e GOTRUE_EXTERNAL_KAKAO_SECRET=mock-client-secret \
    -e GOTRUE_EXTERNAL_KAKAO_REDIRECT_URI="http://$1:9999/callback" \
    -e GOTRUE_EXTERNAL_KAKAO_URL=https://kapi.kakao.com \
    -e GOTRUE_EXTERNAL_KAKAO_EMAIL_OPTIONAL="$2" \
    -e GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=true \
    "$AUTH_IMAGE" >/dev/null
  i=0
  until docker exec "$1" wget -qO- http://localhost:9999/health >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -gt 60 ] && { echo "$1 시작 실패"; docker logs "$1" | tail -30; exit 1; }
    sleep 1
  done
}

echo "== 4. GoTrue A (email_optional=true) → 마이그레이션 후 GoTrue B (email_optional=false)"
start_gotrue p004auth true
start_gotrue p004auth-strict false
docker exec p004auth wget -qO- http://localhost:9999/health; echo

psql_pg() { docker exec -i -e PGPASSWORD=postgres p004pg psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 "$@"; }
# SET ROLE supabase_auth_admin (GoTrue 와 같은 역할로 INSERT) 은 superuser 만 가능
psql_su() { docker exec -i p004pg psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 "$@"; }

echo "== 5. 앱 마이그레이션 00001 + 00002 + handle_new_user.draft.sql"
psql_pg -q < "$REPO/supabase/migrations/00001_v0.1.0_initial_schema.sql" >/dev/null
psql_pg -q < "$REPO/supabase/migrations/00002_v0.3.1_security_hotfix.sql" >/dev/null
psql_pg -q < "$SPIKE/handle_new_user.draft.sql"
echo "   (두 번 적용해도 안전한지 확인)"; psql_pg -q < "$SPIKE/handle_new_user.draft.sql"

echo "== 6. SQL 단위 검증 (handle_new_user.test.sql, ROLLBACK)"
psql_su < "$SPIKE/sql/handle_new_user.test.sql"

echo "== 7. GoTrue 흐름 실측 (gotrue-flow.mjs)"
docker run --rm --network "$NET" --user "$(id -u):$(id -g)" \
  -v "$SPIKE/e2e:/app:ro" -v "$REPO/node_modules:/deps/node_modules:ro" -v "$OUT:/out" -v "$WORK/certs:/certs:ro" \
  -e NODE_EXTRA_CA_CERTS=/certs/ca.pem -e JWT_SECRET="$JWT_SECRET" \
  "$NODE_IMAGE" node /app/gotrue-flow.mjs

echo "== 8. 사후 검증 (e2e_check.sql)"
psql_pg < "$SPIKE/sql/e2e_check.sql"

echo "== 9. 실측 데이터 덤프 → e2e/observed/db_rows.json"
psql_pg -At -c "
SELECT json_agg(row_to_json(t) ORDER BY t.created_at) FROM (
  SELECT a.created_at, a.email, a.email_confirmed_at IS NOT NULL AS email_confirmed,
         a.raw_app_meta_data, a.raw_user_meta_data,
         (SELECT json_agg(json_build_object('provider', i.provider, 'provider_id', i.provider_id, 'email', i.email))
            FROM auth.identities i WHERE i.user_id = a.id) AS identities,
         json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url, 'nickname', u.nickname,
                           'last_login_provider', u.last_login_provider) AS public_users
    FROM auth.users a LEFT JOIN public.users u ON u.id = a.id) t;" > "$OUT/db_rows.json"
echo "완료: $OUT"
