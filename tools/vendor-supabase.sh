#!/usr/bin/env bash
# Run ONCE in an environment with npm access (e.g. a free GitHub Codespace). Needs no secrets. Changes only package-lock.json, node_modules/ (ignored) and vendor/.
set -euo pipefail; cd "$(dirname "$0")/.."
PIN=$(node -p "require('./package.json').dependencies['@supabase/supabase-js']")
echo "== pinned version: $PIN"
echo "== registry facts (read-only)"; npm view "@supabase/supabase-js@$PIN" version deprecated dist.integrity dist.tarball time --json 2>/dev/null | head -40 || true
[ -f package-lock.json ] || npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
echo "== registry signature + provenance attestation check"; npm audit signatures
echo "== advisories"; npm audit --omit=dev --audit-level=high || { echo "ADVISORIES AT/ABOVE HIGH: review before adopting"; exit 2; }
node tools/vendor-copy.js
echo "== done. Commit package-lock.json and vendor/. Then: node tools/build-pinned.js"
