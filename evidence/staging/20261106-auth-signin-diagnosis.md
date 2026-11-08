# Staging sign-in failure diagnosis (read-only; 2026-11-06 ~22:22 Amman)
Project gdmejzbycgpuabvutkdk (Phase 3 Staging). No passwords requested, nothing modified.
- auth.users: customer-a@ and customer-b@example.test both exist, email confirmed, banned_until NULL, deleted_at NULL, not SSO, not anonymous, password set, provider email.
- Successful logins (HTTP 200) for BOTH accounts at 18:59:50/52Z (your earlier run) → email/password auth is enabled and works on this project.
- Failures: 400 at 18:50:37Z and 19:22:10Z; auth log error_code=invalid_credentials ("400: Invalid login credentials"), exactly one attempt in the latest run (account A) — consistent with a wrong email/password typed at the prompt. Not banned/unconfirmed/disabled-provider errors.
- Endpoint: the failing request is in THIS project's auth log (/token, grant_type=password) → the script targets the right staging project.
- Not verifiable via connectors: the password itself, and the Auth provider toggles (inferred enabled from the 200s).
