# Domain Ownership Matrix (Phase 0)

| Domain | Primary owner | Backup owner | Scope | Notes |
|--------|---------------|--------------|-------|-------|
| Core Auth & Profiles | Platform | Admin squad | `profiles`, `sessions`, auth helpers | Aligns with Supabase auth policies, manages cross-cutting identity. |
| Baskets & Contributions | Marketplace | Wallet squad | `baskets`, `basket_members`, `basket_contributions`, QR flows | Consolidate duplicate join tables during Phase 1 before RLS rollout. |
| Marketplace & Venue Provisioning | Marketplace | Admin squad | `bars`, `menus`, `items`, `menu_publish` triggers | Owns dine-in onboarding, ensures data parity with admin app. |
| Mobility & Matching | Mobility | Platform | `trips`, `driver_status`, `match_*_v2` RPCs | Validate phase-out of legacy `served_*` tables after telemetry review. |
| Wallet & Promotions | Wallet | Marketing | `wallet_*`, `promo_rules`, `referral_*` tables | Requires ledger integrity checks and RLS expansion. |
| Notifications Pipeline | Platform | Admin squad | `notifications`, `claim_notifications`, edge worker | Enforce structured logging & delivery metrics before Phase 4. |
| OCR & Insurance Intake | OCR/Insurance | Platform | `ocr_jobs`, `insurance_leads`, edge OCR processor | Determine archival strategy for `insurance_media*` tables. |
| Admin Operations | Admin squad | Platform | `admin_*` tables, WA admin flows | Responsible for audit logs, RBAC, and removal of deprecated RPCs. |
| Observability & Logs | Platform | Security | `wa_events`, `webhook_logs`, logging helpers | Migrate to structured logging format; manage retention + PII scrubbing. |
| Data Warehouse & Archives | Data/Analytics | Platform | `_archive` staging, BigQuery exports | Will receive decommissioned tables during Phase 5. |
