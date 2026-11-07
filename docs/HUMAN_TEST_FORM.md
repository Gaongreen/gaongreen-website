# Human test record (E4 evidence): none recorded yet
Tester: ____  Date: ____  Build/commit: ____  Environment: [ ] offline demo  [ ] staging  Browser/device: ____  Language: [ ] EN [ ] KO [ ] AR
Use fictional data only (see DEMO_RUNBOOK.md). Mark Pass / Fail / N/A and note anything odd.

| # | Step | Result | Notes |
|---|---|---|---|
| 1 | Open index; language switch EN/KO/AR; Arabic is RTL | | |
| 2 | Sign in; navigation strip visible on every tool | | |
| 3 | Company Settings: save, reload, values persist | | |
| 4 | K-ISSB: enter dataset, 420 / 4.2 / 25% shown; save draft; reload | | |
| 5 | K-ISSB: Export JSON; Print/PDF report numbers match | | |
| 6 | K-RE100: 1,200 / 300 / 200 | | |
| 7 | EPR: 50 g x 1,000 at 20% = 50 kg | | |
| 8 | Supplier: all yes 100%; mixed 63% / 10 flagged | | |
| 9 | QR: generate, download, scan with a phone camera opens example.com/esg | | |
| 10 | Evidence Locker: upload, list, download, delete | | |
| 11 | Backup export, clear data, import restores | | |
| 12 | Phone width: no horizontal scrolling, buttons reachable | | |
| 13 | Sign out; back button does not show protected data | | |
| 14 | (Staging only) second fictional user cannot see first user's data or files | | |
Overall: ____  Blocking issues: ____

## Account switching in ONE browser (added 2026-11-07)
With the draft that contains `gg-account-guard.js` (needs a new draft deploy — not yet done):
- [ ] As Customer A: save Company Settings (company name), save a K-ISSB / K-RE100 / EPR / Supplier / QR local entry.
- [ ] Sign out; sign in as Customer B in the SAME browser: dashboard company name, Company Settings and every tool show NO data of A.
- [ ] B enters own company name; sign out; sign in as A again: A's own data is back, B's is not shown.
- [ ] Evidence Locker: documents of A are not listed for B (and vice versa).
- [ ] Two tabs: sign out/in as B in tab 2, then edit in tab 1 — tab 1 reloads and A's edit is not saved into B.
