# Schema Consolidation Deployment Checklist

## Pre-Deployment Verification ✅

- [x] Code updated to use new table names
- [x] Migrations created with transaction safety
- [x] No hardcoded legacy table references in codebase
- [x] Rollback strategy documented
- [x] Changes committed to git

## Deployment Steps

### 1. Deploy Edge Functions (CRITICAL - Deploy First)
```bash
# Deploy updated Edge Functions BEFORE running migrations
supabase functions deploy wa-webhook-mobility
supabase functions deploy wa-webhook

# Verify deployment
supabase functions list
```

**Why First:** Code must reference new tables before old tables are dropped.

---

### 2. Apply Database Migrations
```bash
# Migration 1: Drop unified_* tables (SAFE - 0 refs)
supabase db push --include-all

# Verify unified_* tables dropped
supabase db execute "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_name LIKE 'unified_%';
"
# Expected: 0 rows
```

**Migration 2:** `20251209120000_drop_legacy_ride_tables.sql` will:
- Check if `trip_notifications` exists
- Drop `ride_requests` and `ride_notifications` only if safe

---

### 3. Verify Deployment
```bash
# Check trip_notifications is receiving inserts
supabase db execute "
  SELECT count(*), max(created_at) as last_notification
  FROM trip_notifications;
"

# Check no errors in logs
grep -i "TRIP_NOTIFICATION_INSERT_FAILED" <log_file>
# Expected: 0 errors

# Verify old tables are gone
supabase db execute "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_name IN ('ride_requests', 'ride_notifications');
"
# Expected: 0 rows
```

---

### 4. Monitor for Issues (24 hours)
```bash
# Watch for errors
tail -f <edge_function_logs> | grep -i "notification\|trip\|ride"

# Check table usage
supabase db execute "
  SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates
  FROM pg_stat_user_tables
  WHERE tablename IN ('trips', 'trip_notifications', 'mobility_matches')
  ORDER BY tablename;
"
```

---

## Rollback Plan (If Needed)

### If Edge Functions Fail
```bash
# Rollback to previous version
git revert HEAD
supabase functions deploy wa-webhook-mobility
supabase functions deploy wa-webhook
```

### If Migrations Fail
Migrations use `BEGIN/COMMIT` - automatic rollback on error.

**Manual rollback:**
```sql
-- Restore from backup
pg_restore -d <database> <backup_file>

-- Or recreate legacy tables (not recommended)
CREATE TABLE ride_notifications AS TABLE trip_notifications;
ALTER TABLE ride_notifications RENAME COLUMN recipient_id TO driver_id;
```

---

## Post-Deployment Validation

### Success Criteria
- [ ] No `TRIP_NOTIFICATION_INSERT_FAILED` errors in logs
- [ ] `trip_notifications` table receiving inserts
- [ ] `ride_requests`, `ride_notifications` tables dropped
- [ ] All 5 `unified_*` tables dropped
- [ ] Edge Functions return 200 OK
- [ ] No user-facing errors reported

### Metrics to Monitor
1. **Notification delivery rate:** Should remain >95%
2. **Trip creation rate:** Should match historical average
3. **Edge Function errors:** Should be <0.1%
4. **Database query latency:** Should not increase

---

## Known Issues & Mitigations

### Issue: Old code still references legacy tables
**Symptom:** `relation "ride_notifications" does not exist`  
**Mitigation:** Deploy Edge Functions FIRST (Step 1)

### Issue: trip_notifications doesn't exist yet
**Symptom:** Migration 20251209120000 skips dropping ride_notifications  
**Mitigation:** Check if migration 20251209030000 was applied:
```sql
SELECT * FROM _migrations WHERE name LIKE '%consolidate_mobility%';
```

---

## Timeline

### Recommended Schedule
1. **Off-peak hours** (e.g., 2-4 AM EAT)
2. **Deploy Edge Functions:** 5 minutes
3. **Apply Migrations:** 2 minutes
4. **Verification:** 10 minutes
5. **Monitoring:** 24 hours

**Total Deployment Window:** ~20 minutes  
**Monitoring Period:** 24 hours

---

## Emergency Contacts

**If deployment fails:**
1. Rollback Edge Functions (git revert + deploy)
2. Do NOT manually drop tables
3. Check Supabase logs for error details
4. Contact: [Add team contact here]

---

## Sign-Off

- [ ] Code review approved
- [ ] QA testing passed
- [ ] Deployment plan reviewed
- [ ] Rollback plan tested
- [ ] Monitoring alerts configured

**Deployed by:** _________________  
**Date:** _________________  
**Status:** _________________

---

## Appendix: Verification Queries

### Check Migration Status
```sql
SELECT 
  name, 
  applied_at 
FROM _migrations 
WHERE name LIKE '%202512091%'
ORDER BY applied_at DESC;
```

### Count Records by Table
```sql
SELECT 
  'trips' as table_name, count(*) as records FROM trips
UNION ALL
SELECT 'trip_notifications', count(*) FROM trip_notifications
UNION ALL
SELECT 'mobility_matches', count(*) FROM mobility_matches;
```

### Check for Orphaned References
```sql
-- Should return 0 rows
SELECT 
  conname, 
  conrelid::regclass, 
  confrelid::regclass
FROM pg_constraint
WHERE confrelid::regclass::text IN ('ride_requests', 'ride_notifications');
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-09  
**Status:** Ready for Deployment
