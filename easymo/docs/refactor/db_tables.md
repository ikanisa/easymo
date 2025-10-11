# Database Table Inventory (Phase 1)

Legend: `CORE` (keep), `LEGACY` (needs validation), `DUPLICATE?` (likely
overlap), `QUEUE` (transient), `LOG` (append-only).

## Core Domains

- **bars**, **bar_settings**, **bar_tables**, **bar_numbers**,
  **station_numbers** — `CORE`
  - Owners: Marketplace / Venue provisioning.
  - Actions: ensure RLS consistent, confirm `station_numbers` still used by
    station app.
- **menus**, **categories**, **items**, **item_modifiers**, **published_menus**
  — `CORE`
  - Actions: document menu versioning strategy (`menu_items_snapshot`).
- **orders**, **order_items**, **order_events** — `CORE`
  - Actions: confirm triggers `orders_set_defaults`, `set_updated_at` adequate;
    add tests.
- **notifications** — `CORE`
  - Actions: now using `claim_notifications`; add retention policy +
    partitioning? revisit `send_queue`/`send_logs` duplication.
- **wallet_accounts**, **wallet_transactions**, **wallet_ledger**, **wallets**,
  **wallet_promoters**, **wallet_redemptions**, **wallet_redeem_options**,
  **wallet_earn_actions** — `CORE`
  - Actions: consolidate wallet summary views; align function names.
- **momo_qr_requests**, **insurance_leads**, **ocr_jobs** — `CORE`
  - Actions: ensure storage buckets exist (migration added), evaluate
    `insurance_media*` tables for merge.
- **profiles**, **chat_state** — `CORE`
  - Observations: 17 active rows; cornerstone identity record with enforced RLS
    and FK coverage.
  - Actions: reinforce as golden profile; expand metadata contract in Phase 1
    naming guide.
- **contacts** — `CORE`
  - Observations: 5 marketing opt-in rows, no FK to `profiles`.
  - Phase 1: add nullable `profile_id` FK + backfill by `whatsapp_e164`, then
    enforce `UNIQUE (profile_id)` (migration `20251010100000`).
- **sessions**, **chat_sessions** — `LEGACY`
  - Status: 0 rows each; replace with `chat_state` before archival.

## Mobility / Matching

- **trips**, **driver_status**, **mobility_pro_access** — `CORE`
  - Actions: ensure indices on `status`, `vehicle_type`, and `pickup`. Verified
    new RPC returns `matched_at`.
- **served_drivers**, **served_passengers**, **drivers_available**,
  **passengers_requests** — `LEGACY`
  - Observations: ≤6 total rows, unused in edge/app code.
  - Phase 1: archived to `_archive` via `20251010101000`; export remaining
    history before final drop.
- **recent_drivers_near** (function), **nearby_drivers** tables — check if
  derivative; may be redundant once flows rely on RPC.

## Baskets / Contributions

- **baskets**, **basket_members**, **basket_contributions** — `CORE`
  - Observations: 5 baskets, 1 membership row; contributions schema ready but
    empty.
  - Phase 1: use `basket_members` as canonical membership; finalize contribution
    columns (`amount_minor` normalized by `20251010100000`).
- **_archive.basket_joins**, **_archive.contributions** — `LEGACY`
  - Status: 0 rows; `basket_join_by_code` now inlines rate limiting (see
    `20251010102000`). Drop after retention window.

## Marketplace / Businesses

- **businesses**, **marketplace_categories**, **marketplace** flows — `CORE`
  - `shops` table? `LEGACY` — verify if still used by admin/station.
- **segments**, **campaigns**, **campaign_recipients** — marketing domain,
  `CORE`.
- **promo_rules**,
  **referral_*`tables —`CORE`but confirm duplicates:`referral_clicks`,`referral_links`,`referral_attributions`.

## Messaging / Audit / Logs

- **wa_events** — idempotency, `CORE`.
- **wa_inbox**, **wa_inbound**, **webhook_logs** — `LOG`; confirm retention
  policies.
- **admin_audit_log**, **audit_log** — potential overlap. Determine if both
  required; `admin_audit_log` likely WA admin-specific, keep but document.
- **send_queue**, **send_logs**, **flow_submissions** — older pipeline? evaluate
  vs new notifications queue.

## Insurance / OCR

- **insurance_media**, **insurance_media_queue** — `LEGACY?`
  - If `insurance_leads` + storage bucket cover use case, consider archiving.

## Leaderboard / Gamification

- **leaderboard_notifications**, **leaderboard_snapshots**,
  **leaderboard_snapshots_v** — `LEGACY?` confirm if wallet still uses these;
  likely deprecate or move to analytics.

## Geography Support (PostGIS)

- **spatial_ref_sys**, **geography_columns**, **geometry_columns** — managed by
  PostGIS; keep.

## Candidate Duplicates / Unused (Phase 1 status)

- **contacts** vs `profiles` contact info — unify by linking to `profiles` and
  enforcing per-profile uniqueness (migration `20251010100000`).
- **sessions** / **chat_sessions** vs `chat_state` — deprecate sessions tables
  once WA runtime confirms migration.
- **contributions** vs `basket_contributions` — archived legacy table; monitor
  until retirement window closes.
- **passengers_requests** & **drivers_available** vs `trips` — archived; export
  to warehouse before drop.
- **served** tables_* — archived; plan analytics replacement or enrich `trips`
  audit columns.

## Next Steps

1. Usage scans captured in `docs/refactor/phase1/consolidation_audit.md`
   (2025-09-25 snapshot).
2. Prepare migration scripts with backup strategy (copy to `_archive` schema)
   and update naming guide.
3. Update ERD after consolidation.
