# Week 4 Manual Deletion Guide
**Date:** December 3, 2025  
**Status:** ⚠️ Requires Admin Privileges  
**Action Required:** Manual deletion via Supabase Dashboard

---

## 🚨 Issue Encountered

Automated deletion failed with **403 Forbidden**:
```
Your account does not have the necessary privileges to access this endpoint
```

**Root Cause:** Supabase CLI requires Owner/Admin role to delete functions via API.

**Resolution:** Manual deletion via Supabase Dashboard or request authorized user to execute.

---

## ✅ Local Archives Complete

Functions have been archived locally:

```
.archive/week4-deletions-20251203/
├── insurance-admin-api/
├── reminder-service/
├── search-alert-notifier/
├── search-indexer/
└── session-cleanup/
```

**Status:** Removed from local codebase ✓  
**Deployment:** Still active on Supabase (requires manual deletion)

---

## 📋 Functions to Delete (5 total)

### 1. session-cleanup (v199)
- **Location:** https://supabase.com/dashboard/project/{project}/functions/session-cleanup
- **Reason:** Functionality moved to data-retention
- **Code References:** 0
- **Risk:** NONE

### 2. search-alert-notifier (v157)
- **Location:** https://supabase.com/dashboard/project/{project}/functions/search-alert-notifier
- **Reason:** Feature never fully deployed
- **Code References:** 0
- **Risk:** NONE

### 3. reminder-service (v163)
- **Location:** https://supabase.com/dashboard/project/{project}/functions/reminder-service
- **Reason:** No usage patterns found
- **Code References:** 0
- **Risk:** NONE

### 4. search-indexer (v63)
- **Location:** https://supabase.com/dashboard/project/{project}/functions/search-indexer
- **Reason:** Moved to retrieval-search service
- **Code References:** 0
- **Risk:** NONE

### 5. insurance-admin-api (v17)
- **Location:** https://supabase.com/dashboard/project/{project}/functions/insurance-admin-api
- **Reason:** Admin features consolidated in admin-app
- **Code References:** 0
- **Risk:** NONE

---

## 🎯 Manual Deletion Steps

### Option 1: Supabase Dashboard (Recommended)

1. **Login to Supabase Dashboard**
   ```
   https://supabase.com/dashboard/project/{your-project-ref}/functions
   ```

2. **For each function above:**
   - Click on function name
   - Click "Delete" button (⋮ menu → Delete)
   - Confirm deletion

3. **Verify deletion:**
   ```bash
   supabase functions list | grep -E "session-cleanup|search-alert|reminder-service|search-indexer|insurance-admin-api"
   ```
   Should return no results.

### Option 2: Request Authorized User

Forward this guide to a user with Owner/Admin role:

```bash
# Login with admin credentials
supabase login

# Link to project
supabase link --project-ref {your-project-ref}

# Delete functions
supabase functions delete session-cleanup
supabase functions delete search-alert-notifier
supabase functions delete reminder-service
supabase functions delete search-indexer
supabase functions delete insurance-admin-api
```

### Option 3: Supabase CLI with Access Token

If you have an access token with admin privileges:

```bash
export SUPABASE_ACCESS_TOKEN="your-admin-token"

# Delete each function
supabase functions delete session-cleanup --project-ref {project-ref}
supabase functions delete search-alert-notifier --project-ref {project-ref}
supabase functions delete reminder-service --project-ref {project-ref}
supabase functions delete search-indexer --project-ref {project-ref}
supabase functions delete insurance-admin-api --project-ref {project-ref}
```

---

## 🔍 Verification Checklist

After manual deletion:

- [ ] All 5 functions removed from Supabase Dashboard
- [ ] `supabase functions list` shows 69 functions (down from 74)
- [ ] Protected functions still active:
  - [ ] wa-webhook-mobility ✓
  - [ ] wa-webhook-profile ✓
  - [ ] wa-webhook-insurance ✓
- [ ] No errors in application logs (24h monitoring)
- [ ] No broken webhook traffic

---

## 📊 Expected Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Total Functions** | 74 | 69 | -5 (7%) |
| **Error Rate** | < 0.1% | < 0.1% | No change |
| **Protected Webhooks** | 3 active | 3 active | No change |
| **Deployment Time** | ~90s | ~85s | -5s |

---

## 🔄 Rollback Plan

If issues arise after deletion:

### Restore from Local Archive
```bash
cd /Users/jeanbosco/workspace/easymo/supabase/functions

# Restore specific function
cp -r .archive/week4-deletions-20251203/session-cleanup .

# Redeploy
supabase functions deploy session-cleanup --project-ref {project-ref}
```

### Restore from Git
```bash
# Checkout pre-deletion state
git checkout week4-pre-deletion

# Redeploy function
cd supabase/functions/session-cleanup
supabase functions deploy session-cleanup
```

---

## 📈 Next Steps After Deletion

### Week 5: Webhook Integration (Starting Monday)

1. **Copy webhook domains** into wa-webhook-unified:
   - wa-webhook-ai-agents
   - wa-webhook-jobs
   - wa-webhook-marketplace
   - wa-webhook-property

2. **Setup traffic routing**:
   - Week 5: 10% traffic to unified
   - Week 6: 50% traffic
   - Week 7: 100% traffic + deprecate old webhooks

3. **Timeline:** 3 weeks (Weeks 5-7)

---

## 🔐 Security Notes

### Why Manual Deletion is Required

Supabase implements role-based access control (RBAC) for function deletion:

- **Owner Role:** Full access to delete functions
- **Admin Role:** Can delete functions
- **Developer Role:** Can deploy but NOT delete
- **Read-Only:** View only

**Current CLI User:** Developer role (can deploy, cannot delete)

**Recommendation:** Request Owner/Admin to execute deletions or obtain temporary elevated privileges.

---

## 📞 Support

If you encounter issues:

1. **Check Supabase Dashboard:** Verify functions still exist
2. **Review logs:** `/tmp/delete-*.log`
3. **Contact Supabase Support:** If deletion permissions needed
4. **Team Slack:** #platform-team for assistance

---

## ✅ Completion Criteria

Week 4 is complete when:

- [x] Functions archived locally ✓
- [ ] Functions deleted from Supabase (pending manual action)
- [ ] Function count: 69 (verified via `supabase functions list`)
- [ ] 24-hour monitoring: No errors
- [ ] Protected webhooks: 100% uptime

**Current Status:** Awaiting manual deletion by authorized user

---

**Created:** 2025-12-03 13:35 CET  
**Archive Location:** `.archive/week4-deletions-20251203/`  
**Git Backup Tag:** `week4-pre-deletion`  
**Next Review:** After manual deletion completion
