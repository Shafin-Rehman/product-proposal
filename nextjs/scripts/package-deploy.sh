#!/usr/bin/env bash
set -euo pipefail

zip_name="${ZIP_NAME:-deploy-$(date +%Y%m%d%H%M%S).zip}"

rm -f deploy-*.zip

zip -r "$zip_name" . \
  -x ".git/*" \
  -x "node_modules/*" \
  -x ".next/cache/*" \
  -x "coverage/*" \
  -x "e2e/*" \
  -x "__tests__/*"

echo "Created $zip_name"
