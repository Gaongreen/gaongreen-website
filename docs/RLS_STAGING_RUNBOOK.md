# RLS isolation check – staging runbook

**Status: DRAFT. `tests/rls/rls-isolation.mjs` has never been run against real Supabase. RLS is NOT verified.**
`tests/rls-harness.js` (H1-H7, run against a local mock) only validates the suite's own logic.

## Prerequisites (you provide; I have none of these)
- A SEPARATE staging Supabase project (never `uyhmbecltrswiljbyass`, which is hard-refused).
- Two fictional users on reserved domains (e.g. `rls-a@example.com`, `rls-b@example.com`), different passwords.
- The publishable/anon key only. Never a secret or service_role key (the suite refuses it).

## Run
```
ALLOW_STAGING=yes STAGING_URL=https://<staging-ref>.supabase.co STAGING_KEY=<publishable> \
A_EMAIL=... A_PASSWORD=... B_EMAIL=... B_PASSWORD=... OUT=rls-result.json \
node tests/rls/rls-isolation.mjs
```
Exit 0 = all checks passed, 1 = a check failed (isolation gap), 2 = refused by a guard.

## Known uncertainties to resolve on first run
- Owner column per table (`company_profiles.owner_id` vs `user_id` – the K-ISSB page falls back to `user_id`).
- Request shapes are unconfirmed against the live API; a failure may be a suite defect, not a policy defect. Investigate before concluding either way.
- Also run `supabase/staging_rls_inspection.sql` (read-only) and compare policies with the results.
