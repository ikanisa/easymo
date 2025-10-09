# SCHEMA — Baskets Module (Phase 1)

## saccos
- `id uuid PK default gen_random_uuid()`
- `name text not null`
- `branch_code text not null unique`
- `umurenge_name text`
- `district text`
- `contact_phone text`
- `status text check in ('pending','active','suspended') default 'pending'`
- `ltv_min_ratio numeric(6,3) default 1.0`
- `created_at timestamptz default now()`
- Indexes: `saccos_branch_code_key`, `idx_saccos_umurenge_name`

## sacco_officers
- `id uuid PK`
- `sacco_id uuid FK -> saccos`
- `user_id uuid FK -> auth.users`
- `role text not null`
- `created_at timestamptz default now()`
- Indexes: `idx_sacco_officers_sacco`, `idx_sacco_officers_user`

## ibimina
- `id uuid PK`
- `sacco_id uuid FK -> saccos`
- `name text not null`
- `description text`
- `slug text unique`
- `status text check ('pending','active','suspended') default 'pending'`
- `created_at timestamptz default now()`
- Indexes: `ibimina_slug_key`, `ibimina_sacco_name_key`

## ibimina_members
- `id uuid PK`
- `ikimina_id uuid FK -> ibimina`
- `user_id uuid FK -> profiles(user_id)`
- `joined_at timestamptz default now()`
- `status text check ('pending','active','removed') default 'pending'`
- Indexes: `idx_ibimina_members_ikimina`, `idx_ibimina_members_user`, `idx_ibimina_members_active_user` (partial unique on active members)

## ibimina_committee
- `id uuid PK`
- `ikimina_id uuid FK -> ibimina`
- `member_id uuid FK -> ibimina_members`
- `role text check ('president','vp','secretary','treasurer')`
- `created_at timestamptz default now()`
- Unique: `ibimina_committee_role_key`

## ibimina_settings
- `ikimina_id uuid PK FK -> ibimina`
- `contribution_type text check ('fixed','variable') default 'fixed'`
- `periodicity text check ('weekly','monthly') default 'monthly'`
- `min_amount numeric(12,2) default 0`
- `due_day integer (1-31)`
- `reminder_policy jsonb default '{}'`
- `quorum jsonb default '{}'`

## ibimina_accounts
- `id uuid PK`
- `ikimina_id uuid FK -> ibimina`
- `sacco_account_number text unique`
- `status text check ('pending','active','suspended') default 'pending'`
- `created_at timestamptz default now()`

## contributions_ledger
- `id uuid PK`
- `ikimina_id uuid FK -> ibimina`
- `member_id uuid FK -> ibimina_members`
- `amount numeric(12,2) not null`
- `currency text default 'RWF'`
- `cycle_yyyymm char(6)`
- `txn_id text unique (nullable)`
- `allocated_at timestamptz default now()`
- `source text check ('sms','admin','correction')`
- `meta jsonb default '{}'`
- Indexes: ikimina, member, cycle, txn unique

## contribution_cycles
- `id uuid PK`
- `ikimina_id uuid FK -> ibimina`
- `yyyymm char(6)`
- `expected_amount numeric`
- `collected_amount numeric default 0`
- `status text check ('pending','open','closed') default 'pending'`
- Unique: `(ikimina_id, yyyymm)`

## member_rankings (view)
- Fields: `ikimina_id`, `member_id`, `total_amount`, `month_amount`, `rank_total`, `rank_month`
- Based on aggregates from `contributions_ledger`

## momo_sms_inbox
- `id uuid PK`
- `raw_text text`
- `msisdn_raw text`
- `received_at timestamptz default now()`
- `ingest_source text`
- `hash text unique`

## momo_parsed_txns
- `id uuid PK`
- `inbox_id uuid FK -> momo_sms_inbox`
- `msisdn_e164 text`
- `sender_name text`
- `amount numeric(12,2)`
- `currency text default 'RWF'`
- `txn_id text unique (nullable)`
- `txn_ts timestamptz`
- `confidence numeric`
- `parsed_json jsonb default '{}'`

