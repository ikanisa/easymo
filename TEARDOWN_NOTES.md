# Fixture Teardown Guide

Use this checklist to remove staging fixtures after a demo or when refreshing the environment.

## Preconditions
- Confirm no live operator is using the staging environment.
- Export any analytics snapshots or screenshots required for documentation.
- Ensure no automated tests rely on the fixture primary keys (they should reference business keys instead).

## Removal Steps
1. **Disable Campaign Dispatchers**
   - Pause all campaigns via the Admin Panel or direct DB update (`UPDATE campaigns SET status = 'paused' WHERE id IN (...)`).
2. **Delete Campaign Targets**
   - `DELETE FROM campaign_targets WHERE campaign_id IN (fixture ids);`
3. **Delete Campaigns**
   - `DELETE FROM campaigns WHERE id IN (fixture ids);`
4. **Remove Voucher Events**
   - `DELETE FROM voucher_events WHERE voucher_id IN (fixture voucher ids);`
5. **Delete Vouchers**
   - `DELETE FROM vouchers WHERE id IN (fixture voucher ids);`
6. **Clear Insurance Quotes**
   - `DELETE FROM insurance_quotes WHERE id IN (fixture ids);`
7. **Remove Stations**
   - `DELETE FROM stations WHERE id IN (fixture ids);`
8. **Delete Users**
   - `DELETE FROM users WHERE id IN (fixture ids);`
9. **Purge Logs**
   - `DELETE FROM audit_log WHERE target_id IN (fixture ids) AND created_at >= fixture load timestamp;`
10. **Clean Storage Objects**
    - Remove uploaded fixture files from Supabase storage buckets (`vouchers/`, `qr/`, `campaign-media/`, `docs/`).

Wrap each delete block in a transaction and run them from the outermost dependency inward (targets → campaigns → vouchers → users) to avoid foreign-key violations.

## Verification
- Reload the Admin Panel pages; they should show empty states or production data only.
- Run smoke tests from `QA_MATRIX.md` to confirm UI handles empty datasets gracefully.
- Check audit logs to ensure teardown actions are recorded for traceability.

## Post-Teardown
- Re-enable any paused automated jobs.
- Notify the team that staging is clean and ready for new fixtures.
- Archive the SQL scripts used so the same fixture set can be recreated later if needed.
