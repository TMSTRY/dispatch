#!/usr/bin/env bash
set -e
# Resolve absolute path to this script's directory (repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"
echo "Working directory: $(pwd)"
echo "Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
