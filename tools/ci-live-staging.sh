#!/usr/bin/env bash
# CI wrapper (GitHub Actions or local): live auth / RLS / storage / MIME / size-limit / tampered-JWT tests against the Phase 3 STAGING project with the two FICTIONAL accounts.
# Passwords come ONLY from the environment (A_PASSWORD, B_PASSWORD — in CI: GitHub Actions Secrets). Raw test output stays in a private temp dir and is NEVER printed;
# only an allow-listed, scrubbed summary is printed (and appended to $GITHUB_STEP_SUMMARY). Exit 0 = every check passed; 1 = a check failed / result unreadable; 2 = refused (missing secrets).
# Refusals (production host, secret keys, non-reserved e-mail domains) are inherited from tools/run-live-rls.sh and tests/rls/rls-isolation.mjs.
set -uo pipefail
umask 077
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$REPO" || exit 2
A="${A_EMAIL:-customer-a@example.test}"; B="${B_EMAIL:-customer-b@example.test}"
if [ -z "${A_PASSWORD:-}" ] || [ -z "${B_PASSWORD:-}" ]; then
  echo "REFUSED: the staging passwords are not available to this run."
  echo "Create the environment secrets STAGING_CUSTOMER_A_PASSWORD and STAGING_CUSTOMER_B_PASSWORD (see docs/CI_LIVE_STAGING.md). Nothing was contacted."; exit 2; fi
WORK="$(mktemp -d "${TMPDIR:-/tmp}/gg-ci-live.XXXXXX")" || exit 2; chmod 700 "$WORK"; trap 'rm -rf "$WORK"' EXIT
export A_PASSWORD B_PASSWORD
bash tools/run-live-rls.sh "$A" "$B" --mime --out-dir "$WORK" >"$WORK/raw.log" 2>&1; RC=$?
RES="$(ls "$WORK"/rls-staging-result-*.json 2>/dev/null | head -1)"
if [ $RC -eq 0 ] && [ -n "$RES" ]; then R="PASS"; else
  R="FAIL (exit $RC)"; grep -q "sign-in failed" "$WORK/raw.log" && R="FAIL (sign-in rejected: the two password secrets do not match the staging accounts)"
  grep -q "REFUSED" "$WORK/raw.log" && ! grep -q "sign-in failed" "$WORK/raw.log" && R="FAIL (refused by a safety guard)"; fi
{ echo "RESULT=$R"; echo "COMMIT=$(printf '%s' "${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}" | cut -c1-8)"; echo "RLS=$R"; } >"$WORK/state.txt"
ARGS=(--state "$WORK/state.txt" --out "$WORK/share.txt"); [ -n "$RES" ] && ARGS+=(--rls "$RES")
GG_SCAN_SECRETS="$(node -e 'console.log(JSON.stringify([process.env.A_PASSWORD||"",process.env.B_PASSWORD||""]))')" node tools/summarize-validation.js "${ARGS[@]}" >"$WORK/summary.out" 2>"$WORK/summary.err"; SC=$?
if [ $SC -eq 0 ]; then cat "$WORK/summary.out"; [ -n "${GITHUB_STEP_SUMMARY:-}" ] && { echo '```'; cat "$WORK/summary.out"; echo '```'; } >>"$GITHUB_STEP_SUMMARY"
else echo "RESULT: $R; summary withheld by the leak detector (raw output discarded)"; [ $RC -eq 0 ] && RC=1; fi
[ $RC -eq 0 ] && exit 0 || exit 1
