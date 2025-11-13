# Phased Migration Deployment Guide

## Overview
The consolidated 25-migration script has been split into 4 phases for safer, incremental deployment.

**Total Duration**: 20-30 minutes  
**Deployment Strategy**: Sequential phases with validation checkpoints  
**Rollback Strategy**: Each phase is wrapped in BEGIN/COMMIT for atomicity

---

## Phase Summary

| Phase | Duration | Risk | Can Delay? | Description |
|-------|----------|------|------------|-------------|
| **Phase 1** | ~2 min | LOW | ❌ No | Foundation: Extensions, core tables, RLS |
| **Phase 2** | ~3-5 min | MEDIUM | ⚠️ Caution | Performance: Indexes, triggers, partitions |
| **Phase 3** | ~5-7 min | MED-HIGH | ⚠️ Caution | Business logic, security policies |
| **Phase 4** | ~10-15 min | HIGH | ✅ Yes | Advanced features (video, menus, analytics) |

---

## Deployment Steps

### Pre-Deployment Checklist

```bash
# 1. Verify Supabase CLI is installed
supabase --version  # Should be >= 1.200.0

# 2. Check current migration status
supabase db push --dry-run

# 3. Backup database (CRITICAL!)
# Via Supabase Dashboard: Settings → Database → Create Backup
# Or via CLI (if available in your plan)

# 4. Verify connection
supabase db push --dry-run  # Should show pending migrations
```

---

### Phase 1: Foundation (REQUIRED - Cannot Skip)

**What it does:**
- Enables PostGIS and pgvector extensions
- Creates core tables (`shops`, `bars`)
- Enables RLS on 25+ sensitive tables
- Sets up basic service role policies

**Deploy:**
```bash
# Option A: Via Supabase CLI (recommended)
supabase db push

# Option B: Via Dashboard SQL Editor
# 1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
# 2. Copy contents of: supabase/migrations/20251112170000_phase1_foundation.sql
# 3. Paste and click "Run"
```

**Validation:**
```sql
-- Check extensions
SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'vector');
-- Expected: 2 rows

-- Check RLS is enabled
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: 25+ tables

-- Check core tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('shops', 'bars');
-- Expected: 2 rows
```

**Expected Output:**
```
✅ Phase 1 Complete: Foundation established
   - Extensions enabled (PostGIS, pgvector)
   - Core tables created (shops, bars)
   - RLS enabled on 25+ tables
   - Basic policies configured
```

---

### Phase 2: Performance & Indexes

**What it does:**
- Adds 40+ indexes on foreign keys
- Applies `updated_at` triggers to 45+ tables
- Fixes missing timestamp defaults
- Sets up partition automation for future months

**Deploy:**
```bash
supabase db push
```

**Validation:**
```sql
-- Check indexes created
SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
-- Expected: 50+ indexes

-- Check triggers exist
SELECT count(*) FROM pg_trigger WHERE tgname = 'set_updated_at';
-- Expected: 40+ triggers

-- Check partition function exists
SELECT proname FROM pg_proc WHERE proname = 'create_monthly_partition';
-- Expected: 1 row
```

**Expected Output:**
```
✅ Phase 2 Complete: Performance & Indexes
   - 40+ indexes created on foreign keys
   - updated_at triggers applied to 45+ tables
   - Timestamp defaults fixed
   - Partition automation configured
```

**⚠️ Warning:** Index creation may briefly lock tables. Deploy during low-traffic window if possible.

---

### Phase 3: Business Logic & Security

**What it does:**
- Deploys essential business functions (wallet, trips, drivers)
- Adds observability functions (Ground Rules compliant)
- Refines security policies (least privilege)
- Enables audit logging with PII masking

**Deploy:**
```bash
supabase db push
```

**Validation:**
```sql
-- Check business functions exist
SELECT proname FROM pg_proc WHERE proname IN (
  'handle_new_user', 'get_user_wallet', 'update_wallet_balance', 
  'record_trip', 'match_drivers'
);
-- Expected: 5 rows

-- Check observability functions
SELECT proname FROM pg_proc WHERE proname LIKE 'log_%';
-- Expected: 3+ rows

-- Check refined policies
SELECT count(*) FROM pg_policies WHERE policyname LIKE '%_own';
-- Expected: 5+ policies
```

**Expected Output:**
```
✅ Phase 3 Complete: Business Logic & Security
   - Essential business functions deployed
   - Observability functions (Ground Rules compliant)
   - Security policies refined (least privilege)
   - Wallet, trip, and audit functions ready
```

**⚠️ Warning:** May affect existing API behavior due to policy changes. Test thoroughly in staging first.

---

### Phase 4: Advanced Features (OPTIONAL - Can Delay)

**What it does:**
- Video performance analytics tables
- WhatsApp home menu configuration
- Restaurant menu management system
- Agent registry extensions
- Business vector embeddings for semantic search
- Vehicle insurance tracking
- Inserts sample bars data

