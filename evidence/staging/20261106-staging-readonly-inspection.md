# Read-only inspection: GaonGreen Phase 3 Staging (gdmejzbycgpuabvutkdk), 2026-11-06 ~20:00 Amman
Method: Supabase connector, read-only queries only (list_tables, get_advisors, list_migrations, SELECTs on pg_policies / pg_class / storage.buckets / role_table_grants). Evidence class E5-read (real staging metadata). No writes, no migrations, production not accessed. All tables had 0 rows.

- Project status ACTIVE_HEALTHY, region ap-northeast-2, Postgres 17. One migration recorded: 20261024094250 gaon_phase3_staging_least_privilege.
- 7 public tables, RLS enabled on all 7 (not forced), 4 policies each (SELECT/INSERT/UPDATE/DELETE), role `authenticated` only, predicate `(select auth.uid()) = <owner col>`; WITH CHECK on INSERT/UPDATE.
- Owner columns: company_profiles.owner_id (uuid, UNIQUE, default auth.uid(), FK auth.users; NO user_id column; no primary key); epr/kre100/supplier drafts owner_id (PK); kissb/qr_esg drafts user_id (PK); evidence_documents user_id (+ id PK, size_bytes CHECK 0..10485760).
- Grants: only `authenticated` has DELETE/INSERT/SELECT/UPDATE on the 7 tables; `anon` and `public` have none.
- Storage: bucket `evidence-locker`, private, file_size_limit 10485760 (10 MB, enforced server-side), allowed_mime_types NULL (no server-side type restriction). storage.objects policies: SELECT, INSERT, DELETE for authenticated, restricted to bucket 'evidence-locker' and first folder = auth.uid(). No UPDATE policy (the app uses upsert:false, consistent).
- Security advisor: 1 WARN: "Leaked Password Protection Disabled" (Auth setting; enabling needs separate approval).
- Not verified: actual cross-account behaviour (tables empty, no test users; this sandbox cannot reach the Supabase API host), Auth settings (email confirmation, redirect allow-list, session lifetime, password reset).
