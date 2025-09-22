# Migration Order (Additive)

Execute migrations in the order below. Each file should use the naming convention `YYYYMMDDHHMMSS_description.sql` and avoid editing existing migrations.

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
   - Create `settings` table and insert default rows (quiet hours, throttle, templates placeholder, revolut link).
9. **Audit Log (if missing)**
   - Create `audit_log` table; otherwise ensure indexes exist.
10. **Users Enhancements**
   - Add `roles` and `last_seen_at` columns to `users` if schema allows.
11. **Analytics Views**
   - Create helper views/materialized views for dashboard metrics.
12. **Seed Fixtures (optional)**
   - Add SQL under `supabase/seed/fixtures/` referencing the above tables.

## Dependencies & Constraints
- Each migration must be reversible via `DROP TABLE` or `ALTER TABLE DROP COLUMN` statements guarded by `IF EXISTS`.
- Use `DEFERRABLE INITIALLY IMMEDIATE` foreign keys where cross-table order is important.
- Apply indexes in the same migration as table creation to keep diff count minimal.
- Wrap seeding steps in `BEGIN/COMMIT` and mark them idempotent with `ON CONFLICT DO NOTHING`.

## Deployment Notes
- Run migrations in staging first; validate with `QA_MATRIX.md` smoke pass.
- Capture schema diff before production rollout and attach to PR for review.