## momo_unmatched
- `id uuid PK`
- `parsed_id uuid FK -> momo_parsed_txns`
- `reason text`
- `suggested_member_id uuid FK -> ibimina_members`
- `status text check ('open','resolved') default 'open'`
- `created_at timestamptz default now()`
- `resolved_at timestamptz`
- `resolved_by uuid FK -> auth.users`
- `linked_member_id uuid FK -> ibimina_members`
- `resolution_notes text`
- `allocation_ledger_id uuid FK -> contributions_ledger`

## sacco_loans
- `id uuid PK`
- `ikimina_id uuid FK -> ibimina`
- `member_id uuid FK -> ibimina_members`
- `principal numeric(12,2)`
- `currency text default 'RWF'`
- `tenure_months integer`
- `rate_apr numeric(6,3)`
- `purpose text`
- `status text check ('pending','endorsing','approved','rejected','disbursed','closed') default 'pending'`
- `status_reason text`
- `collateral_total numeric(12,2) default 0`
- `ltv_ratio numeric(6,3) default 0`
- `disbursement_scheduled_at timestamptz`
- `disbursed_at timestamptz`
- `repayment_schedule jsonb default '[]'`
- `committee_completed_at timestamptz`
- `sacco_decision_by uuid FK -> auth.users`
- `sacco_decision_at timestamptz`
- `sacco_decision_notes text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- `meta jsonb default '{}'`

## sacco_collateral
- `id uuid PK`
- `loan_id uuid FK -> sacco_loans`
- `source text check ('group_savings','member_savings','guarantor','asset') default 'group_savings'`
- `amount_pledged numeric(12,2)`
- `coverage_ratio numeric(6,3)`
- `valuation numeric(12,2)`
- `details jsonb default '{}'`
- `created_at timestamptz default now()`

## sacco_loan_events
- `id uuid PK`
- `loan_id uuid FK -> sacco_loans`
- `from_status text`
- `to_status text`
- `actor_id uuid FK -> auth.users`
- `actor_role text`
- `notes text`
- `context jsonb default '{}'`
- `created_at timestamptz default now()`

## basket_invites
- `id uuid PK`
- `ikimina_id uuid FK -> ibimina`
- `token text unique`
- `issuer_member_id uuid FK -> ibimina_members`
- `expires_at timestamptz`
- `status text check ('active','used','expired','canceled') default 'active'`
- `created_at timestamptz default now()`

## kyc_documents
- `id uuid PK`
- `user_id uuid FK -> profiles(user_id)`
- `doc_type text check ('national_id') default 'national_id'`
- `front_url text`
- `back_url text`
- `parsed_json jsonb default '{}'`
- `status text check ('pending','verified','rejected') default 'pending'`
- `created_at timestamptz default now()`
- `reviewed_at timestamptz`

## baskets_reminders
- `id uuid PK`
- `ikimina_id uuid FK -> ibimina`
- `member_id uuid FK -> ibimina_members`
- `notification_id uuid FK -> notifications`
- `reminder_type text check ('due_in_3','due_today','overdue','custom')`
- `status text check ('pending','queued','sent','skipped','blocked','cancelled') default 'pending'`
- `scheduled_for timestamptz`
- `next_attempt_at timestamptz`
- `attempts integer`
- `last_attempt_at timestamptz`
- `blocked_reason text`
- `meta jsonb default '{}'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

## baskets_reminder_events
- `id uuid PK`
- `reminder_id uuid FK -> baskets_reminders`
- `event text`
- `reason text`
- `context jsonb default '{}'`
- `created_at timestamptz default now()`

## Settings Seeds
- Keys inserted: `baskets.quiet_hours`, `baskets.templates`, `baskets.feature_flags`, `baskets.reminder_throttle` (JSON payloads, idempotent).

## RLS Summary
- RLS enabled on all new tables.
- Baseline policies allow `admin` and `sacco_staff` full access; finer-grained policies pending future phases.
