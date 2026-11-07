# Session design proposal: session-only sign-in with a 30-minute idle timeout

Status: **IMPLEMENTED on the recovery branch (approved 2026-11-07 20:26: options a, b, c). Offline tests pass; the live staging run is awaiting approval.** Section 10 records what was built, the corrections found while building, the results and the remaining limits. No Supabase Auth setting, JWT lifetime, hosting or DNS change was made.
Applies to the recovery branch `recovery/lead-eng-2afe977`. Evidence classes: E1 offline Chromium, E2 mock, E3 reading, E4 human, E5 real staging.

## 1. Short answers to the questions asked

| Question | Answer |
|---|---|
| Can session-only plus 30-minute idle be done without breaking cloud saves, refreshes or account switching? | **Yes, with one trade-off:** each browser tab holds its own sign-in. Cloud saves, page refreshes and A to B switching keep working. This is checked by tests before it is offered (section 7). |
| Does closing the browser reliably end the session? | **No, not reliably.** Closing the tab or window discards the stored session in normal use, but "reopen closed tab", Chrome "Continue where you left off", Safari and Firefox session restore, and mobile tab restore can bring it back. What IS reliable is the **30-minute idle bound**, enforced from a stored timestamp, so a restored session older than 30 minutes is signed out (and revoked) on load. |
| Is the idle timeout tamper-proof? | **No.** It is a client-side timer. Supabase Free has no server-side inactivity timeout or time-boxed session (both are Pro features). Someone who already holds a stolen token is not stopped by it. It protects the normal case: an unattended, shared or restored browser. |
| What does idle sign-out do on the server? | `signOut({scope:'local'})` revokes THIS session's refresh token on the server. The short-lived access token (JWT) stays valid until it expires (Auth default 3600 s). |

## 2. Current behaviour (E3)

All cloud pages create the client with `persistSession:true, autoRefreshToken:true` and no `storage` option, so the session sits in `localStorage` as `sb-<ref>-auth-token` and survives browser restarts (previous decision PA-001). The client is created separately in about 8 pages. Sign-out goes through `GaonGreen_Login.html?action=signout`. `gg-account-guard.js` reads the user id from that localStorage record.

## 3. Proposed implementation

### 3.1 Where the session is stored: `sessionStorage` (recommended, "Option 1")
* New shared file `gg-auth-config.js`, loaded before any client creation, exporting `window.ggAuthOptions = {persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storage: window.sessionStorage}`. Every page passes it to `createClient`, so storage policy lives in one place.
* sessionStorage is per tab, is discarded when the tab or window is closed, and is never written to disk by the SDK.
* **One-time migration:** on first load after release, any old `sb-*-auth-token` in localStorage is deleted. Existing users sign in once more.
* `autoRefreshToken` stays on, so the access token is renewed in the background while the tab is open (refresh timer runs only in open tabs; a throttled background tab may refresh slightly late but the SDK retries on focus).

Rejected "Option 2" (custom localStorage adapter that detects a new browser session with Web Locks or a heartbeat): shares the sign-in across tabs, but is complex, has more failure modes (crash, sleep, restored windows) and gives a weaker guarantee than Option 1. Not recommended.

### 3.2 Idle timer: new `gg-idle.js` (loaded on every signed-in page)
* `lastActivity` (epoch ms) is kept in sessionStorage under `gg-last-activity`. Activity events: pointerdown, keydown, scroll, wheel, touchstart, input - **trusted (real user) events only**, so page scripts cannot keep a session alive. Returning to a tab is NOT activity: it triggers a check. Writes are throttled to once per 5 s.
* Checks every 30 s and also on `visibilitychange`, `focus` and `pageshow` (laptop sleep, restored tab) and immediately before any cloud write or load. Comparison uses `Date.now()` against the stored timestamp, so timer throttling in background tabs cannot extend the session.
* At **28 minutes** idle a banner (EN/KO/AR, RTL-aware, keyboard-focusable) says the session ends in 2 minutes, with **Stay signed in**.
* At **30 minutes**: (1) local per-account data is already saved (the tools save locally on edit); (2) `signOut({scope:'local'})`; (3) in a `finally`, remove the token key from sessionStorage even if the network call failed; (4) redirect to `Login.html?reason=idle`, which shows "You were signed out after 30 minutes of inactivity."
* Page load with `now - lastActivity > 30 min`, or a token with no `lastActivity` (a restored or duplicated tab), takes the same sign-out path **before** any cloud call.
* Unsaved edits: the local save happens first, then the data is hidden, not deleted (see 3.5), and it reappears when the same account signs in again. Nothing is lost silently; cloud saves that never happened stay local.

