# Data Model Delta (Additive-Only)

This document describes the additive database structures required for the Admin Panel and Station PWA. Existing tables remain untouched; all changes are new tables, columns, or indexes delivered through timestamped migrations.

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
  - `quiet_hours`: `{ "rw": { "start": "22:00", "end": "06:00" }, "mt": { ... } }`
  - `send_throttle`: `{ "whatsapp": { "per_minute": 60 } }`
  - `opt_out_list`: `["hash1", "hash2"]`
  - `templates`: array of template metadata objects.
  - `revolut_link`: `{ "url": "https://revolut.me/..." }`

### `audit_log`
- If not present, add table with:
  - `id UUID PK`, `actor_id UUID`, `action TEXT`, `target_table TEXT`, `target_id TEXT`, `diff JSONB`, `created_at TIMESTAMPTZ DEFAULT now()`.
- Indexes: `(target_table, created_at DESC)`, `(actor_id, created_at DESC)`.

## New Columns (Existing Tables)
- `users` → `roles TEXT[] DEFAULT '{}'::text[]` (if absent) for Admin Panel filters.
- `users` → `last_seen_at TIMESTAMPTZ` (for operations health).

## Views / Helpers
- `view_active_bars` (if required) to aggregate station activity.
- `view_voucher_metrics` to pre-compute issued/sent/redeemed counts per day.

## State Transitions
- **Vouchers**: `issued → sent → redeemed`; `issued → expired`; `issued|sent → void`.
- **Campaigns**: `draft → running → paused → running → done`.
- **Campaign Targets**: `queued → sent → delivered|read`; `queued → failed|opted_out`; `queued_throttled → queued` after retry.
- **Insurance Quotes**: `pending → approved` OR `pending → needs_changes → pending`.

## Audit Expectations
- Every write to vouchers, campaigns, campaign_targets, insurance_quotes, settings inserts an `audit_log` row with before/after diff.
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
