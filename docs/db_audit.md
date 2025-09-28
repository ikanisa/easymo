# Database Audit Snapshot

## Tables Created (Phase A/B)

- `profiles`
- `baskets`, `basket_members`, `basket_contributions`
- `businesses`
- `wallet_accounts`, `wallet_transactions`, `wallet_earn_actions`,
  `wallet_redeem_options`, `wallet_promoters`
- `momo_qr_requests`
- `insurance_media_queue`
- `admin_audit_log`, `admin_alert_prefs`, `admin_pin_sessions`,
  `admin_submissions`

## RPC Functions

- `basket_create`, `basket_join_by_code`, `basket_list_mine`,
  `basket_discover_nearby`, `basket_detail`, `basket_generate_qr`,
  `basket_close`, `basket_leave`
- `marketplace_add_business`, `nearby_businesses`
- `wallet_summary`, `wallet_transactions_recent`, `wallet_earn_actions`,
  `wallet_redeem_options`, `wallet_top_promoters`
- `insurance_queue_media`
- `admin_sub_command`, `admin_sub_list_pending`

## Indices

- `idx_basket_members_basket`
- `idx_basket_contrib_basket`
- `idx_baskets_public_status`
- `idx_businesses_active`
- `idx_wallet_tx_profile`
- `idx_wallet_earn_active`
- `idx_wallet_redeem_active`
- `idx_momo_qr_requests_requester`

## RLS / Security

- New tables rely on service role access from edge functions; RLS to be added
  once roles defined (Phase B follow-up).
- Admin audit data writable only from service role (Edge). Consider adding
  explicit RLS before customer exposure.
