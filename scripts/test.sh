#!/bin/bash
# Start the Vite dev server for the vocabulary learning app.
# Usage: ./scripts/test.sh [port]

PORT="${1:-5173}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting Vite dev server at http://localhost:$PORT"
cd "$DIR" && npx vite --port "$PORT" --host