### 3.3 Token refresh
* Unchanged mechanism (SDK auto-refresh, rotating refresh tokens). Idle sign-out simply stops it and revokes the session.
* Optional hardening, **needs separate approval**: lower the access-token lifetime (Auth setting "JWT expiry") from the default 3600 s to about 900 s, so a copied access token dies sooner. Trade-off: more refresh calls; no user-visible change. Free-plan limits apply; it is a dashboard Auth change and is not done here.

### 3.4 Sign-out
* Manual sign-out (nav link and Login button) is unchanged except it uses `scope:'local'` so signing out in one tab does not touch the user's other tabs or devices. Idle sign-out uses the same function.
* "Sign out everywhere" (`scope:'global'`) can be offered later as a separate, explicit button.

### 3.5 Account-local browser data isolation (adapting `gg-account-guard.js`)
* The guard reads the user id from **sessionStorage** `sb-*-auth-token` instead of localStorage (small change, covered by the existing I1 to I8 tests with the simulated session moved).
* Tool data stays in localStorage but namespaced `<key>::<userId>` as today. Because identity is now per tab, two tabs signed in as A and B write to separate namespaces; the cross-tab "stale tab" case from the reported bug cannot arise from sign-in changes in another tab. The stale-tab handling stays as defence in depth.
* After idle sign-out the previous account's namespaced data stays on disk, hidden from everyone else. A shared computer still has A's local drafts on disk until A clears them; a **"Clear data stored on this device"** button on Login/sign-out is recommended for shared machines (not yet built).

## 4. Trade-offs (be explicit)

1. **Each tab needs its own sign-in.** Open a new tab by typing the address, or from a bookmark, and you are signed out there. Links opened with `target=_blank` and `noopener` start without the session; "Duplicate tab" copies it.
2. **Duplicated tabs and refresh-token reuse.** A duplicated tab shares one refresh token with the original. If both refresh, the Auth server's reuse detection can revoke the session (a 10 s reuse window exists). Expected symptom: one tab is signed out. This must be observed in staging (section 7, T9) before the decision is final. Mitigation if needed: on load, a tab whose `gg-tab-id` is missing or duplicated signs itself out locally.
3. **Closing the browser:** not a guarantee (see section 1). The guarantee is the 30-minute bound.
4. **Client-side only:** a stolen token is not stopped by the timer; only server-side limits or short JWT expiry help (Pro or needs approval).
5. **Password-recovery and e-mail-confirmation links** open in a new tab, so they work (the tab completes the flow and ends up signed in there only).
6. **Operational cost:** about 120 lines of new JS plus edits in about 10 pages; no new dependency, no paid feature, no backend change.

## 5. What would NOT change
Cloud save/load, RLS, storage rules, `_headers`, hosting, DNS, access restrictions, production Supabase. No Auth dashboard setting changes (JWT expiry is an optional, separately approved step).

## 6. Files that would change
New: `gg-auth-config.js`, `gg-idle.js`, `tests/func-session.js`, `tests/live-browser-session.js`. Edited: the 8 Cloud_Beta pages, Login and Register (use `ggAuthOptions`), `gg-account-guard.js`, `tools/build-pinned.js` and `tools/build-demo.js` (asset list), the demo stand-in (honour `storage`), `docs/ACCOUNT_ISOLATION.md`.

## 7. Test plan (nothing counts as verified without these)
* **E1 offline (fake clock):** T1 token is in sessionStorage and NOT in localStorage; T2 reload keeps the session; T3 new context (browser restart equivalent) has no session; T4 28 min shows the warning, "Stay signed in" resets the clock; T5 30 min signs out, token gone, redirect to Login with the reason; T6 a restored tab with an old `lastActivity` signs out before any cloud call; T7 unsaved local edit survives idle sign-out and returns on re-login as the same account; T8 A to B switching and the existing I1 to I8 still pass.
* **E5 live staging (CI, fictional accounts):** T9 duplicated tab: observe refresh behaviour (report only); T10 cloud save then reload then load works (own fictional row, cleaned up); T11 after idle sign-out the old refresh token no longer works (server-side revocation); T12 the existing cross-account checks L0 to L7 still pass.
* Human (E4): one pass in Chrome, Safari and a phone: close the window and reopen, "reopen closed tab", and let it idle.

## 8. Rollback
Single commit on the recovery branch; reverting restores localStorage persistence. Users simply sign in again.

