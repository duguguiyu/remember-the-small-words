#!/usr/bin/env bash
set -euo pipefail

# Local production-like run: Node + SQLite, no Docker.
# Builds the Vue app, serves it from Fastify, seeds data, smoke-tests.
#
# Usage:
#   ./scripts/local-deploy.sh          # build + start + seed + smoke
#   ./scripts/local-deploy.sh up
#   ./scripts/local-deploy.sh smoke    # test an already-running instance
#   ./scripts/local-deploy.sh down     # stop background server
#   ./scripts/local-deploy.sh prepare  # only create/migrate sqlite + generate client

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PORT="${LOCAL_PORT:-8080}"
BASE="http://127.0.0.1:${PORT}"
ADMIN_USER="${BOOTSTRAP_ADMIN_USER:-admin}"
ADMIN_PASSWORD="${BOOTSTRAP_ADMIN_PASSWORD:-changeme}"
JWT_SECRET="${JWT_SECRET:-dev-secret-change-me}"
DATA_DIR="$ROOT/server/data"
DB_FILE="$DATA_DIR/local.db"
PID_FILE="$ROOT/.local-deploy.pid"
LOG_FILE="$ROOT/.local-deploy.log"
SCHEMA="$ROOT/server/prisma/schema.local.prisma"
CMD="${1:-up}"

export DATABASE_URL="file:${DB_FILE}"
export JWT_SECRET
export BOOTSTRAP_ADMIN_USER="$ADMIN_USER"
export BOOTSTRAP_ADMIN_PASSWORD="$ADMIN_PASSWORD"
export DATASETS_DIR="$ROOT/datasets"
export PUBLIC_DIR="$ROOT/server/public"
export COOKIE_SECURE=false
export NODE_ENV=production
export PORT

prepare() {
  echo "==> Preparing SQLite database"
  mkdir -p "$DATA_DIR"
  if [[ ! -d node_modules ]]; then
    npm install
  fi
  if [[ ! -d server/node_modules ]]; then
    npm install --prefix server
  fi
  (
    cd server
    npx prisma generate --schema "$SCHEMA"
    npx prisma db push --schema "$SCHEMA" --skip-generate
  )
}

build() {
  echo "==> Building frontend + API"
  npm run build
  rm -rf "$PUBLIC_DIR"
  mkdir -p "$PUBLIC_DIR"
  cp -R dist/. "$PUBLIC_DIR/"
  npm run build --prefix server
}

seed() {
  echo "==> Seeding admin + wordbooks"
  (
    cd server
    npx tsx src/seed.ts
  )
}

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

stop_server() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "==> Stopping server pid=$pid"
      kill "$pid" 2>/dev/null || true
      for _ in $(seq 1 20); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.2
      done
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  # Also clear anything still bound to the port.
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
}

wait_http() {
  local url="$1"
  local tries="${2:-40}"
  local i
  for i in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  echo "Timed out waiting for $url" >&2
  if [[ -f "$LOG_FILE" ]]; then
    echo "---- server log (tail) ----" >&2
    tail -n 80 "$LOG_FILE" >&2 || true
  fi
  return 1
}

expect_json() {
  local desc="$1"
  local expr="$2"
  shift 2
  local body
  body="$(curl -fsS "$@")"
  if ! echo "$body" | python3 -c "import json,sys; data=json.load(sys.stdin); assert $expr, data"; then
    echo "FAIL: $desc" >&2
    echo "$body" >&2
    exit 1
  fi
  echo "OK   $desc"
}

smoke() {
  echo "==> Smoke tests against $BASE"
  wait_http "$BASE/api/health" 40
  expect_json "health" "data.get('ok') is True" "$BASE/api/health"

  local html
  html="$(curl -fsS "$BASE/")"
  if ! echo "$html" | grep -Eq 'Josh|背单词'; then
    echo "FAIL: GET / did not return the app shell" >&2
    echo "$html" | head -n 20 >&2
    exit 1
  fi
  echo "OK   SPA shell"

  local cookie_jar
  cookie_jar="$(mktemp)"

  expect_json "admin login" "data.get('role') == 'admin'" \
    -c "$cookie_jar" -b "$cookie_jar" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASSWORD}\"}" \
    "$BASE/api/auth/login"

  expect_json "auth me" "data.get('username') == '${ADMIN_USER}'" \
    -b "$cookie_jar" "$BASE/api/auth/me"

  expect_json "wordbooks seeded" "isinstance(data, list) and len(data) >= 10" \
    -b "$cookie_jar" "$BASE/api/admin/wordbooks"

  expect_json "wordbook entries" "isinstance(data, list) and len(data) >= 1 and len(data[0].get('words') or []) > 0" \
    -b "$cookie_jar" "$BASE/api/wordbooks"

  rm -f "$cookie_jar"

  echo
  echo "Local stack is up (no Docker): $BASE"
  echo "Login: $ADMIN_USER / $ADMIN_PASSWORD"
  echo "SQLite: $DB_FILE"
  echo "Stop with: ./scripts/local-deploy.sh down"
}

start_server() {
  stop_server
  echo "==> Starting Fastify on :$PORT"
  : >"$LOG_FILE"

  # Double-fork daemon so the Node process is not tied to this shell session.
  DATABASE_URL="$DATABASE_URL" \
  JWT_SECRET="$JWT_SECRET" \
  BOOTSTRAP_ADMIN_USER="$ADMIN_USER" \
  BOOTSTRAP_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  DATASETS_DIR="$DATASETS_DIR" \
  PUBLIC_DIR="$PUBLIC_DIR" \
  COOKIE_SECURE="$COOKIE_SECURE" \
  NODE_ENV="$NODE_ENV" \
  PORT="$PORT" \
  ROOT="$ROOT" \
  LOG_FILE="$LOG_FILE" \
  PID_FILE="$PID_FILE" \
  python3 - <<'PY'
import os, sys, time

root = os.environ["ROOT"]
log_file = os.environ["LOG_FILE"]
pid_file = os.environ["PID_FILE"]
server_dir = os.path.join(root, "server")

# First fork
pid = os.fork()
if pid > 0:
    # Parent waits briefly for grandchild pid file
    for _ in range(50):
        if os.path.exists(pid_file):
            break
        time.sleep(0.05)
    sys.exit(0)

os.setsid()

# Second fork
pid = os.fork()
if pid > 0:
    with open(pid_file, "w", encoding="utf-8") as f:
        f.write(str(pid))
    sys.exit(0)

os.chdir(server_dir)
os.umask(0)

# Redirect stdio to log
log_fd = os.open(log_file, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
os.dup2(log_fd, 1)
os.dup2(log_fd, 2)
os.close(log_fd)
devnull = os.open(os.devnull, os.O_RDONLY)
os.dup2(devnull, 0)
os.close(devnull)

os.execvp("node", ["node", "dist/index.js"])
PY

  wait_http "$BASE/api/health" 40
}

up() {
  prepare
  build
  seed
  start_server
  smoke
}

down() {
  stop_server
  echo "Local stack stopped."
}

case "$CMD" in
  up|deploy|"") up ;;
  prepare) prepare ;;
  smoke) smoke ;;
  seed) prepare; seed ;;
  down|stop) down ;;
  *)
    echo "Usage: $0 [up|prepare|smoke|seed|down]" >&2
    exit 1
    ;;
esac
