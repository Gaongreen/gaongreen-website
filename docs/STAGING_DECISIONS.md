# Staging decisions and procedures (2026-11-06)
Nothing in this file has been executed against Supabase or Netlify. Items marked PROPOSED need your go-ahead at the time of execution.

## 1. Leaked-password protection: NOT available on the free plan
Supabase docs ("Password security"): *"Leaked password protection is available on the Pro Plan and above."* The organization "Gaongreen's Org" is on the **free** plan (`get_organization`). Enabling it would require a paid upgrade, which is not approved, so **nothing was changed** and the advisor WARN stays open.
Free-plan alternative (PROPOSED, an Auth setting change, needs approval): raise minimum password length and required character classes in Auth > Providers > Email. Impact: applies to new sign-ups and password changes; **existing accounts with shorter passwords get a `WeakPasswordError` on sign-in**, so check that the two fictional test accounts already satisfy the new rule before changing it, or the live isolation test will fail to sign in.

## 2. Evidence Locker server-side file types: prepared, NOT applied
- Supported extensions (page code, client-side): pdf, png, jpg/jpeg, webp, csv, xlsx, xls, docx, txt. Max 10 MB (also enforced server-side on staging).
- Problem found: the page used the browser-reported type (`f.type || 'application/octet-stream'`). Browsers report `''`, `application/vnd.ms-excel` for csv, etc., so an exact allow-list would reject legitimate files.
- Fix (committed): the page now declares one canonical type per extension (`MIME_BY_EXT`). Test `func-evidence-mime` uploads 10 extensions x 4 declared types (40 files): all stored with the canonical type (mutation-checked).
- Proposed SQL: `supabase/proposed/evidence_bucket_mime_allowlist.sql` (single UPDATE of `allowed_mime_types` for bucket `evidence-locker`, with rollback line). It permits exactly the 9 canonical types.
- Compatibility: existing objects are unaffected (only new uploads are checked); the offline tests' files (.txt, text/plain) stay allowed. **Not yet verified against real Supabase**: the live suite has opt-in checks `CHECK_MIME=yes` (all 9 types accepted, html/svg/js/exe/octet-stream rejected) and `CHECK_LIMITS=yes` (10 MB + 1 rejected).
- Limit: Supabase checks the declared type, not file contents; this stops accidental/casual types only.
- Apply order: (a) deploy the page fix to staging first, (b) apply the SQL, (c) run the live suite with CHECK_MIME=yes. Old cached pages that send the browser type would be rejected after (b).

## 3. Netlify staging: facts and a safe procedure (nothing deployed)
Facts (read-only): one site, `incredible-biscotti-bcf58a` (id `48c18d02-eb99-46b4-a68d-96f724940fd9`), only netlify.app URLs (no custom domain, so it cannot overwrite the gaongreen.com website). Current deploy `6adf6e4d0e82082a49c6f086` (26 Oct, manual drag-and-drop) added `validate-backup-only.html`. No header rules. **Team single sign-on is required for the whole site.**
The connector's `deploy-site` takes only a site id (no draft/preview or file-set options), so it is **not used**.
Procedure (run by you in the Codespace, or by me once a draft-capable path exists):
1. Preserve: Netlify keeps every deploy; the current one stays available by its ID and can be re-published from Deploys > that deploy > Publish deploy. Also download `validate-backup-only.html` from it and place a copy in `dist-pinned/` before deploying, so the new deploy contains it too.
2. Build: `node tools/build-pinned.js --target-url https://gdmejzbycgpuabvutkdk.supabase.co --target-key sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8 --qr demo/vendor/qrcode-shim.js --out dist-pinned` (needs the real vendor files, see 4). The build refuses the production ref and any secret key; afterwards confirm `RELEASE_MANIFEST.json` `target.host` is the staging host and `grep -c uyhmbecltrswiljbyass dist-pinned/*.html` is 0.
3. **Draft deploy first** (does not change what the site serves): `netlify deploy --dir dist-pinned --site 48c18d02-eb99-46b4-a68d-96f724940fd9` (no `--prod`). Test the printed draft URL.
4. Because SSO is required, `tools/check-headers.js` cannot read the site anonymously; check headers in the browser (DevTools > Network) or relax access for non-production deploys (a visitor-access change, PROPOSED, needs your approval).
5. Only after the draft passes: publish with `--prod` (this is Netlify's "production" for this site, not the GaonGreen website).
6. Check Supabase Auth Site URL / redirect allow-list for staging (Auth settings, not readable by me).

## 4. Real SDK to the dev branch: one command
From your repo root in the Codespace (any worktree; it uses a throw-away clone and never touches your working tree, your branches or the pending merge; never main, never force):
```
git fetch origin recovery/lead-eng-2afe977 && git show FETCH_HEAD:tools/publish-vendor-branch.sh | bash -s -- vendor package-lock.json
```
It verifies the sha256 against MANIFEST, refuses fixtures/secrets/missing lockfile entry, then pushes a new branch `vendor/supabase-sdk-<version>` containing only `vendor/supabase.umd.js`, `vendor/MANIFEST.json` and `package-lock.json`. Add `--dry-run` at the end to verify without pushing. Offline-tested (V1-V5).

## 5. Live RLS isolation test for the two fictional staging accounts (ready, not run)
Needs the two accounts' emails/passwords (not shared with me and never to be pasted into chat). From a machine that can reach staging (the sandbox cannot):
```
ALLOW_STAGING=yes STAGING_URL=https://gdmejzbycgpuabvutkdk.supabase.co STAGING_KEY=sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8 \
A_EMAIL=... A_PASSWORD=... B_EMAIL=... B_PASSWORD=... OUT=rls-staging-result.json node tests/rls/rls-isolation.mjs
```
Emails must be on example.com/.org/.net, .invalid or .test (the suite refuses others). It writes and deletes only rows/objects marked `gg-rls-test` owned by the two accounts, and refuses production, secret keys and service_role. Add `CHECK_LIMITS=yes` now and `CHECK_MIME=yes` after step 2(b). Exit 0 = all passed, 1 = isolation failure, 2 = refused, 3 = result file unwritable. Logic validated against local mocks (H1-H8); the real run is still outstanding.

## Real SDK integrated (2026-11-06)
- Branch `vendor/supabase-sdk-2.118.0` (commit bc018b4, child of b440f9b) fast-forward merged into `recovery/lead-eng-2afe977`; main untouched.
- Independently re-verified from the fetched blobs: vendor/supabase.umd.js 218252 bytes, sha256 ee3be8de…ed3d3 and sha384 match MANIFEST; package-lock.json entry @supabase/supabase-js 2.118.0 integrity sha512-FxI8UXMV… equals MANIFEST tarballIntegrity; no fixture marker; 8 locked dependencies listed.
- NOT independently verifiable here: that the bytes equal the npm registry tarball contents (sandbox cannot reach the registry); provenance rests on the lockfile integrity recorded when you ran npm.
- Staging build `dist-pinned` produced with the real SDK (fixture:false), target host = Phase 3 Staging only; `tools/staging-draft-deploy.sh` checks pass (dry run, nothing deployed).
- `tests/real-sdk-smoke.js` (R1–R7): real bundle vs loopback mock (E2). Mock token response made realistic (user object, exp) because the real SDK validates it.
