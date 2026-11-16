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

## SUPERSEDES steps 1–3 above for the validation run: ONE command
From the repo root in your Codespace (branch `recovery/lead-eng-2afe977` at the latest commit, `vendor/` present):
```
bash tools/staging-validate-all.sh <fictionalA@example.com> <fictionalB@example.com> --keep-file <path/to/validate-backup-only.html>
```
- Exit 0 only if precheck, build, deploy-guard, live RLS/storage/MIME AND the draft deploy all pass. Any failure → exit 1 and a `RESULT: FAIL (...)` line; a failed RLS/storage test always prevents deployment.
- Working files go to a private temp dir (outside the repo, mode 700). Share ONLY the printed SUMMARY (allow-listed fields: step results, check ids/names, SDK hash, target host, draft URL). Raw logs and the raw RLS result stay private.
- Safety: draft deploy only, never `--prod`; the script reads the live site's published deploy id before and after and fails (exit 5, with rollback target) if it changed; refuses to deploy if it cannot read it.
- `--no-deploy` validates without deploying (result is `PASS-NO-DEPLOY`). `--with-offline` also runs the offline suite (needs playwright/opencv; already passed in the build environment).

## Netlify draft deploy — how the existing site and `validate-backup-only.html` stay safe (2026-11-06)
- The live site serves deploy `6adf6e4d0e82082a49c6f086` (manual drop, 26 Oct; Netlify's own summary lists `validate-backup-only.html` as one of its files). A **draft deploy is a separate, immutable deploy with its own URL**; it never alters the published one, so the backup page stays exactly where it is. `--keep-file` is therefore **not needed for the draft** (it is optional; leave it out).
- The script reads the published deploy id before and after and fails (exit 5, rollback target printed) if it ever changes.
- The backup page only needs copying at the **final production release** (a production deploy replaces the site's files). Until then it is preserved at the permanent URL `https://6adf6e4d0e82082a49c6f086--incredible-biscotti-bcf58a.netlify.app/validate-backup-only.html` (team SSO login required). Before the production release, save that page from that URL into the repo's release folder so it can be included with `--keep-file`.
- Netlify authentication IS required (the CLI deploys as you): `npm i -g netlify-cli` then `netlify login` (prints a link to open in your browser; no secrets pass through chat). Alternative: create a short-lived personal access token in Netlify → User settings → Applications, type it silently with `read -rs NETLIFY_AUTH_TOKEN; export NETLIFY_AUTH_TOKEN`, and revoke it afterwards.

## "Site not found" on a draft URL — read-only diagnosis (2026-11-06 23:17)
Connector findings: live site still serves 6adf6e4d0e82082a49c6f086 (state current, unchanged); team-login (SSO) is required for all contexts. Netlify deploy ids are exactly 24 hex characters; the id reported ("6aee33e29e5443360a12475") has 23, and the API returns 404 for it → the id/URL used was almost certainly truncated or mistyped. SSO would show a login page, not "Site not found".
Read-only listing of the real draft (prints ids/URLs only; changes nothing; needs `netlify login`):
```
netlify api listSiteDeploys --data '{"site_id":"48c18d02-eb99-46b4-a68d-96f724940fd9"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).slice(0,5).forEach(d=>console.log(d.id,d.state,d.context,d.created_at,d.deploy_ssl_url)))'
```
Open the `deploy_ssl_url` of the newest row whose context is not "production" (while logged in to the Netlify team). The script now also prints `DRAFT deploy id:` and fails if the id is not 24 hex or the URL does not start with it.

## Draft deploy WITHOUT typing passwords (2026-11-07): `--use-ci-proof`
Once the GitHub Actions "Live staging tests" run has passed for the exact commit you are deploying (see docs/CI_LIVE_STAGING.md), the draft can be created without re-running the live tests locally:
```
git pull && bash tools/staging-validate-all.sh --use-ci-proof
```
`tools/check-ci-proof.sh` (read-only, needs `gh` logged in) refuses unless: tracked files are clean, HEAD is the pushed tip of `recovery/lead-eng-2afe977`, and a successful run of the workflow for exactly that commit (push or manual, that branch, < 24 h old) has its live job AND test step concluded `success`. Any new commit needs a new run (Actions → Run workflow, then approve under Review deployments). Everything else is unchanged: build for staging only, deploy guard, draft only, live-deploy-unchanged check, shareable summary (now shows the exact draft id and URL). If `gh` is unavailable or lacks permission to read Actions in your Codespace, fall back to the password version of the command.
