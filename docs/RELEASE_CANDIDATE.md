# GaonGreen release candidate — checklist, rollback, production-readiness (status 2026-11-06)

Branch `recovery/lead-eng-2afe977` → PR #1 (draft, base `main`). NOT merged. NOT deployed to production.

## Gate status
| Gate | Status | Evidence |
|---|---|---|
| Offline suite (231 checks, mock/stand-in) | PASS | evidence/runs/20261106-run24-real-sdk-smoke |
| Real SDK 2.118.0 vendored, hashes/lockfile consistent | PASS (registry bytes unverifiable here) | docs/STAGING_DECISIONS.md |
| Staging build targets only Phase 3 Staging | PASS (guard) | tools/staging-draft-deploy.sh |
| Live auth + RLS isolation + storage (real staging) | **OPEN** | needs `tools/staging-validate-all.sh` |
| Evidence MIME fix works on staging for 10 types | **OPEN** | human test, then approve SQL |
| Draft deploy on Netlify, headers verified | **OPEN** | needs your Netlify CLI login (sandbox cannot reach Netlify; connector cannot make drafts) |
| Human browser tests (docs/HUMAN_TEST_FORM.md) | **OPEN** | none recorded |
| Auth settings (confirmations, redirects, session lifetime, password policy) | **OPEN, needs your approval** | unreadable via connectors |
| Persisted-session decision (PA-001) | **OPEN** | your call |

## Single procedure that needs you
`bash tools/staging-validate-all.sh <A@example.com> <B@example.com> --keep-file <validate-backup-only.html>`
Runs: offline suite → real-SDK staging build → deploy guard → live RLS/storage/MIME (silent password prompts) → DRAFT deploy (only if live RLS passed) → one tgz to send back. Then do the human form on the draft URL.

## Exact production changes (to be confirmed after live validation)
1. Merge PR #1 into `main` (code only: 6 tools, gg-nav/gg-l10n, vendored SDK, tools/tests/docs).
2. Production build with the PRODUCTION project URL + publishable key via `tools/build-pinned.js --target-url … --target-key …` (production host refusal must be lifted explicitly by you; the tool refuses it by default).
3. Production Supabase: NO schema/policy change unless the production inspection (read-only) shows divergence from staging; MIME SQL and password policy only with separate approval.
4. Deploy `dist-pinned` to the production Netlify context.

## Deployment checklist
- [ ] live RLS result all PASS (incl. storage.M1/M2/L1) · [ ] 10 file types upload on draft · [ ] human form signed
- [ ] check-headers passes on deployed URL · [ ] no fixture file / production ref in staging pack
- [ ] production inspection compared with staging (read-only) · [ ] your explicit final authorization

## Rollback plan
- Site: Netlify → Deploys → "Publish deploy" on the previous deploy (current: 6adf6e4d0e82082a49c6f086, contains validate-backup-only.html). Draft deploys never replace it.
- Code: revert the merge commit on `main` (no history rewrite).
- Database: no DB change is part of this release; if MIME SQL is later applied, rollback is the one-line UPDATE in `supabase/proposed/evidence_bucket_mime_allowlist.sql`.
