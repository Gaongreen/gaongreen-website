# Evidence Locker MIME enforcement — exact proposal (STAGING ONLY, NOT APPLIED)

## Finding (live test, your run)
`storage.M2` FAIL: text/html, image/svg+xml, application/javascript were ACCEPTED by bucket `evidence-locker`. Other storage/auth checks passed (10 MB limit, tampered-JWT rejection, per-user folders).

## Verified current state (read-only query on staging gdmejzbycgpuabvutkdk, 2026-11-06)
`storage.buckets` row `evidence-locker`: public=false, file_size_limit=10485760, **allowed_mime_types = NULL** (no restriction) — this is the cause. Policies on storage.objects are unchanged and not involved.

## Supported method (Supabase docs, "Creating Buckets → Restricting uploads")
Upload restrictions (allowed MIME types, max size) are defined per bucket and enforced by Storage on upload; a non-matching upload is rejected. Equivalent ways to set it: Dashboard → Storage → bucket → Edit (Allowed MIME types), the Storage API/SDK `updateBucket({allowedMimeTypes})` (needs a service key — not used), or SQL on `storage.buckets.allowed_mime_types`. Recommended: the SQL below, applied as a recorded migration so staging history shows it.

## Exact change (one statement; touches no policy, table or the 10 MB limit)
```sql
update storage.buckets
set allowed_mime_types = array[
  'application/pdf','image/png','image/jpeg','image/webp','text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain']
where id = 'evidence-locker';
```
Suggested migration name: `evidence_bucket_mime_allowlist`. Affects only bucket `evidence-locker` on staging; existing objects are untouched; only new uploads are checked.

Before/after check (read-only): `select id, file_size_limit, allowed_mime_types from storage.buckets where id='evidence-locker';` — expect 9 types, limit 10485760.
Rollback (one line): `update storage.buckets set allowed_mime_types = null where id = 'evidence-locker';`

## Expected effect on the tests
- storage.M1 (the 9 canonical types the app uploads) stays PASS; storage.M2 (html, svg, javascript, x-msdownload, octet-stream) becomes PASS; L1 (10 MB+1) unchanged.
- App compatibility: the fixed Evidence Locker page declares ONE canonical type per extension (pdf png jpg jpeg webp csv xlsx xls docx txt = the 9 types), so legitimate uploads keep working. The OLD site/pages (browser-detected types, e.g. csv as application/vnd.ms-excel on some systems) could be rejected → the draft deploy with the fixed page must be what you test with.

## Honest limits
Storage checks the DECLARED Content-Type header, not the file's bytes. A client that lies (an HTML file declared as application/pdf) is not stopped by this. Mitigations already in place: bucket is private, objects readable only by their owner via authenticated/signed access, never served from the site origin. Content scanning would be a separate, later control.

## Suggested order after you approve
1. I run the single statement on staging (staging project only), then the read-only check.
2. You rerun `tools/staging-validate-all.sh …` — M1/M2/L1 and the draft deploy (it only deploys if RLS/storage pass).
3. Human check: upload each of the 10 file types on the draft; if any is rejected, run the rollback line and tell me which.
