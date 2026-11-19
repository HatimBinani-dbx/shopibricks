#!/usr/bin/env bash
# Provision the analytics assets (pipeline, jobs, dashboard, metric view, Vector Search, Genie) in the showcase workspace.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f scripts/showcase.local.env ] && . scripts/showcase.local.env
export PROFILE APP CATALOG SCHEMA
exec python3 -I scripts/provision_showcase.py "$@"
