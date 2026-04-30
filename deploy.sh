#!/bin/bash
set -e

VERSION=${1:-$(git rev-parse --short HEAD)}

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version-or-sha>"
  exit 1
fi

zip -r "budgetbuddy_deploy-${VERSION}.zip" \
  .next \
  package.json \
  package-lock.json \
  next.config.js

echo "Created budgetbuddy_deploy-${VERSION}.zip"
