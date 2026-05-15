#!/usr/bin/env bash

set -euo pipefail

smoke_test_url="${1:-}"

if [ -z "$smoke_test_url" ]; then
  echo "Usage: $0 <smoke-test-url>"
  exit 1
fi

for i in 1 2 3; do
  if curl --fail --silent --show-error --max-time 30 "${smoke_test_url}" > /dev/null; then
    exit 0
  fi

  sleep 5
done

echo "Smoke check failed for ${smoke_test_url}"
exit 1
