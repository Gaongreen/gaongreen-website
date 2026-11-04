# GaonGreen recovery status (branch: recovery/integration, based on 14cf656)

Last updated 2026-11-04. Verified = observed in a test or in the repository bytes. Everything else is an assumption.

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
