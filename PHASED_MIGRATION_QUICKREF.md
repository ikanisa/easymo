# Phased Migration Quick Reference

## 🚀 Quick Deploy (All Phases)

```bash
# Backup first!
# Then run:
supabase db push

# This will apply all 4 phases sequentially
# Total time: 20-30 minutes
```

---

## 📋 Phase Breakdown

### Phase 1: Foundation (2 min) ✅ REQUIRED
**File**: `20251112170000_phase1_foundation.sql`
- PostGIS + pgvector extensions
- Core tables (shops, bars)
- RLS on 25+ tables
- Basic policies

### Phase 2: Performance (3-5 min) ⚠️ RECOMMENDED
**File**: `20251112170100_phase2_performance.sql`
- 40+ foreign key indexes
- updated_at triggers (45+ tables)
- Timestamp defaults fixed
- Partition automation

### Phase 3: Business Logic (5-7 min) ⚠️ RECOMMENDED
**File**: `20251112170200_phase3_business_logic.sql`
- Wallet, trip, driver matching functions
- Observability (Ground Rules compliant)
- Refined security policies
- Audit logging with PII masking

### Phase 4: Advanced Features (10-15 min) 💡 OPTIONAL
**File**: `20251112170300_phase4_advanced_features.sql`
- Video performance analytics
- WhatsApp menu config
- Restaurant menu system
- Agent registry extensions
- Business vector embeddings
- Vehicle insurance tracking
- Sample bars data

---

## 🔍 Quick Validation

```bash
# After each phase, verify:
supabase db push --dry-run

# Check migration status
psql $DATABASE_URL -c "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 4;"
```

---

## ⚡ One-Liner Deploy + Validate

```bash
# Deploy all phases
supabase db push && \
echo "✅ Deployment complete. Running validation..." && \
psql $DATABASE_URL -c "
  SELECT 'Extensions' as check, count(*)::text as result FROM pg_extension WHERE extname IN ('postgis', 'vector')
  UNION ALL
  SELECT 'RLS Tables', count(*)::text FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true
  UNION ALL
  SELECT 'Indexes', count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
  UNION ALL
  SELECT 'Functions', count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  UNION ALL
  SELECT 'Bars Data', count(*)::text FROM bars;
"
```

---

## 🆘 Emergency Rollback

```bash
# Rollback to before Phase 4
supabase db reset --version 20251112170200

# Rollback everything (use backup)
# Dashboard → Settings → Database → Backups → Restore
```

---

## 📊 Expected Results

| Check | Expected | Command |
|-------|----------|---------|
| **Extensions** | 2 | `SELECT count(*) FROM pg_extension WHERE extname IN ('postgis', 'vector');` |
| **RLS Tables** | 30+ | `SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;` |
| **Indexes** | 50+ | `SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';` |
| **Functions** | 30+ | `SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace;` |
| **Bars Data** | 5+ | `SELECT count(*) FROM bars;` |

---

## 🎯 Critical Success Metrics

✅ **Zero errors** in deployment logs  
✅ **All 4 phases** show "Complete" message  
✅ **Application** still functional (test key endpoints)  
✅ **Performance** within acceptable range (check slow queries)  

---

## 📞 Quick Support

- **Error**: Check `PHASED_MIGRATION_GUIDE.md` → Troubleshooting section
- **Rollback**: Use backup or `supabase db reset`
- **Logs**: Supabase Dashboard → Database → Logs

---

**Status**: Ready to deploy 🚀  
**Risk**: Low-Medium (phases 1-3), High (phase 4 - optional)  
**Recommendation**: Deploy phases 1-3 now, phase 4 later if time-constrained
