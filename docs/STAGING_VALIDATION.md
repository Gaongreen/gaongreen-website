# Staging validation guide (Supabase staging + Netlify staging)

**Status: PROCEDURE ONLY. Nothing in this guide has been executed by the recovery work against a real Supabase or Netlify project.**
Everything marked *offline-tested* was exercised only against local stand-ins. Everything marked *unverified* needs your run.

Nothing here deploys, migrates or changes a database. Each step is either a read-only check or an action YOU perform in your own staging accounts.
Never use the production project (`uyhmbecltrswiljbyass`); every tool here refuses it.

## 0. Record what already exists (do not rebuild it)
You reported an existing Supabase staging project, a Netlify staging site, and earlier fictional-account isolation + Evidence Locker permission tests.
Those results were not shown to the recovery work, so they are **not** counted as verified here. Please provide, per test: date, project ref (staging), commit/build hash tested, the result file (`rls-result.json`) and the exit code.
If that evidence exists, steps 3 and 4 only need to be repeated against the build you intend to demo.

## Status update 2026-11-06
The staging project `gdmejzbycgpuabvutkdk` was inspected read-only through the Supabase connector (see `evidence/staging/20261106-staging-readonly-inspection.md`): RLS on all 7 tables with owner-scoped policies, no anon grants, private evidence bucket with server-side 10 MB limit. Live sign-in and cross-account tests remain to be run from a machine that can reach the staging API.

## 1. Build the staging artifact (local, offline, deterministic)
```
node tools/vendor-copy.js <dir with real supabase.umd.js + MANIFEST.json>      # hash-verified vendor copy
node tools/build-pinned.js --target-url https://<staging-ref>.supabase.co --target-key sb_publishable_<staging key> --out dist-pinned
```
- `--target-url/--target-key` rewrite the production host/key baked into the pages to your staging project. The build refuses: the production ref (also via `PRODUCTION_HOSTS`), any `sb_secret_`/`service_role` key, non-publishable keys, non-https/wrong-domain URLs, and a lone flag. *(offline-tested: P15, P16)*
- Output includes `RELEASE_MANIFEST.json` (page sha256 values) and a Netlify `_headers` file (per-page CSP + `frame-ancestors 'none'` + hardening headers). *(offline-tested: P17)*
- The publishable key is public by design; Row Level Security is the real boundary. Still, never put a secret key anywhere in this repo.

## 2. Publish `dist-pinned/` to Netlify STAGING (your action)
Upload the `dist-pinned/` folder to the staging site only (drag-and-drop deploy or your usual staging flow). Do not touch the production site or branch.

## 3. Verify what Netlify actually serves (read-only)
```
node tools/check-headers.js https://<your-staging-site>.netlify.app --manifest dist-pinned/RELEASE_MANIFEST.json --out headers-result.json
```
Exit 0 = every page served the audited bytes with the CSP header and hardening headers, and each vendored script matches its SRI. Exit 1 = a mismatch (read the FAIL lines). Exit 2 = refused.
*The checker logic is offline-tested (H-ok … H-refuse). Netlify's handling of `_headers` (path patterns for filenames with spaces, header precedence) is **unverified** until this runs on the real site.* If the file named `K-ISSB Reporting Wizard _ GaonGreen.html` is not matched, rename it or add an explicit rule; that page is a legacy duplicate.

## 4. Supabase staging: inspection and isolation
1. Run `supabase/staging_rls_inspection.sql` in the staging SQL editor (read-only). Check: every one of the 7 app tables has RLS enabled (query A), nothing is listed in query B, query C shows no unreviewed `anon`/`true` policies, the evidence bucket is private with a size limit/MIME list you accept (D), storage policies scope by uid (E).
2. Confirm which owner column `company_profiles` uses (`owner_id` vs `user_id`; the pages use both). Fix the *policy or column on staging* (your action), not by loosening RLS.
3. Run the isolation suite with two fictional users, see `docs/RLS_STAGING_RUNBOOK.md`. Exit 0 required. A failure may be a suite defect or a policy gap; investigate before concluding.
4. Auth settings you must check by hand in the staging dashboard (not testable offline): email confirmation behaviour, redirect URL allow-list contains only the staging site, password-reset email flow, session lifetime. Decision still open: persisted sessions (PA-001).

## 5. Human rehearsal (E4 evidence, none recorded yet)
Use `demo/` (offline) first, then the staging site with fictional accounts. Record results in `docs/HUMAN_TEST_FORM.md`.

## What this guide cannot establish
Real Supabase behaviour, real auth/reset flows, customer-data isolation, Netlify header behaviour, and the real SDK bytes are not verified by any offline test. Report them as verified only with the result files above.
