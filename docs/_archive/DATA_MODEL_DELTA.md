# Data Model Delta (Additive-Only)

This document describes the additive database structures required for the Admin
Panel and Station PWA. Existing tables remain untouched; all changes are new
tables, columns, or indexes delivered through timestamped migrations.

## New Tables

### `admin_roles`

- `user_id UUID PK` references `auth.users`.
- `roles TEXT[]` (e.g., `{"super_admin","support","data_ops","readonly"}`).
- `granted_by UUID` (admin who granted role).
- `granted_at TIMESTAMPTZ DEFAULT now()`.

### `stations`

- `id UUID PK DEFAULT gen_random_uuid()`.
- `name TEXT NOT NULL`.
- `engencode TEXT UNIQUE NOT NULL`.
- `owner_contact TEXT` (E.164 msisdn).
- `location GEOGRAPHY(Point, 4326)` nullable.
- `status TEXT CHECK (status IN ('active','inactive')) DEFAULT 'active'`.
- `created_at TIMESTAMPTZ DEFAULT now()`.
- `updated_at TIMESTAMPTZ DEFAULT now()` triggers.

### `vouchers`

- `id UUID PK DEFAULT gen_random_uuid()`.
- `user_id UUID NOT NULL` references `users.id`.
- `station_scope UUID NULL` references `stations.id`.
- `campaign_id UUID NULL` references `campaigns.id`.
- `amount NUMERIC(12,2) NOT NULL`.
- `currency TEXT NOT NULL DEFAULT 'RWF'`.
- `code5 CHAR(5) UNIQUE NOT NULL`.
- `qr_url TEXT`.
- `png_url TEXT`.
- `status TEXT CHECK (status IN ('issued','sent','redeemed','expired','void')) NOT NULL DEFAULT 'issued'`.
- `issued_at TIMESTAMPTZ DEFAULT now()`.
- `redeemed_at TIMESTAMPTZ`.
- `expires_at TIMESTAMPTZ`.
- `created_by UUID` references `auth.users`.
- `metadata JSONB DEFAULT '{}'::jsonb`.
- Indexes: `(status)`, `(user_id)`, `(campaign_id)`, `(station_scope,status)`.

### `voucher_events`

- `id UUID PK DEFAULT gen_random_uuid()`.
- `voucher_id UUID NOT NULL` references `vouchers.id`.
- `event_type TEXT CHECK (event_type IN ('issued','sent','redeemed','expired','void','policy_blocked'))`.
- `actor_id UUID NULL` references `auth.users`.
- `station_id UUID NULL` references `stations.id`.
- `context JSONB DEFAULT '{}'::jsonb` (quiet hour reason, EF response, etc.).
- `created_at TIMESTAMPTZ DEFAULT now()`.
- Indexes: `(voucher_id, created_at)`, `(event_type, created_at DESC)`.

### `campaigns`

- `id UUID PK DEFAULT gen_random_uuid()`.
- `legacy_id BIGINT` retained for historical references (read-only mirror of legacy ids).
- `name TEXT NOT NULL`.
- `type TEXT CHECK (type IN ('promo','voucher')) NOT NULL`.
- `template_id TEXT NOT NULL`.
- `status TEXT CHECK (status IN ('draft','running','paused','done')) DEFAULT 'draft'`.
- `created_by UUID REFERENCES auth.users`.
- `started_at TIMESTAMPTZ`.
- `finished_at TIMESTAMPTZ`.
- `metadata JSONB DEFAULT '{}'::jsonb` (quiet hours override, throttle bucket).
- Indexes: `(status)`, `(created_at)`.

### `campaign_targets`

- `id UUID PK DEFAULT gen_random_uuid()`.
- `campaign_id UUID REFERENCES campaigns(id)`.
- `msisdn TEXT NOT NULL`.
- `user_id UUID NULL REFERENCES users(id)`.
- `personalized_vars JSONB DEFAULT '{}'::jsonb`.
- `status TEXT CHECK (status IN ('queued','queued_throttled','sent','delivered','read','failed','opted_out')) DEFAULT 'queued'`.
- `error_code TEXT`.
- `message_id TEXT`.

