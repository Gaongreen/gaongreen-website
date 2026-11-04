-- READ-ONLY inspection for a STAGING project. Makes no changes.
select schemaname, tablename, rowsecurity from pg_tables
 where schemaname='public' order by tablename;
select schemaname, tablename, policyname, cmd, roles, qual, with_check
  from pg_policies where schemaname in ('public','storage') order by 1,2,3;
select table_name, column_name from information_schema.columns
 where table_schema='public' and column_name in ('owner_id','user_id') order by 1,2;
select id, name, public from storage.buckets;
