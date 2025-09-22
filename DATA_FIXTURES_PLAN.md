# Staging Fixture Plan

Purpose: supply safe, non-production data that exercises the Admin Panel and Station PWA screens without exposing PII.

## Entities & Counts
- **Users (10)**
  - Mix of locales (`rw-RW`, `en-MT`).
  - Fields set: `id`, `msisdn` (test range `+2507800000x`), `display_name`, `roles` array (customer, station_operator), `status` (active, blocked).
- **Stations (5)**
  - Engen-branded names and codes (`ENG-001`...`ENG-005`).
  - Include `owner_contact` pointing to fixture users with station_operator role.
  - Provide geo coordinates around Kigali for map previews.
- **Vouchers (20)**
  - Status spread: 8 issued, 7 sent, 3 redeemed, 1 expired, 1 void.
  - Link half to campaigns, half standalone; assign `station_scope` to two stations.
- **Campaigns (2)**
  - `draft` promo campaign using template `promo_generic`.
  - `running` voucher campaign issuing 2,000 RWF vouchers with a batch of 10 targets.
- **Campaign Targets (12)**
  - 10 attached to running campaign (status mix: queued, sent, delivered, failed).
  - 2 attached to draft campaign (status queued).
- **Insurance Quotes (3)**
  - Status mix: pending, approved, needs_changes.
  - Attach doc URLs pointing to placeholder storage objects (`docs/insurance/quote-*.pdf`).
- **Logs**
  - `voucher_events` covering issued, sent, redeemed transitions.
  - `audit_log` entries for voucher creation, campaign draft save, quote review actions.

## Relationships
- Each voucher references a valid `user_id`; at least five vouchers map to the same user to validate history views.
- `campaign_targets.user_id` should map to existing fixture users when possible.
- `insurance_quotes.user_id` must match users shown in the Users drawer.
- `voucher_events.station_id` should reference the station that redeemed the voucher (where applicable).

## Screen Verification Checklist
- **Dashboard**: KPIs reflect counts above; issued vs redeemed chart displays 7-day trend.
- **Users**: Drawer shows voucher history (mix of statuses) and linked insurance quotes.
- **Insurance**: Pending quote shows thumbnails, approved quote shows reviewer and timestamp.
- **Vouchers**: Filters by status and campaign produce non-empty results; preview works for vouchers with `png_url` set.
- **Campaigns**: Running campaign detail displays targets with diverse statuses; draft campaign opens in wizard.
- **Stations**: List shows all five stations, detail includes recent redemptions extracted from `voucher_events`.
- **Files**: Provide a voucher PNG, QR image, and campaign media asset for preview testing.
- **Logs**: Combined feed surfaces audit entries and voucher events with timestamps over the last 48 hours.

## Data Hygiene
- Use obviously fictitious names (`Test Bar`, `Fixture User`) and mask msisdn (never real contacts).
- Expiry dates should be in the near future (e.g., +30 days) for issued vouchers and in the past for expired ones.
- For redeemed vouchers, ensure `redeemed_at` is within the last 48 hours to show in history screens.

## Loading Strategy
- Provide SQL insert scripts or Supabase seed JSON under `supabase/seed/fixtures/` (net-new files only).
- Wrap insert scripts in transactions so the fixture load is atomic.
- Include `ON CONFLICT DO NOTHING` to keep fixture loads idempotent.