### `agent_chat_sessions`

- `id UUID PK DEFAULT gen_random_uuid()`.
- `profile_id UUID NULL REFERENCES profiles(user_id)` for driver/customer linkage.
- `agent_kind TEXT NOT NULL` (`broker`, `support`, `sales`, `marketing` previews).
- `status TEXT NOT NULL DEFAULT 'open'`.
- `metadata JSONB DEFAULT '{}'::jsonb`.
- `last_user_message TEXT`, `last_agent_message TEXT`.
- `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`.
- RLS enabled with a deny-all policy (service role bypass only).

### `agent_chat_messages`

- `id UUID PK DEFAULT gen_random_uuid()`.
- `session_id UUID REFERENCES agent_chat_sessions(id) ON DELETE CASCADE`.
- `role TEXT CHECK (role IN ('user','agent','system'))`.
- `content JSONB NOT NULL` (stores message body and stub metadata).
- `created_at TIMESTAMPTZ DEFAULT now()`.
- Indexed by `(session_id, created_at)` for chronological retrieval.
- `last_update_at TIMESTAMPTZ DEFAULT now()`.
- Indexes: `(campaign_id,status)`, `(msisdn)`.

### `insurance_quotes`

- `id UUID PK DEFAULT gen_random_uuid()`.
- `user_id UUID REFERENCES users(id)`.
- `uploaded_docs TEXT[]` (storage paths).
- `premium NUMERIC(12,2)`.
- `insurer TEXT`.
- `status TEXT CHECK (status IN ('pending','approved','needs_changes')) DEFAULT 'pending'`.
- `reviewer_comment TEXT`.
- `approved_at TIMESTAMPTZ`.
- `metadata JSONB DEFAULT '{}'::jsonb` (OCR snapshots).

### `settings`

- `key TEXT PRIMARY KEY`.
- `value JSONB NOT NULL`.
- Seed keys include:
  - `quiet_hours`:
    `{ "rw": { "start": "22:00", "end": "06:00" }, "mt": { ... } }`
  - `send_throttle`: `{ "whatsapp": { "per_minute": 60 } }`
  - `opt_out_list`: `["hash1", "hash2"]`
  - `templates`: array of template metadata objects.
  - `revolut_link`: `{ "url": "https://revolut.me/..." }`

### `audit_log`

- If not present, add table with:
  - `id UUID PK`, `actor_id UUID`, `action TEXT`, `target_table TEXT`,
    `target_id TEXT`, `diff JSONB`, `created_at TIMESTAMPTZ DEFAULT now()`.
- Indexes: `(target_table, created_at DESC)`, `(actor_id, created_at DESC)`.

## New Columns (Existing Tables)

- `users` → `roles TEXT[] DEFAULT '{}'::text[]` (if absent) for Admin Panel
  filters.
- `users` → `last_seen_at TIMESTAMPTZ` (for operations health).

## Views / Helpers

- `view_active_bars` (if required) to aggregate station activity.
- `view_voucher_metrics` to pre-compute issued/sent/redeemed counts per day.

## State Transitions

- **Vouchers**: `issued → sent → redeemed`; `issued → expired`;
  `issued|sent → void`.
- **Campaigns**: `draft → running → paused → running → done`.
- **Campaign Targets**: `queued → sent → delivered|read`;
  `queued → failed|opted_out`; `queued_throttled → queued` after retry.
- **Insurance Quotes**: `pending → approved` OR
  `pending → needs_changes → pending`.

## Audit Expectations

- Every write to vouchers, campaigns, campaign_targets, insurance_quotes,
  settings inserts an `audit_log` row with before/after diff.
- Voucher state transitions must also emit a `voucher_events` row.

## Storage Buckets

- `vouchers` (PNG previews)
- `qr` (generated QR images)
- `campaign-media` (optional attachments)
- `docs` (insurance uploads)

## Security & RLS Notes

