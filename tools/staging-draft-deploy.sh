#!/usr/bin/env bash
# Prepares (default) or performs (--deploy) a Netlify DRAFT deploy of dist-pinned/ to the existing site. A draft deploy gets its own unique URL; it does NOT replace what the site serves.
# Usage:  bash tools/staging-draft-deploy.sh [--dist dist-pinned] [--keep-file path/to/validate-backup-only.html] [--site-id ID] [--deploy]
# Default = checks only (no Netlify call). Refuses unless: the build targets the STAGING Supabase project, is built from a REAL (non-fixture) SDK, contains no production ref, no secret keys, and ships _headers.
# Never passes --prod. Requires the Netlify CLI logged in as you (NETLIFY_BIN overrides the binary, used by the offline tests). The site requires team SSO, so the draft is not public.
set -uo pipefail
STAGING_HOST="https://gdmejzbycgpuabvutkdk.supabase.co"; PROD_REF="uyhmbecltrswiljbyass"; SITE="48c18d02-eb99-46b4-a68d-96f724940fd9"; DIST="dist-pinned"; KEEP=""; DEPLOY=0
while [ $# -gt 0 ]; do case "$1" in --dist) DIST="$2"; shift;; --keep-file) KEEP="$2"; shift;; --site-id) SITE="$2"; shift;; --deploy) DEPLOY=1;; --prod|--prod-if-unlocked|--alias) echo "REFUSED: $1 is not allowed here (draft deploys only)" >&2; exit 2;; *) echo "unknown option $1" >&2; exit 2;; esac; shift; done
die(){ echo "REFUSED: $*" >&2; exit 2; }
[ -d "$DIST" ] || die "$DIST not found (build it first: node tools/build-pinned.js --target-url $STAGING_HOST --target-key <publishable key> --qr demo/vendor/qrcode-shim.js --out $DIST)"
[ -f "$DIST/RELEASE_MANIFEST.json" ] || die "$DIST/RELEASE_MANIFEST.json missing (not a pinned build)"
[ -f "$DIST/_headers" ] || die "$DIST/_headers missing"
[ ! -e "$DIST/FIXTURE_NOT_REAL_SDK.txt" ] || die "this build used the TEST FIXTURE, not the real SDK"
node - "$DIST/RELEASE_MANIFEST.json" "$STAGING_HOST" <<'JS' || exit 2
const m=JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));const f=x=>{console.error('REFUSED: '+x);process.exit(2)};
if(!m.sdk||m.sdk.fixture)f('manifest says the SDK is a fixture or missing');if(!m.target||m.target.host!==process.argv[3])f('build target is '+(m.target&&m.target.host)+', expected '+process.argv[3]+' (was it built with --target-url?)');
JS
if grep -rIl --exclude-dir=node_modules "$PROD_REF" "$DIST" >/dev/null 2>&1; then die "the production project ref appears in $DIST (files: $(grep -rIl "$PROD_REF" "$DIST" | head -3 | tr '\n' ' '))"; fi
if grep -rIlE 'sb_secret_[A-Za-z0-9_-]{16,}' "$DIST" >/dev/null 2>&1; then die "a secret-key pattern appears in $DIST"; fi
if [ -n "$KEEP" ]; then [ -f "$KEEP" ] || die "--keep-file not found: $KEEP"; fi
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; cp -a "$DIST/." "$T/"; [ -n "$KEEP" ] && cp "$KEEP" "$T/$(basename "$KEEP")"
N=$(find "$T" -type f | wc -l); echo "checks passed: staging-targeted real-SDK build, $N files$( [ -n "$KEEP" ] && echo ", incl. preserved $(basename "$KEEP")" ), no production ref, no secrets, _headers present"
if [ "$DEPLOY" != 1 ]; then echo "dry run: nothing deployed. Re-run with --deploy to create a DRAFT deploy on site $SITE (the live site is not replaced)."; exit 0; fi
NB="${NETLIFY_BIN:-netlify}"; command -v "$NB" >/dev/null 2>&1 || die "Netlify CLI not found (npm i -g netlify-cli, then netlify login)"
OUT=$("$NB" deploy --dir "$T" --site "$SITE" --message "staging draft $(date -u +%Y-%m-%dT%H:%MZ)" --json 2>&1); RC=$?; echo "$OUT" | sed -E 's/(token|Authorization)[^ ]*/\1=[redacted]/Ig' | tail -15
[ $RC -eq 0 ] || { echo "Netlify CLI failed (exit $RC); nothing is known to have been published" >&2; exit 3; }
URL=$(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s.slice(s.indexOf("{")));console.log(j.deploy_url||"")}catch(e){console.log("")}})')
case "$URL" in https://*--*.netlify.app) echo "DRAFT deploy URL: $URL (SSO-protected; the live site is unchanged)";; *) echo "WARNING: could not confirm a draft URL (got '$URL'). Check the Netlify dashboard: the live site may have changed." >&2; exit 4;; esac
