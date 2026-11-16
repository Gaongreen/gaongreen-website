# Evidence Locker MIME allow-list APPLIED to staging (authorized 2026-11-06 22:15 Amman)
- Project verified before: gdmejzbycgpuabvutkdk "GaonGreen Phase 3 Staging", ACTIVE_HEALTHY, ap-northeast-2. Not production.
- Before: evidence-locker public=false, file_size_limit=10485760, allowed_mime_types=NULL; policies (public+storage)=31; migrations: 20261024094250 only.
- Applied as recorded migration `evidence_bucket_mime_allowlist`, version **20261106191620**, the exact approved statement (single UPDATE on storage.buckets where id='evidence-locker'). Result: success, no errors.
- After: public=false, file_size_limit=10485760, allowed_mime_types = the 9 approved types (cardinality 9), policies=31 (unchanged), buckets=1. No Auth/RLS/other-table change.
- Rollback (not executed): update storage.buckets set allowed_mime_types = null where id='evidence-locker';
- NOT yet verified: live storage.M1/M2/L1 re-run and the 10-file-type human upload test.
