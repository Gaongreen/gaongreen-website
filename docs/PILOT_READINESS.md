# Pilot readiness — consolidated evidence and prioritized checklist (2026-11-07, commit 9633517)

## Evidence so far
| Area | Evidence | Class |
|---|---|---|
| Server isolation (7 tables, Storage, forged JWT, MIME allow-list, 10 MB) | GitHub Actions runs 42373067701 and 42374091760: 75/75 on Phase 3 Staging, fictional accounts | E5 live |
| Cloud save/load per account, A cannot read B's drafts, Evidence Locker upload/open, switch to A shows 0 of B's documents | Manual browser test on the Netlify draft (Marina, 2026-11-07) | E4 human |
| Browser-local isolation (company settings, 8 stored keys, 2 IndexedDB DBs, stale tabs, rapid flips) | tests/func-account-isolation.js I1-I8, offline browser with SIMULATED sessions; passes in CI (offline job) | E1 |
| Offline suite | 281 checks (mock/stand-in) | E1-E3 |
| Auth settings, response headers on the deployed draft, production Supabase | NOT verified | — |

## P0 — must be true before ANY customer pilot
1. **Local-data isolation proven with real sessions (the original bug).** The manual results cover cloud data only. Repeat: A saves a company name in Company Settings -> sign out -> B: dashboard and Company Settings show none -> back to A: restored. In the browser console while signed in run `ggAccountGuard.sessionUser()`: it must print that user's id (A=450cf5fb-..., B=e899067f-...). If it prints null the guard cannot see the real SDK session and is NOT protecting (tests used a simulated record). [Marina, 5 min]
2. **Public reachability / production host decision.** The Netlify site requires team SSO for ALL contexts (customers could not open it). The live gaongreen.com site is on GitHub Pages, which cannot send security headers (no _headers). Decide: (a) host the pilot on Netlify with a custom domain and public access (a site-settings change only Marina can approve), or (b) stay on GitHub Pages and accept meta-CSP only (no X-Frame-Options/frame-ancestors/HSTS control). Recommended: (a). [Marina decision, then Claude prepares]
3. **Production Supabase parity.** Never inspected. Needs explicit approval for READ-ONLY inspection of uyhmbecltrswiljbyass: same 7 tables, RLS, grants, storage bucket config (MIME allow-list is staging-only), auth settings, advisors. Any production change = separate exact-change approval. Pages must be rebuilt with the production URL/key (tool refuses by default). [Marina approval; Claude does the read-only diff]
4. **Auth configuration (not readable via connectors; read in Supabase dashboard > Authentication).** Confirm and report: email confirmation REQUIRED for new sign-ups (fictional users were pre-confirmed); Site URL + redirect allow-list = only the real pilot origin(s); JWT expiry and refresh-token rotation/reuse interval; sign-up open vs invite-only for the pilot; anonymous sign-ins OFF; rate limits (sign-in, sign-up, email); custom SMTP configured (built-in mail is heavily rate-limited, unsuitable for confirmation/reset mails); password policy (proposed: min 12 + lower/upper/digit; needs approval, check existing accounts); consider CAPTCHA. Then test sign-up -> confirm -> sign-in, and password reset end to end with a real mailbox. [Marina reads settings; Claude proposes exact changes]
5. **Session handling decision (PA-001).** Sessions persist in localStorage (persistSession:true) across browser restarts: convenient, but a token theft (XSS, shared PC) lasts until refresh-token expiry. Mitigations present: CSP with no remote scripts, pinned/SRI SDK. Decide persistent vs session-only (+ idle timeout). Add live test: after sign-out the old refresh token is rejected; behaviour on expired/revoked session. [Marina decision; Claude implements/tests]

## P1 — before pilot goes beyond a few trusted users
6. **Security headers verified on the real deployed origin** (browser DevTools > Network > response headers on index and one app page): CSP, X-Frame-Options DENY, nosniff, HSTS, Referrer-Policy, Permissions-Policy, COOP. tools/check-headers.js cannot pass the SSO wall; run it after item 2(a). Known weakness: style-src 'unsafe-inline' on every page (low risk, tidy later).
7. **File validation depth.** Present: private bucket, owner-folder policies, server MIME allow-list (declared type), 10 MB cap, client extension check, ASCII-safe storage path + UUID folder, downloads as blob (never rendered inline). Gaps: no magic-byte check, no malware scanning, no per-user storage quota (free plan storage is shared: abuse could exhaust it). Test Korean/Arabic filenames (stored path is sanitized; the display name keeps the original). Add per-user quota/rate limit before open sign-up.
8. **Browser matrix:** Safari iOS/macOS (storage in private mode, IndexedDB), Firefox, Edge, mobile Chrome; RTL layout with Arabic on all six tools; keyboard + screen reader pass.
9. **Operational:** error monitoring/alerts, Supabase log retention, backup/export procedure (free plan has no managed backups), incident contact, rollback plan (docs/RELEASE_CANDIDATE.md), data-protection notice/consent for customer data (Korean PIPA), terms.

## P2 — hardening
Leaked-password protection (Pro plan only; advisor WARN stays); content scanning; Evidence Locker local IndexedDB encryption or removal; remove unused local-only code paths; finish localization leftovers (demo banner only); CSP without unsafe-inline.

## Who does what
- Claude (no approval needed): items 1 test automation, 5/7 implementation once decided, 6 checker, 8 automation where possible, docs.
- Needs Marina: 1 (browser check), 2, 3 (approval), 4 (read dashboard), 5, 6 (headers screenshot), 9.
