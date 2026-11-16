# GaonGreen recovery report (integration branch `integration/lead-eng`)

Scope: local, offline development work only. Nothing was pushed, merged into a protected branch, deployed, or run against any real Supabase/Netlify/production system.
Base: commit `a6db6fe`. This report covers the commits after it (see `git log a6db6fe..HEAD`).

## 1. Fixes and improvements
| # | Change | Why / evidence |
|---|---|---|
| 1 | **P13 hermetic pinned-build test** (merged from `fix/p13-hermetic`) | Test depended on the working directory/environment and a fixture manifest could slip through; builds now run in controlled temp dirs and fixture manifests are refused unless `--allow-fixture`. |
| 2 | **QR decoder diagnostics** (merged from `fix/qr-decoder-diagnostics`) | `tools/decode_qr.py` returns distinct exit codes/markers; failures to run the decoder are reported, not read as "no QR". `PYTHON_BIN` override. Tests F-Q0, Q-D1..D3. |
| 3 | **Navigation strip + sign-out on all 8 app pages** (`gg-nav.js/css`) | Sign-out existed only on Login; 4 pages had no route back to the hub. 3 languages, RTL, hidden in print, current page marked. Tests N1-N7, P14. |
| 4 | **Failure-path coverage** (`tests/func-faults.js`) | Expired session, backend outage on save/load, validation rejection, QR cloud path, K-ISSB PDF content checked with `pdftotext`. No product defect found; pages already fail safely. Mutation-checked that the tests are not vacuous. |
| 5 | **Demo stand-in fidelity** | Emits `INITIAL_SESSION` like supabase-js; test-only hooks (`__ggDemoTest`). |
| 6 | **QR card resolution** (product bug) | ~420-char link at 150 px = ~2 px/module: decode failed ~1 run in 6 and the downloaded PNG was low-res. Now generated at 400 px, shown at 200 px. Test F-Q-RES; 10/10 solo runs after fix. |
| 7 | **Staging pack** | `build-pinned.js --target-url/--target-key` (refuses production ref, secret/service_role keys, malformed URLs); Netlify `_headers` with per-page CSP + `frame-ancestors 'none'` + hardening headers; `tools/check-headers.js` read-only deployed-site check; extended read-only SQL; `docs/STAGING_VALIDATION.md`. Tests P15-P17, H-*. |
| 8 | **Demo package docs** | `docs/DEMO_RUNBOOK.md` (fictional dataset with expected results), `docs/HUMAN_TEST_FORM.md`. |

## 2. Test results (all OFFLINE)
Final full suite on this branch (`bash tests/run-all.sh <dir>`): **198 PASS, 0 FAIL, exit 0** (evidence: `evidence/runs/20261106-run19-qr-resolution/`; clean-checkout re-run recorded in the run20 folder).
The earlier run18 (`...run18-staging-pack/`, 195 PASS / 2 FAIL) is kept: it exposed the QR resolution defect fixed in item 6.
Test classes: **mock/stand-in based** = every test in the suite. Headless Chromium against an in-browser Supabase stand-in (E1), a loopback mock for the RLS suite logic (E2), static reading (E3). **Real-backend tests: none were run by this work (E5 = none). Human browser tests: none (E4 = none).**

## 3. Security and remaining risk
Improved: CSP with inline-script hashes and no unsafe-eval/unsafe-inline scripts, SRI on the vendored SDK, `_headers` (clickjacking, nosniff, HSTS, permissions policy), staging retargeting that cannot target production or accept a secret key, hermetic build, read-only deployed-site verification.

Not verified / open (do not claim otherwise):
1. **Real Supabase behaviour**: RLS isolation, storage policies, auth, password reset. Your earlier staging isolation/Evidence tests were not shown to me. Needs result files (see STAGING_VALIDATION.md).
2. **Real SDK bytes**: only the manifest hash (2.118.0) you reported; the vendored file itself was not seen here.
3. **Netlify `_headers` behaviour** (esp. the legacy page whose file name has spaces) is unverified until `tools/check-headers.js` runs on staging.
4. **Evidence Locker**: on STAGING the 10 MB limit IS enforced server-side (bucket `file_size_limit` and a CHECK on `size_bytes`), but there is no server-side MIME/type allow-list (`allowed_mime_types` is NULL); the extension list is client-side only. Local-only evidence files are not in the JSON backup.
5. **Persisted sessions (PA-001)** decision still open.
6. **`company_profiles` owner column**: confirmed on staging as `owner_id` only (no `user_id`); the pages already handle this. Staging policy definitions were inspected read-only: see `evidence/staging/20261106-staging-readonly-inspection.md`. Cross-account behaviour is still untested live.
6b. Staging Auth advisor WARN: leaked-password protection is disabled (change needs approval).
7. **Pages still hard-code the production host/key**; use the retarget build for staging. The publishable key is public by design; RLS is the real boundary.
8. Inline `style` attributes still require `style-src 'unsafe-inline'`.
9. Authentication integration remains **blocked** (no contract evidence/G1-D); Baselines B/C, contracts and the failed-unlock vault were not located or touched.
10. Minor: stale R-K5 label, ko/ar completeness for four tools, duplicated guard helper in smoke.js/serve.js, hard-coded `/tmp/claude-0` in func-auth-settings.js, OpenCV not pinned (`requirements-test.txt`).

## 4. Actions that need you
1. Provide/produce staging evidence: RLS suite result file, inspection SQL output, Evidence permission test, with commit hash tested.
2. Build with the real vendored SDK and `--target-*` for staging; deploy to Netlify staging yourself; run `tools/check-headers.js`.
3. Decide PA-001 (persisted sessions) and confirm the owner column.
4. Human rehearsal (HUMAN_TEST_FORM.md) on the offline demo and staging.
5. Production hosting/deploy decisions and any auth contract evidence.
6. Apply the changes to your Codespace using `docs/APPLY_PROCEDURE.md`.

## Addendum 2026-11-06 (after the draft PR was opened)
- Full offline suite on the working tree: **212 PASS, 0 FAIL, exit 0** (`evidence/runs/20261106-run21-l10n-mime-vendor/`). Still all stand-in/mock based; no real-backend or human test.
- Added: Evidence Locker canonical MIME declaration + proposed (NOT applied) bucket allow-list; opt-in live-suite checks (CHECK_MIME/CHECK_LIMITS); `tools/publish-vendor-branch.sh`; shared `gg-l10n.js` (Korean/Arabic for cloud panels, buttons, placeholders, status lines; Company Settings title/status were untranslated); tests func-evidence-mime, vendor-publish, func-l10n.
- Staging inspected read-only (see `evidence/staging/`). Leaked-password protection needs the Pro plan (org is on free): not enabled. See `docs/STAGING_DECISIONS.md`.
- Known remaining localization gaps: product names on the dashboard, aria-labels, sample placeholders, demo banner text, KISSB one-time profile status.
