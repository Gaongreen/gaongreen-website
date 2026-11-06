#!/usr/bin/env bash
# One-command LIVE isolation test against the GaonGreen Phase 3 STAGING project with the two FICTIONAL accounts.
# Usage:  bash tools/run-live-rls.sh <accountA@example.com> <accountB@example.com> [--mime] [--out-dir DIR]
# Passwords are asked for silently (not echoed, not stored, not in shell history, not on the command line) and exist only in the environment of the test process.
# Writes <out-dir>/rls-staging-result-<UTC time>.json (no passwords/tokens) and prints a summary. Share ONLY that file. Exit: 0 all passed, 1 isolation check failed, 2 refused, 3 result unwritable.
# Refuses production (the suite hard-refuses uyhmbecltrswiljbyass), non-reserved email domains, secret/service_role keys. Writes/deletes only rows and objects marked gg-rls-test owned by the two accounts.
set -uo pipefail
DEF_URL="https://gdmejzbycgpuabvutkdk.supabase.co"; DEF_KEY="sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8"   # staging URL + PUBLISHABLE key (public by design)
A="${1:-}"; B="${2:-}"; shift 2 2>/dev/null || true; MIME=no; OUTDIR="."
while [ $# -gt 0 ]; do case "$1" in --mime) MIME=yes;; --out-dir) OUTDIR="${2:-.}"; shift;; *) echo "unknown option $1" >&2; exit 2;; esac; shift; done
[ -n "$A" ] && [ -n "$B" ] || { echo "usage: bash tools/run-live-rls.sh <A@example.com> <B@example.com> [--mime] [--out-dir DIR]" >&2; exit 2; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -z "${A_PASSWORD:-}" ] || [ -z "${B_PASSWORD:-}" ]; then
  [ -r /dev/tty ] || { echo "REFUSED: no terminal to ask for passwords" >&2; exit 2; }
  read -rsp "Password for $A (hidden): " A_PASSWORD </dev/tty; echo >&2
  read -rsp "Password for $B (hidden): " B_PASSWORD </dev/tty; echo >&2
fi
# Password-policy preflight (intended free-plan policy: >= 12 chars, lower, upper, digit). Reports categories only, never the password.
pp(){ local p="$1" miss=""; [ ${#p} -ge 12 ] || miss+=" length<12"; [[ "$p" =~ [a-z] ]] || miss+=" no-lowercase"; [[ "$p" =~ [A-Z] ]] || miss+=" no-uppercase"; [[ "$p" =~ [0-9] ]] || miss+=" no-digit"; [ -z "$miss" ] && echo ok || echo "WOULD-FAIL:$miss"; }
echo "password-policy preflight (intended rule, NOT yet enabled): A=$(pp "$A_PASSWORD")  B=$(pp "$B_PASSWORD")" >&2
mkdir -p "$OUTDIR" || { echo "cannot create $OUTDIR" >&2; exit 2; }
OUT="$OUTDIR/rls-staging-result-$(date -u +%Y%m%dT%H%M%SZ).json"
ALLOW_STAGING=yes STAGING_URL="${STAGING_URL:-$DEF_URL}" STAGING_KEY="${STAGING_KEY:-$DEF_KEY}" A_EMAIL="$A" B_EMAIL="$B" A_PASSWORD="$A_PASSWORD" B_PASSWORD="$B_PASSWORD" \
  CHECK_LIMITS=yes CHECK_MIME="$MIME" OUT="$OUT" node "$HERE/tests/rls/rls-isolation.mjs" 2>&1 | sed -e "s/$(printf '%s' "$A_PASSWORD" | sed 's/[][\.*^$/]/\\&/g')/[redacted]/g" -e "s/$(printf '%s' "$B_PASSWORD" | sed 's/[][\.*^$/]/\\&/g')/[redacted]/g"
RC=${PIPESTATUS[0]}
unset A_PASSWORD B_PASSWORD
[ -f "$OUT" ] && { echo "result file: $OUT"; sha256sum "$OUT" | cut -c1-16 | sed 's/^/sha256 (prefix): /'; }
echo "exit code: $RC (0 = all passed, 1 = an isolation check FAILED, 2 = refused, 3 = result unwritable)"; exit $RC
