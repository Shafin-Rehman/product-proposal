#!/usr/bin/env bash

set -euo pipefail

deploy_url="${1:-}"

if [ -z "$deploy_url" ]; then
  echo "Usage: $0 <deploy-url>"
  exit 1
fi

for i in 1 2 3; do
  if curl --fail --silent --show-error --max-time 30 "${deploy_url}/" > /dev/null && \
     curl --fail --silent --show-error --max-time 30 "${deploy_url}/api/health" > /dev/null; then
    exit 0
  fi

  sleep 5
done

echo "Smoke check failed for ${deploy_url}"
exit 1
