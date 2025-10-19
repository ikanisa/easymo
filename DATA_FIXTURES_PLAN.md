# Staging Fixture Plan

Purpose: supply safe, non-production data that exercises the Admin Panel and
Station PWA screens without exposing PII.

## Entities & Counts

- **Users (10)**
  - Mix of locales (`rw-RW`, `en-MT`).
  - Fields set: `id`, `msisdn` (test range `+2507800000x`), `display_name`,
    `roles` array (customer, station_operator), `status` (active, blocked).
- **Stations (5)**
  - Engen-branded names and codes (`ENG-001`...`ENG-005`).
  - Include `owner_contact` pointing to fixture users with station_operator
    role.
  - Provide geo coordinates around Kigali for map previews.
- **Vouchers (20)**
  - Status spread: 8 issued, 7 sent, 3 redeemed, 1 expired, 1 void.
  - Link half to campaigns, half standalone; assign `station_scope` to two
    stations.
- **Campaigns (2)**
  - `draft` promo campaign using template `promo_generic`.
  - `running` voucher campaign issuing 2,000 RWF vouchers with a batch of 10
    targets.
- **Campaign Targets (12)**
  - 10 attached to running campaign (status mix: queued, sent, delivered,
    failed).
  - 2 attached to draft campaign (status queued).
- **Insurance Quotes (3)**
  - Status mix: pending, approved, needs_changes.
  - Attach doc URLs pointing to placeholder storage objects
    (`docs/insurance/quote-*.pdf`).
- **Logs**
  - `voucher_events` covering issued, sent, redeemed transitions.
  - `audit_log` entries for voucher creation, campaign draft save, quote review
    actions.
- **Agent-Core Tenant (1)**
  - ID `a4a8cf2d-0a4f-446c-8bf2-28509641158f` matching the defaults in `.env`.
  - Countries array `["RW","MT"]` to exercise multi-region logic.
- **Agent Configs (3)**
  - Broker, support, and marketplace assistants with distinct prompts, tool
    chains, and policy JSON.
- **Leads (18)**
  - Mix of opt-in/opt-out statuses, locales (`en`, `rw`), and tags
    (`["pilot","kw"]`, `["high-value"]`). Ensure at least four leads share a
    tenant + tag combination to demo filtering.
- **Opt-Out Registry (6)**
  - Include both WhatsApp and voice entries (`reason` hints like `manual_block`,
    `regulatory_optout`).
- **Calls (12)**
  - Spread across `inbound`/`outbound`, `pstn`/`sip`, assorted durations, and
    with/without linked leads. Half should include dispositions (`no_answer`,
    `handoff`, `converted`).
- **Wallet Accounts (6)**
  - Platform, commission, two vendors, two buyers. Prefill balances to showcase
    statement math.
- **Wallet Transactions / Entries (10)**
  - Double-entry postings for intent reservations, completed purchases, refunds,
    and commission sweeps. Include at least one failed purchase to drill the
    reversal helpers.
- **Commission Schedules (2)**
  - Percent + flat fee combinations so the ranking service can resolve
    effective commissions.
- **Vendors (6)**
  - Regions (`Kigali`, `Musanze`, `Kirehe`), categories arrays (bike, car,
    delivery), SLA metrics (response ms, fulfilment rate) to seed ranking data.
- **Buyers (4)**
  - Segment mix (`enterprise`, `retail`), wallet linkage for payouts.
- **Marketplace Intents (8)**
  - Status mix: pending, matched, expired, cancelled. Payload JSON should
    include pickup/dropoff coordinates and trip metadata.
- **Quotes (14)**
  - At least three accepted, the rest pending/rejected/expired. Provide varied
    pricing for ranking comparisons.
- **Purchases (5)**
  - Completed, pending, cancelled, failed, with timestamps to validate ledger
    reconciliation.

## Relationships

- Each voucher references a valid `user_id`; at least five vouchers map to the
  same user to validate history views.
- `campaign_targets.user_id` should map to existing fixture users when possible.
- `insurance_quotes.user_id` must match users shown in the Users drawer.
- `voucher_events.station_id` should reference the station that redeemed the
  voucher (where applicable).

## Screen Verification Checklist

- **Dashboard**: KPIs reflect counts above; issued vs redeemed chart displays
  7-day trend.
- **Users**: Drawer shows voucher history (mix of statuses) and linked insurance
  quotes.
- **Insurance**: Pending quote shows thumbnails, approved quote shows reviewer
  and timestamp.
- **Vouchers**: Filters by status and campaign produce non-empty results;
  preview works for vouchers with `png_url` set.
- **Campaigns**: Running campaign detail displays targets with diverse statuses;
  draft campaign opens in wizard.
- **Stations**: List shows all five stations, detail includes recent redemptions
  extracted from `voucher_events`.
- **Files**: Provide a voucher PNG, QR image, and campaign media asset for
  preview testing.
- **Logs**: Combined feed surfaces audit entries and voucher events with
  timestamps over the last 48 hours.
- **Live Calls**: `/live-calls` shows current sessions, matches opt-outs when
  applicable, and surfaces disposition history.
- **Leads**: `/leads` list filters by tag/opt-in, CSV export includes agent-core
  metadata, and inline updates persist via Agent-Core APIs.
- **Marketplace**: `/marketplace` summary charts ranking weights, intents,
  quotes and ledger movements; verify acceptance tests cover these fixtures.
- **Observability**: Import `dashboards/phase4/voice_bridge.json` and
  `dashboards/phase4/messaging_overview.json` into Grafana. Create Kafka topics
  defined in `infrastructure/kafka/topics.yaml` so the dashboards have data to
  query.

## Data Hygiene

- Use obviously fictitious names (`Test Bar`, `Fixture User`) and mask msisdn
  (never real contacts).
- Expiry dates should be in the near future (e.g., +30 days) for issued vouchers
  and in the past for expired ones.
- For redeemed vouchers, ensure `redeemed_at` is within the last 48 hours to
  show in history screens.

## Loading Strategy

- Provide SQL insert scripts or Supabase seed JSON under
  `supabase/seed/fixtures/` (net-new files only). Use
  `supabase/seed/fixtures/admin_panel_core.sql` for the baseline profiles,
  subscriptions, settings, driver presence, and trips required by the Admin
  Panel, and `supabase/seed/fixtures/admin_panel_marketing.sql` for campaigns,
  vouchers, voucher events, orders, and insurance leads.
- Agent-Core preview data lives in the Prisma seed at `packages/db/src/seed.ts`.
  Run it after migrations with `pnpm --filter @easymo/db seed` to materialise
  tenants, agent configs, and pilot leads.
- Wallet and marketplace fixtures also come from the Prisma seed; rerun it after
  adjusting balances or commission rates so double-entry invariants stay in sync.
- Acceptance tests expect Kafka topics to exist; use `infrastructure/kafka/topics.yaml`
  alongside `docker-compose.agent-core.yml` before running suites locally.
- Wrap insert scripts in transactions so the fixture load is atomic.
- Include `ON CONFLICT DO NOTHING` to keep fixture loads idempotent.
