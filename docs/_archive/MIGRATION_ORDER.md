# Migration Order (Additive)

Execute migrations in the order below. Each file should use the naming
convention `YYYYMMDDHHMMSS_description.sql` and avoid editing existing
migrations.

> **Schema dump gate**: after adding or editing migrations run
> `supabase db dump --schema public > latest_schema.sql` and then
> `pnpm schema:verify`. The checksum comment at the top of
> `latest_schema.sql` must match the current contents of
> `supabase/migrations/**/*.sql` or CI will fail.

1. **Admin Roles**
   - Create `admin_roles` table and seed Super Admin for staging.
2. **Stations**
   - Create `stations` table and supporting indexes.
3. **Vouchers Core**
   - Create `vouchers` table.
   - Add indexes on `status`, `user_id`, `campaign_id`.
4. **Voucher Events**
   - Create `voucher_events` table linked to vouchers and stations.
5. **Campaigns**
   - Create `campaigns` table.
6. **Campaign Targets**
   - Create `campaign_targets` table with indexes.
7. **Insurance Quotes**
   - Create `insurance_quotes` table.
8. **Settings**
   - Create `settings` table and insert default rows (quiet hours, throttle,
     templates placeholder, revolut link).
9. **Audit Log (if missing)**
   - Create `audit_log` table; otherwise ensure indexes exist.
10. **Users Enhancements**

- Add `roles` and `last_seen_at` columns to `users` if schema allows.

11. **Analytics Views**

- Create helper views/materialized views for dashboard metrics.

12. **Seed Fixtures (optional)**

- Add SQL under `supabase/seed/fixtures/` referencing the above tables.

13. **Insurance Media Queue Enhancements**

- Apply `supabase/migrations/20251031151500_insurance_media_queue_enhancements.sql`
  to backfill queue metadata (attempt counters, error tracking, signed URL index).

14. **Admin Alert Preferences RLS**

- Apply `supabase/migrations/20251031152000_admin_alert_prefs_rls.sql` to enforce
  row-level security policies for global and per-admin alert subscriptions.

15. **Wallet RLS Policies**

- Apply `supabase/migrations/20251031152500_wallet_rls_policies.sql` to align
  wallet domain tables with service-role and self-read access scopes.

16. **Marketing Fixture Alignment**
   - Run `supabase/migrations/20251205100000_admin_marketing_fixture_support.sql`
     to enforce `campaign_targets`/`vouchers` uniqueness and initialise the
     `campaigns_legacy_id_seq` required by the marketplace seeds.

17. **Driver Vehicle Defaults**
   - Apply `supabase/migrations/20251206090000_driver_vehicle_defaults.sql` so
     the WhatsApp driver flows can persist preferred vehicle metadata and the
     simulator stays in sync.

18. **Agent Chat Tables**
   - Apply `supabase/migrations/20251206103000_agent_chat_tables.sql` to create
     `agent_chat_sessions` and `agent_chat_messages` used by the admin chat
     preview and future Agent-Core integrations.

## Dependencies & Constraints

- Each migration must be reversible via `DROP TABLE` or
  `ALTER TABLE DROP COLUMN` statements guarded by `IF EXISTS`.
- Use `DEFERRABLE INITIALLY IMMEDIATE` foreign keys where cross-table order is
  important.
- Apply indexes in the same migration as table creation to keep diff count
  minimal.
- Wrap seeding steps in `BEGIN/COMMIT` and mark them idempotent with
  `ON CONFLICT DO NOTHING`.

### Recent Additions

- `20251205100000_admin_marketing_fixture_support.sql` — keeps campaign/voucher
  fixtures idempotent and bootstraps the legacy sequence.
- `20251206090000_driver_vehicle_defaults.sql` — captures driver vehicle defaults
  for WhatsApp & simulator parity.
- `20251206103000_agent_chat_tables.sql` — introduces `agent_chat_sessions` and
  `agent_chat_messages` for the Agent-Core preview.

### Agent-Core / Prisma Migrations

- The Phase 4/5 services rely on the Prisma migration history bundled with
  `packages/db`. Execute `pnpm --filter @easymo/db prisma:migrate:dev` before
  running Agent-Core, wallet, ranking, vendor, buyer, or broker services so
  their tables (`tenants`, `leads`, `calls`, `wallet_*`, `vendor_profiles`,
  `buyer_profiles`, `intents`, `quotes`, `purchases`) exist.

## Deployment Notes

- Run migrations in staging first; validate with `QA_MATRIX.md` smoke pass.
- Capture schema diff before production rollout and attach to PR for review.
