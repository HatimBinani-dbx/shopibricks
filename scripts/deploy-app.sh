#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npm --prefix app run build
databricks sync app /Workspace/Users/laurent.fabre@databricks.com/shopibricks-app \
  --include 'dist/**' \
  --exclude 'node_modules/**' --exclude '.venv/**' --exclude '.env*' \
  --exclude 'tests/**' --exclude '**/__pycache__/**' --exclude '*.log' --profile fevm
databricks apps deploy shopibricks-paris \
  --source-code-path /Workspace/Users/laurent.fabre@databricks.com/shopibricks-app \
  --mode SNAPSHOT --no-wait --profile fevm -o json
