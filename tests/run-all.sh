#!/usr/bin/env bash
# Rebuild the offline demo, then run every demo test. Usage: bash tests/run-all.sh <evidence-dir>
# QR core dir: set QRCORE_DIR to a folder with Arase QRCode *.js (e.g. qrcode-terminal 0.12.0 vendor/QRCode).
# Needs: node, playwright (with chromium), python3 with opencv (cv2) for QR decoding. Needs NO network.
set -u; OUT=${1:?evidence dir}; mkdir -p "$OUT"; rc=0
QR=${QRCORE_DIR:-/opt/node22/lib/node_modules/npm/node_modules/qrcode-terminal/vendor/QRCode}
node tools/build-qr-shim.js "$QR" demo/vendor/qrcode-shim.js >"$OUT/build.txt" || rc=1
node tools/build-demo.js >>"$OUT/build.txt" || rc=1
for t in demo-smoke func-calcs func-tools func-kissb func-auth-settings func-kissb-reports func-roundtrips func-epr-boundaries pinned-build rls-harness rls-guards url-guard qr-decoder-diagnostics func-nav func-faults check-headers func-evidence-mime vendor-publish func-l10n live-rls-wrapper staging-draft-deploy real-sdk-smoke validate-all-orchestration func-account-isolation; do node tests/$t.js "$OUT/$t.json" >"$OUT/$t.txt" 2>&1 || rc=1; done
git rev-parse HEAD >"$OUT/commit.txt" 2>/dev/null; cat "$OUT"/*.txt | grep -cE '^PASS' | sed 's/^/PASS lines: /'; cat "$OUT"/*.txt | grep -cE '^(FAIL|ERR)' | sed 's/^/FAIL+ERR lines: /'; exit $rc
