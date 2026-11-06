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
# Safety: remember which deploy the live site currently serves; a draft deploy must leave it unchanged. If it cannot be read, refuse (non-replacement could not be verified).
pub(){ "$NB" api getSite --data "{\"site_id\":\"$SITE\"}" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s.slice(s.indexOf("{")));const id=j.published_deploy&&j.published_deploy.id;console.log(/^[0-9a-f]{24}$/.test(id||"")?id:"")}catch(e){console.log("")}})'; }
PRE=$(pub); [ -n "$PRE" ] || die "cannot read the site's currently published deploy id (CLI not logged in or wrong site?); refusing to deploy because non-replacement cannot be verified"
echo "live site currently serves deploy $PRE (must stay unchanged)"
OUT=$("$NB" deploy --dir "$T" --site "$SITE" --message "staging draft $(date -u +%Y-%m-%dT%H:%MZ)" --json 2>&1); RC=$?; echo "$OUT" | sed -E 's/(token|Authorization)[^ ]*/\1=[redacted]/Ig' | tail -15
if [ $RC -ne 0 ]; then echo "DEPLOYMENT FAILED: Netlify CLI exit $RC; the live site was not intentionally changed (checking...)" >&2; POST=$(pub); [ -n "$POST" ] && [ "$POST" != "$PRE" ] && echo "WARNING: published deploy changed $PRE -> $POST. Roll back: Netlify > Deploys > Publish deploy $PRE" >&2; exit 3; fi
# Parse id + URL from the CLI JSON; print the id so it can be compared with the Netlify dashboard (a mistyped/truncated id gives "Site not found").
PARSED=$(printf '%s' "$OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s.slice(s.indexOf("{")));console.log((j.deploy_id||"")+" "+(j.deploy_ssl_url||j.deploy_url||""))}catch(e){console.log(" ")}})')
DID="${PARSED%% *}"; URL="${PARSED#* }"
POST=$(pub)
if [ "$POST" != "$PRE" ]; then echo "DEPLOYMENT FAILED SAFETY CHECK: the live site's published deploy changed ($PRE -> '${POST:-unreadable}'). Roll back: Netlify > Deploys > Publish deploy $PRE" >&2; exit 5; fi
if ! printf '%s' "$DID" | grep -Eq '^[0-9a-f]{24}$'; then echo "DEPLOYMENT FAILED: the CLI did not return a valid 24-hex deploy id (got '$DID'). Check the Netlify dashboard > Deploys." >&2; exit 4; fi
case "$URL" in https://"$DID"--*.netlify.app) echo "verified: live site still serves $PRE"; echo "DRAFT deploy id: $DID"; echo "DRAFT deploy URL: $URL (team-login protected; the live site is unchanged)"; echo "if the URL shows 'Site not found', compare the id above with Netlify > Deploys (ids are exactly 24 hex characters)";; *) echo "DEPLOYMENT FAILED: could not confirm a draft URL that starts with the deploy id (got '$URL'). Check the Netlify dashboard." >&2; exit 4;; esac
