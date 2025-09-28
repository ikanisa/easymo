# Gaps & Follow-up Plan

| Priority | Gap | Plan |
| --- | --- | --- |
| P0 | Basket RPCs require RLS and usage throttles | Define policies for owner/member roles; add rate limiter via triggers. |
| P0 | Wallet data currently seeded with demo records | Backfill from production ledger before go-live; add authorization guard. |
| P1 | Admin alert preferences not surfaced in UI | Wire into admin hub settings panel. |
| P1 | Insurance OCR queue lacks processor | Implement background worker to poll `insurance_media_queue` (Phase C extension). |
| P2 | Observability dashboards missing | Hook Supabase log drains and CloudWatch metrics. |
| P3 | QuickChart dependency no SLA | Evaluate self-hosted QR generation. |
