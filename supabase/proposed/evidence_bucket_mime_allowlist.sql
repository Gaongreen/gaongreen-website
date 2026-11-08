-- PROPOSED, NOT APPLIED. For STAGING (gdmejzbycgpuabvutkdk) only, after approval.
-- Adds a server-side content-type allow-list to the Evidence Locker bucket. Matches the 10 extensions the app accepts
-- (pdf png jpg jpeg webp csv xlsx xls docx txt); the app now declares ONE canonical type per extension (MIME_BY_EXT), so legitimate uploads keep working.
-- Does not change policies, tables, or the existing 10 MB limit. Existing objects are unaffected (only new uploads are checked).
-- LIMITS: Supabase checks the DECLARED content type, not the file's bytes; a hostile client can lie. It blocks accidental/casual types (html, svg, js, exe) only.
-- Rollback: update storage.buckets set allowed_mime_types = null where id = 'evidence-locker';
update storage.buckets set allowed_mime_types = array['application/pdf','image/png','image/jpeg','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'] where id = 'evidence-locker';
