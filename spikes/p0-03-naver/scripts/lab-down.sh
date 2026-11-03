#!/bin/sh
# Removes the lab pieces created by lab-up.sh. Afterwards stop the stack itself with
#   (cd "$SUPABASE_STACK_DIR" && supabase stop --no-backup)
# which also removes the re-created auth container (it carries the CLI project label).
set -u
docker rm -f p003-mock-naver >/dev/null 2>&1 || true
docker network disconnect -f p003-pubnet "supabase_auth_${SUPABASE_PROJECT_ID:-p003naver}" >/dev/null 2>&1 || true
docker network rm p003-pubnet >/dev/null 2>&1 || true
echo "lab removed"
