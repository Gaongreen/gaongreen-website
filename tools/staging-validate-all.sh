#!/usr/bin/env bash
# ONE procedure for everything that needs your Codespace/accounts. STAGING only: never --prod, never main, no Auth/SQL/policy changes.
# Usage: bash tools/staging-validate-all.sh <fictionalA@example.com> <fictionalB@example.com> [--keep-file validate-backup-only.html] [--no-deploy] [--with-offline]
# Steps: precheck -> (optional offline suite) -> build -> deploy guard (dry) -> live RLS/storage/MIME -> DRAFT deploy (only if every earlier required step passed) -> allow-listed shareable summary.
# Exit 0 only if every required step passed. All working files live in a private temp dir (outside the repo, mode 700); only share.txt is meant to be shared.
set -uo pipefail
umask 077
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$REPO" || exit 2
URL="https://gdmejzbycgpuabvutkdk.supabase.co"; KEY="sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8"   # staging URL + PUBLISHABLE key (public by design)
A=""; B=""; if [ $# -ge 2 ] && [[ "$1" != --* ]]; then A="$1"; B="$2"; shift 2; fi
KEEP=""; DEPLOY=1; OFFLINE=0; CIPROOF=0
while [ $# -gt 0 ]; do case "$1" in --keep-file) KEEP="${2:-}"; shift;; --no-deploy) DEPLOY=0;; --with-offline) OFFLINE=1;; --use-ci-proof) CIPROOF=1;; *) echo "unknown option $1" >&2; exit 2;; esac; shift; done
[ "$CIPROOF" = 1 ] || { [ -n "$A" ] && [ -n "$B" ] || { echo "usage: $0 <A@example.com> <B@example.com> [--keep-file F] [--no-deploy] [--with-offline]   |   $0 --use-ci-proof [--keep-file F] [--no-deploy]" >&2; exit 2; }; }
# Test hooks (simulated-failure tests only). Ignored unless GG_TEST_MODE=1; announced loudly when active.
BUILD=(node tools/build-pinned.js --vendor vendor --target-url "$URL" --target-key "$KEY" --qr demo/vendor/qrcode-shim.js --out)   # + <dist>
GUARD=(bash tools/staging-draft-deploy.sh); RLS=(bash tools/run-live-rls.sh); CIP=(bash tools/check-ci-proof.sh); NEED_NETLIFY=1
if [ "${GG_TEST_MODE:-}" = 1 ]; then echo "*** TEST MODE: tool overrides active — not a real validation ***" >&2
  [ -n "${GG_BUILD_SH:-}" ] && BUILD=(bash "$GG_BUILD_SH"); [ -n "${GG_GUARD_SH:-}" ] && GUARD=(bash "$GG_GUARD_SH"); [ -n "${GG_RLS_SH:-}" ] && RLS=(bash "$GG_RLS_SH"); [ -n "${GG_CIPROOF_SH:-}" ] && CIP=(bash "$GG_CIPROOF_SH"); NEED_NETLIFY=0; fi
WORK="$(mktemp -d "${TMPDIR:-/tmp}/gg-staging-validation.XXXXXX")" || { echo "cannot create a temp dir" >&2; exit 2; }; chmod 700 "$WORK"; mkdir "$WORK/private"
STATE="$WORK/state.txt"; : >"$STATE"; DIST="$WORK/dist-pinned"; FAILED=()
set_state(){ printf '%s=%s\n' "$1" "$2" >>"$STATE"; }
fail(){ FAILED+=("$1"); set_state "$1" "FAIL ($2)"; echo "!! $1 FAILED: $2" >&2; }
ok(){ set_state "$1" "${2:-ok}"; echo "ok $1${2:+ ($2)}"; }
set_state COMMIT "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"; set_state TREE_DIRTY "$([ -n "$(git status --porcelain 2>/dev/null)" ] && echo yes || echo no)"
finish(){  # builds the allow-listed share file, decides the overall result, exits
  local res="PASS"; [ ${#FAILED[@]} -gt 0 ] && res="FAIL (${FAILED[*]})"; [ ${#FAILED[@]} -eq 0 ] && [ "$DEPLOY" = 0 ] && res="PASS-NO-DEPLOY (draft deploy not requested)"
  set_state RESULT "$res"
  local args=(--state "$STATE" --out "$WORK/share.txt"); [ -f "$DIST/RELEASE_MANIFEST.json" ] && args+=(--manifest "$DIST/RELEASE_MANIFEST.json")
  local r; r=$(ls "$WORK/private"/rls-staging-result-*.json 2>/dev/null | head -1); [ -n "$r" ] && args+=(--rls "$r"); [ -f "$WORK/private/deploy.txt" ] && args+=(--deploy "$WORK/private/deploy.txt")
  echo; echo "================ SUMMARY ================"
  GG_SCAN_SECRETS="$(node -e 'console.log(JSON.stringify([process.env.PA||"",process.env.PB||""]))' 2>/dev/null)" node tools/summarize-validation.js "${args[@]}"; local sc=$?
  echo "========================================="
  if [ $sc -eq 0 ]; then echo "Share ONLY the text above (also saved at $WORK/share.txt). Read it first; it contains no raw logs. Raw files stay in $WORK/private (do not share)."
  else echo "The shareable file was WITHHELD by the leak detector. Do not share anything from $WORK; tell Claude the RESULT line above only."; fi
  if [ $sc -ne 0 ]; then set_state RESULT "NOT CLEAN"; echo "RESULT: NOT CLEAN (the shareable summary was WITHHELD by the leak detector; nothing may be shared; underlying check status: $res)"; exit 1; fi
  echo "RESULT: $res"; [ ${#FAILED[@]} -eq 0 ] && exit 0 || exit 1
}
echo "working directory for this run (outside the repo): $WORK"
# ---- precheck: everything required must exist BEFORE asking for passwords
MISS=(); for f in vendor/supabase.umd.js vendor/MANIFEST.json tools/build-pinned.js tools/staging-draft-deploy.sh tools/run-live-rls.sh tools/check-ci-proof.sh tools/summarize-validation.js tests/rls/rls-isolation.mjs demo/vendor/qrcode-shim.js; do [ -f "$f" ] || MISS+=("$f"); done
command -v node >/dev/null 2>&1 || MISS+=("node"); [ "$DEPLOY" = 1 ] && [ "$NEED_NETLIFY" = 1 ] && ! command -v "${NETLIFY_BIN:-netlify}" >/dev/null 2>&1 && MISS+=("netlify CLI (npm i -g netlify-cli; netlify login) — or rerun with --no-deploy")
[ -n "$KEEP" ] && [ ! -f "$KEEP" ] && MISS+=("--keep-file $KEEP")
if [ ${#MISS[@]} -gt 0 ]; then fail PRECHECK "missing: ${MISS[*]}"; finish; fi; ok PRECHECK
# ---- offline suite (optional: already passed in the build environment; needs playwright/opencv)
if [ "$OFFLINE" = 1 ]; then bash tests/run-all.sh "$WORK/private/offline" >"$WORK/private/offline.log" 2>&1; if grep -q "FAIL+ERR lines: 0" "$WORK/private/offline.log"; then ok OFFLINE "$(grep 'PASS lines' "$WORK/private/offline.log")"; else fail OFFLINE "offline suite reported failures"; finish; fi; else set_state OFFLINE "skipped (already passed in build environment)"; fi
# ---- build (into the temp dir, not the repo)
if "${BUILD[@]}" "$DIST" >"$WORK/private/build.log" 2>&1 && [ -f "$DIST/RELEASE_MANIFEST.json" ]; then ok BUILD "$(tail -1 "$WORK/private/build.log" | cut -c1-80)"; else fail BUILD "build failed or produced no RELEASE_MANIFEST (see $WORK/private/build.log)"; finish; fi
# ---- guard (checks only)
GARGS=(--dist "$DIST"); [ -n "$KEEP" ] && GARGS+=(--keep-file "$KEEP")
if "${GUARD[@]}" "${GARGS[@]}" >"$WORK/private/guard.log" 2>&1; then ok GUARD; else fail GUARD "deploy guard refused: $(tail -1 "$WORK/private/guard.log" | cut -c1-140)"; finish; fi
# ---- live RLS / storage / MIME: either typed passwords (direct) or a verified passing CI run for this exact commit (--use-ci-proof, no passwords)
if [ "$CIPROOF" = 1 ]; then
  if "${CIP[@]}" >"$WORK/private/ciproof.log" 2>&1; then ok RLS "verified in CI: $(grep -oE 'run [0-9]+ for commit [0-9a-f]{8}' "$WORK/private/ciproof.log" | head -1)"; else fail RLS "CI proof missing: $(tail -1 "$WORK/private/ciproof.log" | cut -c1-200) — deployment will NOT run"; DEPLOY=skipped; fi
else
[ -r /dev/tty ] || [ -n "${A_PASSWORD:-}" ] || { fail RLS "no terminal to ask for passwords"; finish; }
if [ -z "${A_PASSWORD:-}" ] || [ -z "${B_PASSWORD:-}" ]; then read -rsp "Password for $A (hidden): " A_PASSWORD </dev/tty; echo >&2; read -rsp "Password for $B (hidden): " B_PASSWORD </dev/tty; echo >&2; fi
export PA="$A_PASSWORD" PB="$B_PASSWORD"
A_PASSWORD="$A_PASSWORD" B_PASSWORD="$B_PASSWORD" "${RLS[@]}" "$A" "$B" --mime --out-dir "$WORK/private" >"$WORK/private/rls.log" 2>&1; RC=$?
tail -12 "$WORK/private/rls.log" | grep -E "^(PASS|FAIL)|passed against|password-policy|exit code" | sed -e "s/$(printf '%s' "$A_PASSWORD" | sed 's/[][\.*^$/]/\\&/g')/[redacted]/g" -e "s/$(printf '%s' "$B_PASSWORD" | sed 's/[][\.*^$/]/\\&/g')/[redacted]/g" | cut -c1-200
if [ $RC -eq 0 ] && ls "$WORK/private"/rls-staging-result-*.json >/dev/null 2>&1; then ok RLS "all checks passed"; else HINT=""; grep -q "sign-in failed" "$WORK/private/rls.log" && HINT="; sign-in rejected: HTTP 400 invalid_credentials means the email or password typed was wrong (account existence/confirmation is checked separately) — retype carefully, nothing was changed"
  fail RLS "live test did not pass cleanly (exit $RC)$HINT — deployment will NOT run"; DEPLOY=skipped; fi
fi
# ---- draft deploy: only when every required step so far passed
if [ ${#FAILED[@]} -eq 0 ] && [ "$DEPLOY" = 1 ]; then
  if "${GUARD[@]}" "${GARGS[@]}" --deploy >"$WORK/private/deploy.txt" 2>&1; then ok DEPLOY "$(grep -E 'DRAFT deploy URL|verified' "$WORK/private/deploy.txt" | tr '\n' ' ' | cut -c1-200)"; else fail DEPLOY "DEPLOYMENT FAILED: $(grep -E 'DEPLOYMENT FAILED|REFUSED' "$WORK/private/deploy.txt" | head -1 | cut -c1-160)"; fi
elif [ "$DEPLOY" = skipped ]; then set_state DEPLOY "NOT RUN (live RLS/storage test failed)"; DEPLOY=1
elif [ "$DEPLOY" = 0 ]; then set_state DEPLOY "not requested (--no-deploy)"; fi
unset A_PASSWORD B_PASSWORD
finish
