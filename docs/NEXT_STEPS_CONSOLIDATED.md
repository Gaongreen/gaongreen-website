# GaonGreen staging — the only steps that need you (3)

Everything else is done and tested offline (see RECOVERY_REPORT). These three steps need your accounts/network. Run them in your Codespace, in `/workspaces/gaongreen-website` (NOT the unfinished merge in `gaongreen-merge-review`). Nothing here touches production, Auth settings, policies, SQL, or paid features.

## Step 1 — Real Supabase SDK (read-only inspection first)
Inspect the script before running it:
```
git fetch origin recovery/lead-eng-2afe977
git show FETCH_HEAD:tools/publish-vendor-branch.sh | sha256sum     # expect 0691bc80612539885051fe005e62d9e9aa72fb6f72abadb3ad3b9adba5cf837b
git show FETCH_HEAD:tools/publish-vendor-branch.sh | less          # read it
```
Safe procedure (each stage is a superset of the previous risk):
1. `... | bash -s -- vendor package-lock.json --verify-only` — no network, no git; checks manifest hash, lockfile sha512, refuses fixtures/secrets.
2. `... | bash -s -- vendor package-lock.json --dry-run` — read-only temp clone; builds the commit; pushes nothing.
3. Real run (no flag) — pushes ONLY a NEW branch `vendor/supabase-sdk-<version>`; never main, never the dev branch, never force.
(Prefix: `git show FETCH_HEAD:tools/publish-vendor-branch.sh | bash -s --`.) Reply "SDK pushed".

## Step 2 — Live RLS isolation test (priority)
```
bash tools/run-live-rls.sh <fictionalA@example.com> <fictionalB@example.com> --mime
```
Passwords are typed silently, never stored/echoed. A preflight reports which password rules fail (categories only). Result file `rls-staging-result-<UTC>.json` contains no secrets — send it back. Uses only the staging project (production URL/secret keys refused).

## Step 3 — Netlify draft deploy + 10-minute human check
```
node tools/build-pinned.js --vendor vendor --target-url https://gdmejzbycgpuabvutkdk.supabase.co --target-key sb_publishable_RV_G9MyL3cRJpl67w6gXUg_BpvFP6x8 --qr demo/vendor/qrcode-shim.js --out dist-pinned
bash tools/staging-draft-deploy.sh --keep-file <path>/validate-backup-only.html           # checks only
bash tools/staging-draft-deploy.sh --keep-file <path>/validate-backup-only.html --deploy  # DRAFT deploy
```
Draft = unique URL, live site unchanged, SSO-protected; `--prod/--alias` refused. Then walk `docs/HUMAN_TEST_FORM.md` on the draft URL, including uploading each of the 10 supported file types in Evidence Locker. Rollback is unnecessary (live site untouched).

## Prepared, NOT applied (need your later approval of the exact change)
- **Password policy (free plan):** proposed Auth setting min length 12 + lower+upper+digits. Compatibility: Step 2's preflight tells us whether the two fictional accounts' passwords comply; if not, they'd need a password reset first (WeakPasswordError risk). Leaked-password protection is Pro-only → not enabled.
- **Evidence MIME allow-list:** `supabase/proposed/evidence_bucket_mime_allowlist.sql`. Applied only after Step 3 shows all file types upload from the fixed frontend AND you approve the exact SQL.
