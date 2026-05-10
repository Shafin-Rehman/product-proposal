#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_URL:?}" "${GITHUB_ENV:?}" "${GITHUB_OUTPUT:?}"

github_env_kv() {
  local n=$1 v=$2 d=_e_${1}_
  {
    echo "${n}<<${d}"
    printf '%s\n' "$v"
    echo "${d}"
  } >>"$GITHUB_ENV"
}

ref="$(sed -E 's#https?://([^.]+)\..*#\1#' <<<"$SUPABASE_URL")"
rid=${GITHUB_RUN_ID:-0}
att=${GITHUB_RUN_ATTEMPT:-0}
suf=${GITHUB_SHA:+${GITHUB_SHA:0:7}}
suf=${suf:-$(date +%s)-$RANDOM}
name=budgetbuddy-ci-${rid}-${att}-${suf}

supabase branches create "$name" --project-ref "$ref" --experimental --yes >/dev/null
json=$(supabase branches get "$name" --project-ref "$ref" --experimental -o json)

db=$(jq -r '.POSTGRES_URL' <<<"$json")
url=$(jq -r '.SUPABASE_URL' <<<"$json")
anon=$(jq -r '.SUPABASE_ANON_KEY' <<<"$json")
sr=$(jq -r '.SUPABASE_SERVICE_ROLE_KEY' <<<"$json")

srfile=$(mktemp "${RUNNER_TEMP:-/tmp}/preview-sr-XXXXXXXXXX")
printf '%s' "$sr" >"$srfile"
chmod 600 "$srfile"

github_env_kv PREVIEW_DB_URL "$db"
github_env_kv PREVIEW_SUPABASE_URL "$url"
github_env_kv PREVIEW_SUPABASE_ANON_KEY "$anon"

{
  echo "branch_name=$name"
  echo "project_ref=$ref"
  echo "service_role_file=$srfile"
} >>"$GITHUB_OUTPUT"
