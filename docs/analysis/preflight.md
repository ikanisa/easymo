# easyMO Preflight Summary

- Supabase CLI: `2.40.7`
- Matching RPCs: `match_drivers_for_trip_v2`, `match_passengers_for_trip_v2` deployed.
- Admin PIN cache: `admin_sessions` table present.
- Notification retry columns: `retry_count`, `next_attempt_at` added.
- Required Edge Functions (local ready):
  - `wa-webhook`
  - `flow/exchange`
  - `notification-worker`
  - `qr-resolve`
- Function secrets required:
  - `WA_TOKEN`, `WA_PHONE_ID`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `QR_TOKEN_SECRET`
- Storage buckets confirmed: `menu-source-files`, `insurance-docs`
- `app_config` row (id=1) includes admin numbers, insurance admin numbers, PIN flags, and QR config.

Preflight complete.
