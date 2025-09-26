# Workflow Verification Results

| Workflow | Status | Evidence |
| --- | --- | --- |
| Nearby drivers | Completed | WA screenshots (2025-09-24 08:10Z) + Supabase `MATCHES_RESULT` log id `3f5b8d26`. |
| Schedule trip (passenger) | Completed | Structured event `MATCH_SELECTION` (`trip_id=7e02`, 2025-09-24 08:18Z) + chat link screenshot. |
| Basket create/join | Completed | `baskets` row `bkt_12f3` + `basket_joins` entry (`status=approved`) captured in snapshot 2025-09-24. |
| Marketplace approval | Completed | Admin flow recording audit `admin_marketplace_approve` (log `a7c1`) + business `status=approved`. |
| Motor insurance OCR | Completed | Storage path `insurance/ocr/2025-09-24-claim1.pdf`, `ocr_jobs.status=succeeded`, admin alert screenshot. |
| Fuel voucher issue & redeem | Pending | Issue via Admin → Vouchers; redeem at station; capture PNG, DB row, and admin notification evidence. |
| QR deep link | Completed | `/qr-resolve` request log `QR_RESOLVE_OK` (2025-09-24 07:55Z) with session mutation proof. |
| Notifications worker | Completed | `notifications` row `notif_48d2` transitioned `queued→sent` after manual worker invoke (Supabase log `NOTIFY_WORKER_DONE`). |
| Admin hub flows | Completed | Trips/Baskets/Wallet flows audited (`admin_audit_log` ids `aa_910`, `aa_911`, `aa_912`) + structured events. |
| OCR worker pipeline | In progress | `deno test --allow-env supabase/functions/ocr-processor/index.test.ts` (stubs OpenAI). |
| Mobility matching v2 | In progress | Migration `20251006162000_matching_v2_geography.sql` + runbook validation upcoming. |
| Notification queue auto-send | In progress | `deno test supabase/functions/wa-webhook/notify/sender.test.ts` (needs network) + staging cron log. |
