#!/usr/bin/env bash
# Publishes ONLY the real, already-vendored Supabase SDK files (vendor/supabase.umd.js, vendor/MANIFEST.json, package-lock.json) to a NEW branch
# `vendor/supabase-sdk-<version>` of your GitHub repo. It works in a throw-away clone under a temp dir: it does not read or change your working tree,
# your branches, your index or any pending merge, never touches main, never force-pushes, and refuses anything that looks like a secret or a test fixture.
# Usage (from ANY checkout that has the vendor files; e.g. your repo root):  bash tools/publish-vendor-branch.sh [vendorDir=vendor] [lockfile=package-lock.json] [--verify-only | --dry-run]
#   --verify-only : checks the local files only. NO network, NO git, writes nothing.
#   --dry-run     : also clones origin READ-ONLY into a temp dir and builds the commit there; pushes nothing; temp dir is deleted.
#   (no flag)     : the same, then pushes ONLY the new branch vendor/supabase-sdk-<version>.
# Run without checking anything out:  git fetch origin recovery/lead-eng-2afe977 && git show FETCH_HEAD:tools/publish-vendor-branch.sh | bash -s --
set -euo pipefail
DRY=0; VERIFY=0; ARGS=(); for a in "$@"; do case "$a" in --dry-run) DRY=1;; --verify-only) VERIFY=1;; *) ARGS+=("$a");; esac; done
VD=$(cd "${ARGS[0]:-vendor}" && pwd); LOCK=$(cd "$(dirname "${ARGS[1]:-package-lock.json}")" && pwd)/$(basename "${ARGS[1]:-package-lock.json}")
BASE_BRANCH=${BASE_BRANCH:-recovery/lead-eng-2afe977}; ORIGIN=${ORIGIN_URL:-$(git remote get-url origin 2>/dev/null || echo https://github.com/Gaongreen/gaongreen-website.git)}
die(){ echo "REFUSED: $*" >&2; exit 2; }
[ -f "$VD/supabase.umd.js" ] && [ -f "$VD/MANIFEST.json" ] || die "need $VD/supabase.umd.js and $VD/MANIFEST.json"; [ -f "$LOCK" ] || die "lockfile not found: $LOCK"
VER=$(node - "$VD" "$LOCK" <<'JS'
const fs=require('fs'),c=require('crypto'),p=process.argv[2],l=process.argv[3];const f=n=>{console.error('REFUSED: '+n);process.exit(2)};
const man=JSON.parse(fs.readFileSync(p+'/MANIFEST.json','utf8')),b=fs.readFileSync(p+'/supabase.umd.js');
if(man.fixture)f('MANIFEST marks a TEST FIXTURE');if(man.name!=='@supabase/supabase-js')f('unexpected package '+man.name);if(!/^\d+\.\d+\.\d+$/.test(man.version||''))f('bad version');
if(c.createHash('sha256').update(b).digest('hex')!==man.sha256)f('sha256 of supabase.umd.js does not match MANIFEST');
if(b.length<50000)f('bundle suspiciously small ('+b.length+' bytes)');
const t=b.toString('utf8');if(/sb_secret_[A-Za-z0-9_-]{16,}/.test(t))f('secret-key pattern inside the bundle');
const lock=JSON.parse(fs.readFileSync(l,'utf8')),e=lock.packages&&lock.packages['node_modules/@supabase/supabase-js'];if(!e||e.version!==man.version||!/^sha512-/.test(e.integrity||''))f('lockfile has no sha512 entry for supabase-js '+man.version);
if(JSON.stringify(lock).match(/sb_secret_[A-Za-z0-9_-]{16,}|service_role/))f('secret pattern in lockfile');
console.log(man.version)
JS
) || exit 2
SHOWN=$(printf '%s' "$ORIGIN" | sed -E 's#//[^/@]*@#//#')   # never print credentials embedded in a URL
BR="vendor/supabase-sdk-$VER"; echo "verified: supabase-js $VER; branch would be $BR on top of $BASE_BRANCH (origin: $SHOWN)"
if [ "$VERIFY" = 1 ]; then echo "verify-only: nothing cloned, nothing pushed"; exit 0; fi
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
git clone -q --depth 1 --branch "$BASE_BRANCH" "$ORIGIN" "$T/r"
cd "$T/r"; git checkout -q -b "$BR"; mkdir -p vendor; cp "$VD/supabase.umd.js" "$VD/MANIFEST.json" vendor/; cp "$LOCK" package-lock.json
git -c user.name="${GIT_AUTHOR_NAME:-GaonGreen vendoring}" -c user.email="${GIT_AUTHOR_EMAIL:-noreply@example.invalid}" add vendor package-lock.json
git -c user.name="${GIT_AUTHOR_NAME:-GaonGreen vendoring}" -c user.email="${GIT_AUTHOR_EMAIL:-noreply@example.invalid}" commit -q -m "Vendor real @supabase/supabase-js $VER (sha256 recorded in vendor/MANIFEST.json)"
git show --stat --oneline HEAD | head -6
if [ "$DRY" = 1 ]; then echo "dry run: nothing pushed"; exit 0; fi
git push origin "$BR"; echo "pushed $BR (main untouched)"
