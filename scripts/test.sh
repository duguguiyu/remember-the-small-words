#!/bin/bash
# Start a local HTTP server to test the vocabulary learning app.
# Usage: ./scripts/test.sh [port]

PORT="${1:-8080}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "========================================"
echo "  记单词小助手 — 本地测试服务器"
echo "========================================"
echo ""
echo "  地址: http://localhost:${PORT}"
echo "  目录: ${DIR}"
echo ""
echo "  按 Ctrl+C 停止服务器"
echo "========================================"
echo ""

cd "$DIR" && python3 -m http.server "$PORT"