## 9. Decision requested
Approve: (a) Option 1 (sessionStorage) with the 30-minute idle timer and 2-minute warning; (b) the "each tab signs in separately" trade-off; (c) building it on the recovery branch with tests T1 to T12. Separate, optional: (d) JWT expiry reduced to about 900 s (Auth setting, exact change to be approved); (e) the "Clear data stored on this device" button. Until you approve, nothing in this file is implemented.

## 10. Implementation record (2026-11-07)

### Built
* `gg-auth-config.js`: `ggAuth()`/`ggCreateClient()` force `storage = sessionStorage`; every page creates its client through `ggCreateClient` (10 pages; static test I9). Deletes legacy persistent tokens from localStorage (one-time migration; those refresh tokens stay valid on the server until used, a pilot-size risk noted below).
* `gg-idle.js`: 30 min idle / 28 min warning (EN/KO/AR, RTL, `role=alertdialog`, 44 px buttons). Stamp `gg-last-activity` in sessionStorage. A **genuine sign-in** starts the clock only if none exists (the SDK re-emits SIGNED_IN on tab focus; counting that as activity was a real flaw found by test T4d/K-RE100 and fixed). The earliest check runs in `<head>`: a restored tab with a stale or missing stamp is signed out before any page script can make a data call; its old session is handed to the Login page, which revokes it with `setSession` + `signOut({scope:'local'})`. While running: flush, `signOut({scope:'local'})` on the registered clients, remove the token, go to Login with a reason message.
* **Dead sessions.** The SDK keeps a revoked/expired-refresh session in storage and emits no SIGNED_OUT (observed). An active session is refreshed well before expiry, so a token expired for 2+ minutes means refresh failed: the tab flushes and ends cleanly ("ended" message). Test T9.
* `gg-account-guard.js` reads the user from sessionStorage; the `storage` cross-tab listener is gone because identity is now per tab. Account-local namespaces are unchanged and now also cover the new key `gaongreen-evidence-form-v1`.
* **Flush before sign-out** (`gg-flush` event; `gg-probe` for the warning): Company Settings, EPR, K-RE100, K-ISSB (main form with a dirty flag so a blank form can never overwrite a saved draft, cloud cache, evidence section), QR card, Supplier scan, Evidence Locker (text fields saved; a chosen **file cannot be saved and is named in the 28-minute warning and on the Login page**).
* Login: all sign-outs use `scope:'local'`; reason messages EN/KO/AR.
* Not touched: JWT lifetime, Auth settings, hosting, DNS, production, `main`.

### Results (offline, E2: real SDK 2.118.0 vs loopback mock, Playwright fake clock)
`tests/func-session.js`: T1 session-only + legacy token removed; T2 reload; T3a-d new context / restored stale tab (no data call, revoked) / no stamp; T4a-d warning, stay, activity, refocus; T5a-b 30-min sign-out + server revocation; T7 per tool (Company Settings, EPR, K-RE100, K-ISSB, QR, Supplier, Evidence Locker) typed-but-unsaved text survives, only in the account namespace; T7f named lost file; T8 account switch after idle; T9 dead session; T10 duplicated tab; T11 cloud save/load; T12 guard identifies the user. `tests/func-account-isolation.js` I1-I9 (I5 and I8 rewritten for per-tab sessions). `tests/live-browser-wrapper.js` validates the live scripts offline, including a negative control.
Live staging (E5) results: **pending approval of the CI run** (jobs `live`, `live-browser` incl. `tests/live-browser-isolation.js` and `tests/live-browser-session.js`).

### Remaining limitations and risks
1. **Closing the browser is not a guarantee** (session-restore; probe P3 on staging). The 30-minute stamp bounds it.
2. Client-side timer only; Supabase Free has no server-side inactivity timeout. A stolen token is not stopped. Idle sign-out revokes the refresh token on the server, but the access token stays valid up to its lifetime (staging probe P5b: data API still answers 200). Shortening the JWT lifetime is the only bound and was NOT changed (needs approval).
3. **New tab = new sign-in** (friction). Duplicated tabs share one session (staging probe P7: no revocation seen in one trial, but the dead-session path ends the tab cleanly).
4. Legacy persistent refresh tokens already issued stay valid on the server until used or revoked (pilot-size risk; no user action possible from here).
5. An unsaved FILE choice in Evidence Locker cannot be preserved (named in the warning instead).
6. An hour-long background tab with a throttled timer is judged on wake-up by the stored stamp, so it signs out on return; this is intended.
7. A page whose JS fails to load cannot run the timer (Login/Register and all tool pages load the scripts in `<head>`).
8. Fake-clock tests cannot prove behaviour on every browser's session-restore; one human pass on Chrome, Safari and a phone is still required (docs/HUMAN_TEST_FORM.md).
