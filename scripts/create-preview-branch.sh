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

create_log=$(mktemp "${RUNNER_TEMP:-/tmp}/preview-create-XXXXXXXXXX")
get_log=$(mktemp "${RUNNER_TEMP:-/tmp}/preview-get-XXXXXXXXXX")

if ! supabase branches create "$name" --project-ref "$ref" --experimental --yes >"$create_log" 2>&1; then
  if grep -qi 'Preview branch not found\|unexpected find branch status 404' "$create_log"; then
    echo "Preview branch create reported a transient 404; polling for branch details." >&2
  else
    cat "$create_log" >&2
    exit 1
  fi
fi

json=''
for attempt in {1..30}; do
  if json=$(supabase branches get "$name" --project-ref "$ref" --experimental -o json 2>"$get_log"); then
    if jq -e '.POSTGRES_URL and .SUPABASE_URL and .SUPABASE_ANON_KEY and .SUPABASE_SERVICE_ROLE_KEY' <<<"$json" >/dev/null; then
      break
    fi
  elif ! grep -qi 'Preview branch not found\|unexpected find branch status 404' "$get_log"; then
    cat "$get_log" >&2
    exit 1
  fi

  if [[ $attempt -eq 30 ]]; then
    cat "$get_log" >&2
    echo "Timed out waiting for preview branch details: $name" >&2
    exit 1
  fi

  sleep 3
done

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
