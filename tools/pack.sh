#!/usr/bin/env bash
# Builds the ZIP for the Chrome Web Store: only the files the extension needs.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p "require('./manifest.json').version")
out="dist/web-test-bench-$version.zip"
mkdir -p dist
rm -f "$out"
zip -q -r -X "$out" manifest.json background.js dashboard.html dashboard.css dashboard.js content icons _locales
echo "$out"
unzip -l "$out" | tail -n +4 | head -n -2
