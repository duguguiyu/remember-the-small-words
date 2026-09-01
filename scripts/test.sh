#!/usr/bin/env bash
set -euo pipefail

# Local development without Docker (SQLite + Vite + API).
# Usage: ./scripts/test.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export DATABASE_URL="${DATABASE_URL:-file:$ROOT/server/data/local.db}"
export JWT_SECRET="${JWT_SECRET:-dev-secret-change-me}"
export BOOTSTRAP_ADMIN_USER="${BOOTSTRAP_ADMIN_USER:-admin}"
export BOOTSTRAP_ADMIN_PASSWORD="${BOOTSTRAP_ADMIN_PASSWORD:-changeme}"
export DATASETS_DIR="${DATASETS_DIR:-$ROOT/datasets}"
export COOKIE_SECURE=false

mkdir -p "$ROOT/server/data"

if [[ ! -d node_modules ]]; then
  npm install
fi
if [[ ! -d server/node_modules ]]; then
  npm install --prefix server
fi

# Ensure .env exists for subsequent runs.
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
if [[ ! -f server/.env ]]; then
  cp .env.example server/.env
fi

# Force local sqlite URLs into env files if they still point at docker postgres.
if grep -q 'postgresql://' .env 2>/dev/null; then
  echo "Note: switching .env DATABASE_URL to local SQLite"
  python3 - <<'PY'
from pathlib import Path
root = Path(".")
db = (root / "server/data/local.db").resolve().as_posix()
for rel in [".env", "server/.env"]:
    path = root / rel
    if not path.exists():
        continue
    lines = []
    for line in path.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            lines.append(f"DATABASE_URL=file:{db}")
        else:
            lines.append(line)
    path.write_text("\n".join(lines) + "\n")
PY
fi

export DATABASE_URL="file:$ROOT/server/data/local.db"

(
  cd server
  npx prisma generate --schema prisma/schema.local.prisma
  npx prisma db push --schema prisma/schema.local.prisma --skip-generate
  npx tsx src/seed.ts
)

echo "Starting Vite + API (SQLite). Open http://localhost:5173"
echo "Admin: ${BOOTSTRAP_ADMIN_USER} / ${BOOTSTRAP_ADMIN_PASSWORD}"
npm run dev
