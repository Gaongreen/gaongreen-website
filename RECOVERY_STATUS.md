# GaonGreen recovery status (branch: recovery/integration, based on 14cf656)

Last updated 2026-11-04 (milestone 2). Verified = observed in a test or in the repository bytes. Everything else is an assumption.

## Canonical pages (reachable from index.html by link-following)
| Tool | Canonical file | Non-canonical variants (kept, not deleted) |
|---|---|---|
| K-ISSB Reporting Wizard | GaonGreen_KISSB_Cloud_Beta.html | GaonGreen_KISSB_Cloud_Beta.html.html (edited 22 Oct, older than canonical fix 5c04ed3), K-ISSB wizard static pages |
| K-RE100 Helper | GaonGreen_K-RE100_Cloud_Beta.html | GaonGreen_K-RE100_Helper.html (local-only) |
| EPR Packaging Scorecard | GaonGreen_EPR_Cloud_Beta.html | four GaonGreen_EPR_Packaging_Scorecard variants |
| Supplier ESG Scan | GaonGreen_Supplier_ESG_Scan_Cloud_Beta.html | GaonGreen_Supplier_ESG_Scan.html (local-only) |
| QR ESG Card | GaonGreen_QR_ESG_Card_Cloud_Beta.html | GaonGreen_QR_ESG_Card.html (local-only) |
| Evidence Locker | GaonGreen_Evidence_Locker_Cloud_Beta.html | GaonGreen_Evidence_Locker.html (IndexedDB, local-only, NOT encrypted) |
Shared: index.html, GaonGreen_Login.html, GaonGreen_Register.html, GaonGreen_Company_Settings_Cloud_Beta.html, GaonGreen_ESG_Dashboard_Cloud_Beta.html

## Evidence runs (append-only; never edit old run folders)
- run01: unmodified baseline-A code + new tests. Static: 8 FAIL / 1 PASS (S7 no secrets). Smoke: 30/31 pages load without an uncaught JS error (Supabase and QR libraries stubbed, all external traffic blocked).
- run02: after the Register link fix. S1 now PASS; other static checks unchanged.

## Known open items
- Baselines B and C (encrypted vault, 35-path pilot, G1-D, contracts) are not in the bundle; location unknown.
- Public Cloud Beta pages load the Supabase SDK from CDNs at floating @2 without SRI and persist sessions (static checks S2-S6).
- Orphan "GaonGreen _ Practical ESG for SMEs.html" throws a JS parse error at load.
- Pinning/bundling the SDK needs npm network access, which the authoring sandbox does not have.


## Milestone 2: offline six-tool demo (this commit range)
Built with `node tools/build-demo.js` into `demo/` (generated; originals untouched). Run: `cd demo && python3 -m http.server 8080`. Full suite: `bash tests/run-all.sh <evidence-dir>`.

### Implemented vs verified
| Item | Implemented | Verified by test (run05, demo build only) |
|---|---|---|
| Offline Supabase stand-in (auth, tables, storage) | yes | page flows below exercise it; it is NOT Supabase and says nothing about real RLS/auth |
| QR library replaced by local MIT shim | yes | QR pixels decode (OpenCV) to the expected profile link |
| CSP + DEMO banner + reset button on demo pages | yes | no external request, no CSP violation, banner present on all 12 demo pages |
| K-RE100 calculations | existing | 5 hand-computed checks pass, incl. negative input rejected |
| EPR calculations + scenario | existing | 5 hand-computed checks pass; the "invalid recycled %" check only looks for a validation message (weak) |
| Supplier scoring | existing | 2 hand-computed checks pass |
| K-ISSB indicators, validation, save/resume, language | existing | 12 checks pass (incl. Arabic RTL, Korean Hangul) |
| QR card generation + safety | existing | decode, validation, javascript: URL dropped, hostile shared link inert |
| Evidence Locker (cloud-style upload/download/delete, local save) | existing | SHA-256 round trip equal, delete, local count |
| Cloud save/load round trips (K-ISSB, K-RE100, EPR, Supplier) | existing | restore verified against the stand-in |
| Token/password-like values absent from localStorage/sessionStorage after demo sign-in | stand-in | pass (this tests the stand-in, not the real SDK) |

### Counts (run05): 51 PASS, 0 FAIL = 13 smoke + 11 calculations + 15 tools + 12 K-ISSB.

### NOT verified (do not claim)
Real Supabase behaviour, RLS/account isolation, real sign-in/refresh/sign-out, password reset, Company Settings and Login/Register beyond page load, CSV/JSON/PDF export and import, K-ISSB evidence checklist and branded PDF, print layout, visual/mobile layout, Arabic/Korean translation quality, multi-tab behaviour, the local Evidence Locker (no encryption in this baseline), and everything from Baselines B and C.

### Evidence index
- run03: first functional run; F-Q4 FAILED because my expectation was wrong (page drops unsafe URLs at render). Preserved unedited.
- run04-ABORTED: invalid run (QR shim not built first). Preserved unedited.
- run05: valid full run, all pass.