**Deploy:**
```bash
supabase db push
```

**Validation:**
```sql
-- Check video analytics tables
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'video_%';
-- Expected: 3 tables (video_jobs, video_approvals, video_performance)

-- Check WhatsApp menu items
SELECT count(*) FROM whatsapp_home_menu_items;
-- Expected: 5+ menu items

-- Check bars data
SELECT count(*) FROM bars;
-- Expected: 5+ bars

-- Check vector column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'businesses' AND column_name = 'name_embedding';
-- Expected: 1 row
```

**Expected Output:**
```
✅ Phase 4 Complete: Advanced Features
   - Video performance analytics deployed
   - WhatsApp home menu configured
   - Restaurant menu system ready
   - Agent registry extended
   - Business features enhanced
   - Vehicle insurance tracking enabled
   - Vector embeddings for semantic search

🎉 ALL 4 PHASES COMPLETE!
📊 Total migrations: 25
⏰ Total estimated time: 20-30 minutes
```

**💡 Note:** This phase can be deployed separately if time constraints exist. The system will function without these features.

---

## Post-Deployment Verification

### Comprehensive Health Check

```sql
-- 1. Check all migrations applied
SELECT version, name FROM supabase_migrations.schema_migrations 
ORDER BY version DESC LIMIT 10;

-- 2. Verify critical tables exist
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: 60+ tables

-- 3. Check RLS is enabled on sensitive tables
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
-- Expected: 30+ tables

-- 4. Verify functions are callable
SELECT count(*) FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace;
-- Expected: 30+ functions

-- 5. Check indexes for performance
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
-- Should see comprehensive index coverage

-- 6. Test a critical function
SELECT public.get_user_wallet('test-user-id');
-- Should return null or data without error
```

---

## Rollback Procedures

### If Phase Fails During Deployment

Each phase is wrapped in `BEGIN/COMMIT`, so failures auto-rollback. However, if you need manual rollback:

```bash
# Rollback to specific migration (replace with last good version)
supabase db reset --version 20251112165500

# OR restore from backup (Supabase Dashboard)
# Settings → Database → Backups → Restore
```

### Incremental Rollback (Phase-by-Phase)

```bash
# Remove Phase 4 only
supabase migration repair 20251112170300 --status reverted

# Remove Phase 3 + 4
supabase migration repair 20251112170200 --status reverted
supabase migration repair 20251112170300 --status reverted
```

---

## Troubleshooting

### Common Issues

#### 1. "Extension postgis does not exist"
**Solution:**
```sql
-- Enable via dashboard: Database → Extensions → Enable PostGIS
-- Then re-run Phase 1
```

#### 2. "Index creation timeout"
**Solution:**
```bash
# Increase statement timeout before Phase 2
ALTER DATABASE postgres SET statement_timeout = '10min';
```

#### 3. "Function already exists"
**Solution:** Safe to ignore - functions use `CREATE OR REPLACE`

#### 4. "Permission denied for table"
**Solution:**
```sql
-- Ensure service role has full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
```

#### 5. "Partition table does not exist"
**Solution:** Phase 2 creates partition function - ensure Phase 1 completed first

---

## Performance Considerations

### During Deployment

- **Index Creation**: May lock tables for 1-2 seconds per index
- **RLS Policy Creation**: Instant, no locking
- **Function Creation**: Instant, no locking
- **Partition Creation**: Instant, no locking

### Recommended Deployment Window

- **Phase 1-2**: Can deploy anytime (minimal impact)
- **Phase 3**: Deploy during low-traffic (policy changes)
- **Phase 4**: Can deploy anytime (new features only)

---

## Monitoring Post-Deployment

```sql
-- Monitor query performance
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%public.%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- Check slow queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';

-- Monitor RLS overhead
SELECT schemaname, tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Success Criteria

✅ **Phase 1**: Extensions enabled, core tables exist, RLS active  
✅ **Phase 2**: Indexes created, triggers active, partitions configured  
✅ **Phase 3**: Business functions work, policies enforced  
✅ **Phase 4**: New features accessible, no errors in logs  

---

## Support & Next Steps

### If Deployment Succeeds
1. Update application code to use new functions
2. Test feature flags and new features
3. Monitor performance metrics for 24 hours
4. Document any custom changes for team

### If Deployment Fails
1. Check Supabase logs: Database → Logs
2. Review error messages carefully
3. Rollback to backup if needed
4. Contact support with specific error messages

---

## Additional Resources

- **Supabase Migrations Guide**: https://supabase.com/docs/guides/cli/local-development#database-migrations
- **PostGIS Documentation**: https://postgis.net/documentation/
- **pgvector Documentation**: https://github.com/pgvector/pgvector

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-12  
**Maintained By**: Infrastructure Team
