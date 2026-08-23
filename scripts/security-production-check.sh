#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "❌ $*" >&2; exit 1; }
pass(){ echo "✅ $*"; }

echo "===== SECURITY / RECOVERY CHECK ====="

docker compose ps >/dev/null || fail "Docker Compose unavailable"

for service in mongo redis worker app; do
  id="$(docker compose ps -q "$service")"
  [ -n "$id" ] || fail "$service container missing"
  [ "$(docker inspect -f '{{.State.Status}}' "$id")" = "running" ] \
    || fail "$service not running"
  pass "$service running"
done

for service in mongo redis app; do
  id="$(docker compose ps -q "$service")"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
  [ "$health" = "healthy" ] || fail "$service health=$health"
done
pass "container health checks"

mongo_ping="$(docker compose exec -T mongo mongosh --quiet --eval 'print(db.adminCommand({ping:1}).ok)' | tail -n 1 | tr -d '\r')"
[ "$mongo_ping" = "1" ] || fail "MongoDB ping failed"
pass "MongoDB ping"

redis_ping="$(docker compose exec -T redis redis-cli ping | tr -d '\r')"
[ "$redis_ping" = "PONG" ] || fail "Redis ping failed"
pass "Redis ping"

aof_enabled="$(docker compose exec -T redis redis-cli CONFIG GET appendonly | tail -n 1 | tr -d '\r')"
[ "$aof_enabled" = "yes" ] || fail "Redis AOF disabled"

aof_status="$(docker compose exec -T redis redis-cli INFO persistence | awk -F: '/^aof_last_write_status:/ {gsub(/\r/,"",$2); print $2}')"
[ "$aof_status" = "ok" ] || fail "Redis AOF status=$aof_status"
pass "Redis AOF healthy"

curl -fsS http://127.0.0.1:3000/api/health | grep -q '"success":true' \
  || fail "public health failed"
pass "public liveness endpoint"

if git ls-files | grep -E '(^|/)(\.env($|\.)|.*\.(pem|key|p12|pfx|crt)$)' \
  | grep -vE '(^|/)\.env\.(example|docker\.example)$' >/dev/null; then
  fail "secret-like environment/private-key file is tracked"
fi
pass "no tracked secret-like files"

if [ -n "${ADMIN_TOKEN:-}" ]; then
  admin_health="$(curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:3000/api/admin/health)"
  echo "$admin_health" | grep -q '"connected":true' \
    || fail "admin health reports MongoDB unavailable"
  echo "$admin_health" | grep -q '"reachable":true' \
    || fail "admin health reports Redis unavailable"
  pass "authenticated dependency health"

  security_report="$(curl -fsS -H "Authorization: Bearer $ADMIN_TOKEN" 'http://127.0.0.1:3000/api/admin/security?window=15')"
  echo "$security_report" | grep -q '"signals"' \
    || fail "security report unavailable"
  pass "security event report"
else
  echo "ℹ️  ADMIN_TOKEN not set; skipping authenticated admin checks"
fi

echo "===== CHECK COMPLETE ====="
