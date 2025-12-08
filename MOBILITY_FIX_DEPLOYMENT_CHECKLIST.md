# Mobility Matching Fix - Deployment Checklist

## ✅ Pre-Deployment (Complete)

- [x] Root cause identified (table mismatch)
- [x] Migration created (20251209120000_fix_matching_table_mismatch.sql)
- [x] Migration tested (SQL syntax verified)
- [x] Deployment scripts created
- [x] Documentation complete
- [x] Files in correct locations

## 🚀 Deployment Steps

### Step 1: Sync Remote Migrations (if needed)
```bash
# Only if you see "Remote migration versions not found" error
supabase db pull
```
- [ ] Remote migrations synced (or not needed)

### Step 2: Deploy Migration
```bash
# Option A: Direct deploy
supabase db push --linked

# Option B: Automated script
./deploy-mobility-matching-fix.sh
```
- [ ] Migration deployed successfully
- [ ] No errors in deployment output

### Step 3: Verify Deployment
```bash
# Check functions exist
psql $DATABASE_URL -c "\df match_*_for_trip_v2"
```
Expected: 2 functions listed
- [ ] Functions exist in database

### Step 4: Test Functions
```bash
# Count open trips
psql $DATABASE_URL -c "SELECT COUNT(*), role FROM trips WHERE status='open' GROUP BY role;"

# If trips exist, test matching
psql $DATABASE_URL -c "SELECT * FROM match_drivers_for_trip_v2('<trip-id>', 9) LIMIT 1;"
```
- [ ] Functions return results (if trips exist)

## 📊 Post-Deployment Monitoring (24-48 hours)

### Immediate Checks (First 15 minutes)
```bash
# Monitor logs
supabase functions logs wa-webhook-mobility --tail | grep -E "(MATCHES_RESULT|NO_MATCHES_FOUND)"
```
- [ ] Logs show MATCHES_RESULT events
- [ ] Match counts > 0 (when trips exist)
- [ ] No error logs related to matching functions

### Hourly Checks (First 24 hours)
- [ ] User complaints about "no matches" decreased
- [ ] Match success rate increased
- [ ] No new errors in logs

### Daily Checks (48 hours)
- [ ] Matching working consistently
- [ ] No performance degradation
- [ ] User feedback positive

## 🆘 Rollback Plan (if needed)

### If Issues Occur:
```bash
# Option 1: Redeploy previous migration
supabase db push --file supabase/migrations/20251206090000_fix_mobility_matching_definitive.sql

# Option 2: Contact support for database restore
```
- [ ] Rollback plan documented
- [ ] Database backup available

## 📈 Success Criteria

- [ ] Migration deployed successfully
- [ ] Functions return matches when trips exist  
- [ ] Logs show MATCHES_RESULT with count > 0
- [ ] Users see list of nearby drivers/passengers
- [ ] No increase in error rates
- [ ] User complaints decreased

## 📝 Notes

**Deployment Date**: _________________  
**Deployed By**: _________________  
**Deployment Method**: _________________  
**Issues Encountered**: _________________  
**Resolution**: _________________

---

## Quick Reference

**Migration File**: `supabase/migrations/20251209120000_fix_matching_table_mismatch.sql`  
**Documentation**: `DEPLOYMENT_COMPLETE_MOBILITY_FIX.md`  
**Support**: `./diagnose-mobility-matching.sh`

**Status**: Ready for Deployment ✅
