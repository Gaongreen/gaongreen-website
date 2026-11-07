# Cross-account local data (found 2026-11-07, fixed on the recovery branch)

## Report
After switching Customer A -> Customer B in the same browser, the dashboard kept showing A's company name from local Company Settings. (Cloud data was correct: B had no cloud profile and 0/6 cloud records.)

## Root cause
The tools keep working copies in browser storage under fixed, account-less names. Signing out/in as someone else does not touch them, so the next account read the previous account's copy. Affected, across the six tools and their pages:
- localStorage: gaongreen-company-settings-v1 (Company Settings -> dashboard), -epr-scorecard-v1, -kre100-helper-v1, -kissb-draft-v1, -evidence-v1, -qr-esg-card-v1, -supplier-scan-v1, -supplier-draft-v1.
- IndexedDB: gaongreen-evidence-locker-v1 (local Evidence Locker documents), gaongreen-epr-backup-v1 (EPR backup) — also account-less (found while auditing; same leak).
- Already safe: the K-ISSB cloud resume cache (`gaongreen-kissb-cloud-resume-v1:<user id>`) is per-user; language preferences are not account data.

## Fix (`gg-account-guard.js`, loaded first in <head> of all 11 app pages)
Reads the signed-in user id synchronously from the SDK's persisted session (`sb-*-auth-token`) and redirects every read/write/remove of the keys above to `<key>::<user id>` (`::anon` when signed out); IndexedDB names get `::<user id>` for signed-in users. Pages are unchanged and simply get their own copy.
- Nothing is moved or deleted (a first design that moved data between stashes was rejected after my test showed two tabs could race and misplace data).
- Preserved: each account's data stays under its own suffix and returns when that account signs in again.
- Pre-guard data (raw keys/databases) is visible to signed-out visitors only, never to a signed-in account; it is not deleted.
- A page loaded as one identity while the browser session becomes another (stale tab) reads nothing, its writes are dropped, and it reloads (`gg-account-changed` event; Login/Register opt out via `data-gg-guard="no-reload"`).
- No Supabase, network, Auth, RLS, SQL or production change.

## Known limits (honest)
- Local data of different accounts still sits side by side in the same browser profile under different names; anyone with the browser's developer tools can read it. This fix prevents it being SHOWN/used across accounts; it is not encryption. On shared computers use separate browser profiles or clear site data.
- Pre-guard local data stays "signed-out only": a user who had local data before this fix will not see it after signing in (their cloud data is unaffected); signing out shows it again.
- Verified in an offline browser against simulated sessions (E1). Real-account behaviour needs your browser check (rows added to docs/HUMAN_TEST_FORM.md).

## Tests (`tests/func-account-isolation.js`, I1–I8; with the guard disabled I1–I5, I7, I8 FAIL, proving they reproduce the bug)
I1 reported scenario on Company Settings + dashboard; I2 all 8 localStorage keys on all 8 pages, A->B->A->B byte-for-byte; I3 pre-guard data; I4 sign-out/in; I5 stale tab; I6 static: every key used by any page is registered, guard loaded before first use; I7 IndexedDB; I8 rapid flips with a second tab.
