#!/usr/bin/env bash
set -euo pipefail

cache_hit="${1:-}"

if [ "$cache_hit" = "true" ]; then
  npx playwright install-deps chromium
else
  npx playwright install chromium --with-deps
fi
