# Live staging tests in GitHub Actions (staging only)

Workflow: `.github/workflows/live-staging-tests.yml` — runs on every push to `recovery/lead-eng-2afe977` (and on demand). Two jobs:
- **live** (uses secrets): sign-in as the two fictional accounts, RLS isolation, Storage ownership, MIME allow-list (M1/M2), 10 MB limit, tampered-JWT rejection — via `tools/ci-live-staging.sh` → `tools/run-live-rls.sh --mime`. Staging project only (production host and secret keys are refused by the code).
- **offline** (no secrets): headless-browser regression incl. account isolation (I1–I8), localization, and the orchestration/wrapper tests.

## One-time setup (you enter the passwords only here, never in chat or the repo)
1. Open **https://github.com/Gaongreen/gaongreen-website/settings/environments** → *New environment* → name exactly `staging-live-tests`.
2. In that environment: **Deployment branches and tags** → *Selected branches and tags* → add `recovery/lead-eng-2afe977`. (Prevents any other branch from ever receiving the secrets.)
3. Same page → **Environment secrets** → *Add secret* twice:
   - `STAGING_CUSTOMER_A_PASSWORD` = password of customer-a@example.test
   - `STAGING_CUSTOMER_B_PASSWORD` = password of customer-b@example.test
4. Recommended: tick **Required reviewers** and add yourself. Reason: anyone who can push to the recovery branch (including me through the Claude GitHub App) can edit the workflow, and without a reviewer a changed workflow could run with the secrets. With a reviewer, each run waits for your one-click approval (Actions → run → *Review deployments*). You can switch it off later once you accept that trade-off.
Do steps 1–2 BEFORE step 3. (If the environment does not exist yet, the first run creates it empty; with no secrets the live job just refuses safely.)
Repository-level secrets (https://github.com/Gaongreen/gaongreen-website/settings/secrets/actions) also work but are not branch-restricted — use the environment.

## What is and is not exposed
- GitHub masks secrets in logs; in addition the script never prints raw test output: it prints only an allow-listed summary (step result, check ids/names, scrubbed failure details) and runs a leak detector over it (passwords, tokens, long strings, paths) that withholds the summary if anything matches.
- The repository is PUBLIC, so run logs/summaries are readable by anyone. The summary contains no credentials, but it does show test names/results and the staging host. Making the repository private would hide that.
- No `pull_request`, `pull_request_target` or `schedule` trigger exists, so forks and other branches cannot reach the secrets. Actions are pinned to commit SHAs; permissions are `contents: read`.
- To rotate/revoke: change the password in Supabase staging and update the secret; deleting the environment removes the secrets.

## Reading results
Actions tab → "Live staging tests" → latest run → job summary (RESULT: PASS / FAIL with the failing check ids). Exit 2 = secrets missing; "sign-in rejected" = the secrets do not match the staging accounts.
