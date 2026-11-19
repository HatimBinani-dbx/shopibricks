#!/usr/bin/env bash
# Warm the showcase deployment 15 minutes before the talk. See scripts/warmup_showcase.py.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f scripts/showcase.local.env ] && . scripts/showcase.local.env
export PROFILE APP
exec python3 -I scripts/warmup_showcase.py "$@"