- Admin roles bypass bar-level RLS via role claim `role = 'admin'`.
- Station operators restricted to vouchers redeemed at their station.
- Campaign targets visible only to Super Admin and Support roles.

## Phase 4 Additions – Agent-Core Schema

These tables live in the Agent-Core Postgres database managed through
`packages/db/prisma/schema.prisma`. Migrations are additive and executed with
`pnpm --filter @easymo/db prisma:migrate:dev`.

### `Tenant`

- `id UUID PK DEFAULT uuid_generate_v4()`.
- `name TEXT NOT NULL`.
- `countries TEXT[] DEFAULT '{}'::text[]`.
- Relationships to `AgentConfig`, `Lead`, `Call`, `WalletAccount`,
  `CommissionSchedule`, `VendorProfile`, `BuyerProfile`, `Intent`,
  `WalletTransaction`.

### `AgentConfig`

- Ties agent personas to tenants (`tenant_id UUID` FK).
- Stores `product`, supported `languages`, `system_prompt`, `tools`/`policy`
  JSON payloads.

### `Lead`

- Scoped by tenant; unique on (`tenant_id`, `phone_e164`).
- Tracks `tags`, `opt_in` flag, `locale`, and `last_contact_at` timestamp.
- Relates to `Call`.

### `Call`

- Captures realtime sessions: `direction` (`inbound`/`outbound`),
  `platform` (`pstn`/`sip`), `started_at`/`ended_at`, `recording_url`,
  `summary` JSON, `handoff_to`, `region`.
- Links back to `Lead` when available and aggregates `Disposition`.

### `Disposition`

- One-to-many with `Call`; records feedback codes and notes.

### `OptOut`

- Deduplicated by `phone_e164`; stores opt-out `reason` and timestamp `ts`.
- Shared across WhatsApp bot and voice orchestrator.

## Phase 5 Additions – Wallet & Marketplace Schema

### `WalletAccount`

- `id UUID PK`, `tenant_id` FK, `owner_type` enum (`vendor`, `buyer`, `platform`,
  `commission`), `owner_id`, `currency`, `status`, `balance NUMERIC(18,4)`.
- Optional one-to-one with `VendorProfile`/`BuyerProfile`.

### `WalletTransaction`

- Represents immutable double-entry containers; `type` (purchase, payout,
  commission, adjustment), optional `reference`, `metadata JSONB`.

### `WalletEntry`

- Split ledger entries: `amount NUMERIC(18,4)`, `direction` (`debit`/`credit`),
  indexes on `account_id` and `transaction_id` for reconciliation queries.

### `CommissionSchedule`

- Per-tenant commission rules: `product`, percentage `rate NUMERIC(5,4)`,
  optional `flat_fee`, `effective_at`.

### `VendorProfile`

- Vendor catalog surface: `region`, `categories TEXT[]`, `rating NUMERIC(4,2)`,
  `fulfilment_rate NUMERIC(5,4)`, `avg_response_ms`, `total_trips`.
- Optional `wallet_account_id` link; drives ranking inputs.

### `BuyerProfile`

- Buyer metadata with optional attached wallet; `segment` tagging for
  behavioural routing.

### `Intent`

- Represents marketplace demand: `channel` (WhatsApp, voice, lead form),
  JSON `payload`, `status` enum (`pending`, `matched`, `expired`, `cancelled`),
  optional `expires_at`.

### `Quote`

- Candidate vendor offers: `price NUMERIC(18,4)`, `currency`, `eta_minutes`,
  `status` (`pending`, `accepted`, `rejected`, `expired`), optional `accepted_at`.

### `Purchase`

- Finalised bookings: one-to-one with `Quote`, optional `transaction_id`
  referencing wallet transaction, `status` (`pending`, `completed`, `cancelled`,
  `failed`), optional `fulfilled_at`.

### Enum Updates

- `wallet_owner_type`, `wallet_entry_direction`, `intent_status`, `quote_status`,
  `purchase_status`, `call_direction`, and `call_platform` underpin the Prisma
  schema and map to Postgres enums for validation.
