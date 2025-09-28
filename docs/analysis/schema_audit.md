# Schema Audit

## Core tables

- `profiles`: columns
  `[user_id, whatsapp_e164, display_name, metadata, created_at, updated_at]`,
  unique constraint on `whatsapp_e164`.
- `contacts`: `[whatsapp_e164, opted_out, last_inbound_at, created_at]`;
  STOP/START flows upsert here.
- `chat_state`: `[user_id, state_key, state jsonb, updated_at]`.
- `wa_events`: `[wa_message_id, processed_at, received_at]` for idempotency.
- `app_config`: includes admin numbers, insurance admin numbers, QR settings,
  PIN fields.

## Mobility / Trips

- `trips`: geography `pickup/dropoff` columns, generated lon/lat, CHECK
  constraints (`role`, `vehicle_type`, `status`), indexes on
  status/role/vehicle, GiST indexes on pickup/dropoff.
- `driver_status`: geography `location` + GiST index.

## Baskets

- `baskets`: additive columns (`creator_user_id`, `type`, `momo_number_or_code`,
  `join_token`, `join_token_revoked`, timestamps); uniqueness on `join_token`
  when data clean.
- `basket_members`: `(basket_id,user_id)` unique; role column present.
- `contributions`, `basket_joins` created additively.

## Marketplace / Insurance

- `businesses`: geography `location`, status check.
- `insurance_leads`: status check, assigned_admin.

## Wallet / Referrals

- `referral_links`, `referral_clicks`, `referral_attributions`, `wallets`,
  `wallet_ledger` with type check.
- `promo_rules`, `leaderboard_snapshots` (+ view), `momo_qr_requests` enriched
  columns.

## Admin / Diagnostics

- `admin_audit_log`, `admin_alert_prefs` PK guard, `admin_sessions` for PIN.

## Remaining gaps

- Ensure legacy rows comply with new checks before enabling constraints (e.g.,
  baskets status/type values) via data cleanup.
- `wallet_apply_delta` defined (20251005135000) — review triggers or views if
  ledger needed for spend caps.
