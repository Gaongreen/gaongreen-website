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

## Session-only sign-in and idle timeout (added 2026-11-07; needs a draft that contains `gg-idle.js`)
Use the fictional account only. Chrome, Safari and a phone, one pass each.

| # | Check | Pass? | Notes |
|---|---|---|---|
| S1 | Sign in, open a tool, press refresh: still signed in | | |
| S2 | Close the whole window and reopen the site normally: signed out | | |
| S3 | Close a tab, then "Reopen closed tab" (or let the browser restore the session): note whether you are still signed in; if you are, wait 30 minutes idle and reload: you must be signed out with a message | | expected: restore can bring the session back |
| S4 | Open a new tab by typing the address: asked to sign in (expected friction) | | |
| S5 | Type in a tool, do NOT save, leave the tab idle for 28 minutes: a warning appears (EN/KO/AR, readable, right-to-left in Arabic) | | |
| S6 | Press "Stay signed in": warning disappears; stay idle 30 minutes: signed out with a message; sign in again: your typed text is back | | |
| S7 | Evidence Locker: choose a file, do not upload, wait for the warning: the file name is listed as "will be discarded" | | |
| S8 | K-ISSB: type in the main form, do not click "Save progress", let the timeout sign you out, sign in, click "Resume saved": your text is there | | |
| S9 | Duplicate the tab, use both, let both idle out: both end with a message; no other account's data appears | | |
| S10 | Sign in as A in one tab and as B in another at the same time: each tab shows only its own company name | | |
