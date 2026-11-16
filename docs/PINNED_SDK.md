# Pinned Supabase SDK path (Milestone 3)

**Status: pipeline mechanics tested with a FIXTURE. The real SDK has NOT been vendored** (this sandbox cannot reach registry.npmjs.org; the egress policy was not bypassed).

## What you run (once, in Codespaces or any machine with npm access)
1. `npm view @supabase/supabase-js@2.118.0 version deprecated` – 2.118.0 is a CANDIDATE, confirm it exists and is not deprecated; otherwise edit the exact pin in `package.json`.
2. `bash tools/vendor-supabase.sh` – `npm ci --ignore-scripts`, `npm audit signatures`, `npm audit`, then `tools/vendor-copy.js` writes `vendor/supabase.umd.js` and `vendor/MANIFEST.json` (sha256, sha384, lockfile sha512).
3. `node tools/build-pinned.js --out dist-pinned` – verifies hashes, rewrites CDN imports to the local file with SRI, builds a per-page CSP from inline-script hashes (no `unsafe-inline` for scripts, `connect-src` = self + the one Supabase host).
4. Commit `package-lock.json` and `vendor/`.

## What the pin proves / does not prove
- Proves (once step 2 is run): the bytes served are the bytes of one reviewed, locked release.
- Does NOT prove: that RLS works, that auth is configured safely, or that the version has no vulnerabilities (`npm audit` is advisory).
- Pending decision PA-001: the build keeps `persistSession:true` (multi-page app). Memory-only tokens would force re-login on each page.
- `frame-ancestors` cannot be set by a meta CSP; set it as an HTTP header at the host.
