#!/usr/bin/env bash
# ONE procedure for everything that needs your Codespace/accounts. Staging only. Never --prod, never main, no Auth/SQL/policy changes.
# Usage: bash tools/staging-validate-all.sh <fictionalA@example.com> <fictionalB@example.com> [--keep-file validate-backup-only.html] [--no-deploy]
# Steps: (1) offline suite  (2) build staging pack from vendor/ (real SDK)  (3) deploy guard dry-run  (4) live RLS+storage+MIME test (asks 2 passwords silently)  (5) DRAFT deploy (live site untouched)  (6) bundle result files into one folder to send back.
set -uo pipefail
cd "$(dirname "$0")/.."
A="${1:-}"; B="${2:-}"; shift 2 2>/dev/null || { echo "usage: $0 <A@example.com> <B@example.com> [--keep-file F] [--no-deploy]" >&2; exit 2; }
KEEP=""; DEPLOY=1
while [ $# -gt 0 ]; do case "$1" in --keep-file) KEEP="$2"; shift;; --no-deploy) DEPLOY=0;; *) echo "unknown $1" >&2; exit 2;; esac; shift; done
URL="https://gdmejzbycgpuabvutkdk.supabase.co"; KEY="sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8"
TS=$(date -u +%Y%m%dT%H%M%SZ); OUT="staging-validation-$TS"; mkdir -p "$OUT"; FAIL=0
step(){ echo; echo "== $*"; }
step "1/5 offline suite"; bash tests/run-all.sh "$OUT/offline" >"$OUT/offline.log" 2>&1; tail -2 "$OUT/offline.log"; grep -q "FAIL+ERR lines: 0" "$OUT/offline.log" || { echo "offline suite failed; stopping"; exit 1; }
step "2/5 build staging pack (real SDK, staging target)"
node tools/build-pinned.js --vendor vendor --target-url "$URL" --target-key "$KEY" --qr demo/vendor/qrcode-shim.js --out dist-pinned >"$OUT/build.log" 2>&1 || { tail -5 "$OUT/build.log"; exit 1; }; tail -1 "$OUT/build.log"
step "3/5 deploy guard (checks only)"; if [ -n "$KEEP" ]; then bash tools/staging-draft-deploy.sh --keep-file "$KEEP"; else bash tools/staging-draft-deploy.sh; fi || { echo "guard refused; stopping"; exit 1; }
step "4/5 live RLS / storage / MIME test (passwords typed silently)"
bash tools/run-live-rls.sh "$A" "$B" --mime --out-dir "$OUT" 2>&1 | tee "$OUT/live-rls.log" | tail -25; [ "${PIPESTATUS[0]}" -eq 0 ] || { FAIL=1; echo "live RLS reported a problem — NOT deploying; send $OUT back"; DEPLOY=0; }
if [ "$DEPLOY" = 1 ]; then step "5/5 DRAFT deploy"; if [ -n "$KEEP" ]; then bash tools/staging-draft-deploy.sh --keep-file "$KEEP" --deploy; else bash tools/staging-draft-deploy.sh --deploy; fi 2>&1 | tee "$OUT/deploy.log"; else step "5/5 draft deploy skipped"; fi
grep -rIlE 'sb_secret_|eyJ[A-Za-z0-9_-]{20,}\.' "$OUT" >/dev/null 2>&1 && echo "WARNING: possible secret in $OUT — review before sending" || echo "no secret patterns in $OUT"
tar czf "$OUT.tgz" "$OUT" && echo "SEND BACK: $OUT.tgz (sha256 $(sha256sum "$OUT.tgz" | cut -c1-16)…)"; exit $FAIL
