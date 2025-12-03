# Consolidation Quick Reference

**Last Updated:** December 3, 2025  
**Status:** ✅ PHASE 1 COMPLETE

---

## 📊 Current State

| Item | Count |
|------|-------|
| **Total Functions** | 82 |
| **Deleted** | 15 |
| **Deployed** | wa-webhook-unified ✅ |
| **Protected** | 3 (mobility, profile, insurance) |
| **To Delete Later** | 4 (after migration) |

---

## 🎯 What Just Happened

✅ Deleted 15 duplicate/inactive functions  
✅ Removed 14 from Supabase production  
✅ Deployed wa-webhook-unified to production  
✅ Backed up all deleted code  
✅ Committed everything to Git  

**Commits:** 26334168, 54eb90b1, b55fccf8, 50e0057b, 3b994707

---

## 🚀 Next Steps (Week 4-6)

### Week 4: 10% Traffic
```bash
# Update WhatsApp webhook routing in Meta Business Suite
# Old: https://[project].supabase.co/functions/v1/wa-webhook-ai-agents
# New: https://[project].supabase.co/functions/v1/wa-webhook-unified
# Set: 10% → new, 90% → old

# Monitor
# - Error rates
# - Response times
# - Success rates
```

### Week 5: 50% Traffic
```bash
# Increase routing
# Set: 50% → new, 50% → old

# Validate
# - All 8 agents working
# - Database configs loading
# - Performance acceptable
```

### Week 6: 100% Traffic
```bash
# Complete migration
# Set: 100% → new, 0% → old

# Monitor for 30 days
```

### Week 7+: Cleanup
```bash
# After 30 days stable, delete old functions
supabase functions delete wa-webhook-ai-agents
supabase functions delete wa-webhook-jobs
supabase functions delete wa-webhook-marketplace
supabase functions delete wa-webhook-property

# Also delete from filesystem
rm -rf supabase/functions/wa-webhook-ai-agents
rm -rf supabase/functions/wa-webhook-jobs
rm -rf supabase/functions/wa-webhook-marketplace
rm -rf supabase/functions/wa-webhook-property

# Commit
git add . && git commit -m "chore: delete old webhook functions after migration complete"
```

---

## 🔍 Monitoring Checklist

### Key Metrics to Watch
- [ ] **Error Rate:** Should stay < 1%
- [ ] **Response Time:** Should stay < 2s
- [ ] **Success Rate:** Should stay > 99%
- [ ] **Agent Coverage:** All 8 agents responding
- [ ] **Message Dedup:** No duplicate processing
- [ ] **DLQ Messages:** Should be minimal

### Where to Monitor
- Supabase Dashboard: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/functions
- Logs: `supabase functions logs wa-webhook-unified`
- Metrics: Check `webhook_metrics` and `ai_agent_metrics` tables

---

## 🚨 Rollback Plan

If issues arise:

```bash
# 1. Stop sending traffic to wa-webhook-unified
# Update webhook URL back to old functions

# 2. Check logs
supabase functions logs wa-webhook-unified --limit 100

# 3. If needed, restore deleted functions
cp -r supabase/functions/.archive/agent-duplicates-20251203/* supabase/functions/
supabase functions deploy <function-name>

# 4. Debug and fix
# Deploy hotfix to wa-webhook-unified
supabase functions deploy wa-webhook-unified --no-verify-jwt

# 5. Resume migration
# Gradually increase traffic again
```

---

## 📦 Backups

All deleted functions backed up:
- `.archive/agent-duplicates-20251203/` (13 functions)
- `.archive/inactive-functions-20251203/` (1 function)
- `.archive/inactive-batch2-20251203/` (1 function)

**Recovery:** Available in Git history forever

---

## 📝 Important Files

- `SUPABASE_CONSOLIDATION_FINAL_REPORT.md` - Full details
- `SUPABASE_FUNCTIONS_DELETED.md` - Deletion summary
- `AGENT_DUPLICATES_DELETED.md` - Agent cleanup
- `WHY_DELETE_THESE_4_FUNCTIONS.md` - Reasoning
- `COMPLETE_FUNCTIONS_ANALYSIS.md` - Full function list

---

## 🔑 Key Decisions

1. **Protected:** mobility, profile, insurance (never delete)
2. **Consolidated:** 13 agents → 1 unified function
3. **Migration:** Gradual 10% → 50% → 100% over 3 weeks
4. **Cleanup:** Delete 4 old webhooks after 30 days stable

---

## ✅ Phase 1 Checklist

- [x] Analyze all functions
- [x] Identify duplicates
- [x] Delete duplicates
- [x] Deploy wa-webhook-unified
- [x] Test deployment
- [x] Document everything
- [x] Commit to Git
- [ ] Set up traffic routing (Week 4)
- [ ] Monitor migration (Weeks 4-6)
- [ ] Delete old functions (Week 7+)

---

**Current Status:** ✅ READY FOR WEEK 4 MIGRATION  
**Next Action:** Set up 10% traffic routing to wa-webhook-unified
