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
- The run-marker filters use PostgREST JSON syntax (`payload->>gg_rls_run=eq.<run>`). If the live API rejects it, T0 fails and that table is not tested; nothing else is affected.

## Data safety (existing account data is never overwritten or deleted)
- Every run writes a marker unique to that run (`gg-rls-test-<UTC>-<8 hex>`) into each row and object it creates. Objects live only under `<uid>/<marker>/`.
- Before the first write, all 7 tables are read for A and B. A table holding ANY row that is not from this run (real data, or a leftover of an earlier run) is reported `BLOCKED` and nothing is written to it. While the human-acceptance data (V2-V4) exists on these accounts, the tables holding it stay BLOCKED (six of the seven tables allow only one row per account, so a test row cannot sit beside real data); dedicated automation accounts are needed for full coverage.
- The suite never upserts: every write is a plain INSERT, so a row that appears after pre-flight makes the insert fail (unique owner) instead of being overwritten.
- Attacks (B's update/delete of A's row) and cleanup deletes are filtered by owner AND this run's marker. Rows of other runs are never deleted; they are reported for manual review.
- A check only counts a real HTTP response: a network error or timeout (no response) is never a PASS, including for "cannot" checks.
- Every write is registered for cleanup before it is sent, so a write whose response was lost is still removed. Cleanup runs in `finally` and on SIGINT/SIGTERM (it waits for requests already in flight), retries transient errors, and is verified by reading back; each owner/table/object group gets a `cleanup.*` result.
- Not covered: SIGKILL, a runner hard-timeout, or the host disappearing during cleanup. Leftovers then carry the run marker printed at the start of the run; remove them only by that exact marker.

## Exit codes
0 all checks passed - 1 an isolation or cleanup check FAILED - 2 refused by a guard - 3 result file could not be written (the run is unrecorded; fix OUT and rerun, this is not an isolation result) - 5 no check failed but tables were BLOCKED to protect existing data (NOT a pass) - 130 interrupted (cleanup ran).

## Offline vs staging
`npm run test:rls-offline` (loopback mock + guards) never contacts a real host. `npm run test:rls-staging` is the only command that can, and only with ALLOW_STAGING=yes and a non-production https URL.