### Findings
- Public Cloud Beta pages still load an unpinned SDK from CDNs with persisted sessions (unchanged, production decision pending). The demo removes this only for demo pages.
- QR page: unsafe website/evidence URLs are dropped at render and hostile shared payloads render as inert text (verified).

## Milestone 3 (incremental on cd09197)

Legend: **STAND-IN** = offline in-browser Supabase stand-in; **FIXTURE** = test double for the SDK file; **LOCAL MOCK** = local HTTP mock of the REST API; **REAL** = real Supabase. **No test in this milestone ran against REAL Supabase.**

### Implemented vs verified
| Item | Implemented | Verified by | Result |
|---|---|---|---|
| Login / Register / Company Settings | yes | func-auth-settings (STAND-IN) | 17/17 |
| K-ISSB evidence checklist, CSV/backup, report buttons | yes | func-kissb-reports (STAND-IN; `window.print` stubbed, no PDF produced) | 14/14 |
| JSON/CSV export/import round trips (6 tools) | yes | func-roundtrips (STAND-IN) | 20/20 |
| EPR recycled-% and other boundaries | yes | func-epr-boundaries (STAND-IN) | 22/22 |
| Pinned SDK build pipeline | mechanics | pinned-build (FIXTURE) | 14/14 |
| Real SDK vendored | NO | - | needs npm access |
| RLS isolation suite | draft | rls-harness (LOCAL MOCK, tests suite logic only) | 7/7 |
| RLS on real Supabase | NO | - | **not verified** |

Full suite run12: 145 PASS, 0 FAIL (51 prior + 94 new). Evidence: `evidence/runs/20261104-run12-milestone3`.

### Findings
- **Fixed: CSV formula injection** in EPR, Supplier, Evidence Locker, K-RE100, K-ISSB exports (cells starting `= + - @ TAB CR` now prefixed with `'`; plain numerics exempt). Failed run kept: run10.
- **Fixed:** K-RE100 CSV exported unrounded share/gap/projected values.
- **Fixed (tooling):** build-pinned gave dynamic-import pages no SDK tag (found by P3). Failed run kept: run11.
- Test defects corrected and preserved: run06 (auth expectations), run08 (K-R5).
- Uncertain: `company_profiles` owner column (`owner_id` vs `user_id`).
- Pending decision PA-001: session persistence policy.

### NOT verified (do not claim)
Real Supabase auth, RLS, storage policies, password reset; the real SDK pin; K-ISSB PDF file output; Baselines B and C, G1-D, the contracts and the failed-unlock vault (not located, not touched). Public Cloud Beta pages still use an unpinned CDN SDK.

### Supporting docs
`docs/PINNED_SDK.md`, `docs/RLS_STAGING_RUNBOOK.md`, `supabase/staging_rls_inspection.sql`.

## Milestone 3 follow-up: RLS harness diagnostics (2026-11-05)

**Root cause of H1-H6 `exit 1 []`:** `tests/rls-harness.js` wrote each suite run's result file under a hard-coded sandbox path (`/tmp/claude-0/`). Where that directory does not exist or is not writable, `rls-isolation.mjs` ran every check against the local loopback mock, then crashed on its final `writeFileSync` (uncaught ENOENT, exit 1). The harness swallowed its own read error (`catch{}`), never looked at stderr, `error` or `signal`, so it saw "exit 1, no failed ids". H7 was unaffected because the guards exit 2 before any file is written. The harness used the local mock (127.0.0.1), not a staging endpoint; no real network target was involved. Reproduced exactly: `evidence/runs/20261105-run13-rls-harness-diagnostics-initial` (kept as a historical failure).

**Fix (assertions and refusal conditions unchanged):** result files go to `os.tmpdir()`; `tests/lib/proc.js` reports status, signal, spawn error, timeout and redacted stdout/stderr; a run counts only if the suite really executed and its result file was readable; the suite exits **3** (`RESULT-FILE-ERROR`) when it cannot write results, so that is never confused with an isolation failure (exit 1); children get a minimal environment; the harness refuses a non-loopback mock URL. Guards moved to `tests/rls-guards.js` (H7, H7b) with diagnostics self-tests D1-D5.

**Separation:** offline = `tests/rls-harness.js`, `tests/rls-guards.js` (in `run-all.sh`, loopback only). Real staging = `tests/rls/rls-isolation.mjs`, manual only (`npm run test:rls-staging`), refuses without `ALLOW_STAGING=yes`.

**Results (offline, local mock only):** run14: 13 PASS / 0 FAIL; full suite run15: 151 PASS / 0 FAIL. **Real Supabase RLS remains NOT verified.**

**Remaining blockers:** no authorized staging project or fictional accounts; owner column of `company_profiles` and live request shapes unconfirmed; real SDK not vendored (no npm access here).
