#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?}" "${PREVIEW_BRANCH_NAME:?}" "${PREVIEW_PROJECT_REF:?}"

supabase branches delete "$PREVIEW_BRANCH_NAME" \
  --project-ref "$PREVIEW_PROJECT_REF" --experimental --yes
