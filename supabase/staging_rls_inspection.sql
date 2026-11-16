-- READ-ONLY inspection for a STAGING project. Makes no changes.
select schemaname, tablename, rowsecurity from pg_tables
 where schemaname='public' order by tablename;
select schemaname, tablename, policyname, cmd, roles, qual, with_check
  from pg_policies where schemaname in ('public','storage') order by 1,2,3;
select table_name, column_name from information_schema.columns
 where table_schema='public' and column_name in ('owner_id','user_id') order by 1,2;
select id, name, public from storage.buckets;

-- ---- additional READ-ONLY checks (still no changes). Run on STAGING only; paste the output into the validation record. ----
-- A. The 7 app tables: is RLS enabled AND forced? (expect rowsecurity = true for every one)
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
   and c.relname in ('company_profiles','kissb_drafts','kre100_drafts','epr_drafts','supplier_esg_drafts','qr_esg_drafts','evidence_documents')
 order by 1;
-- B. Any public table with RLS enabled but NO policy (=> nobody can read, usually a bug) or RLS disabled (=> exposed through the publishable key)
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policy_count
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
   and (not c.relrowsecurity or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname))
 order by 1;
-- C. Policies that grant to anon or use a constant-true predicate (review each by hand)
select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies
 where schemaname in ('public','storage')
   and ('anon' = any(roles) or 'public' = any(roles) or qual = 'true' or with_check = 'true')
 order by 1,2,3;
-- D. Storage: bucket privacy, size limit and MIME allow-list (the app's 10 MB / extension limits are CLIENT-SIDE only)
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
-- E. Storage policies on storage.objects (should scope access by the owner's uid in the object path)
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname='storage' and tablename='objects' order by 1;
