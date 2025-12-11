# Phase 2: Edge Function Consolidation Plan

**Date:** December 10, 2025  
**Current Count:** 117 functions  
**Target:** 80-90 functions  
**Reduction Goal:** ~27-37 functions

---

## 🎯 Consolidation Strategy

### Immediate Actions (Quick Wins)

#### 1. Remove Archived Directories ✅ COMPLETE

- ✅ insurance-ocr.archived
- ✅ vehicle-ocr.archived
- ✅ ocr-processor.archived

**Result:** 120 → 117 functions

---

### Phase 2A: Identify Duplicate/Overlapping Functions

#### Webhook Functions (9 active - KEEP SEPARATE)

These are domain-specific and should remain separate per original plan:

- ✅ `wa-webhook-core` - Base WhatsApp webhook handler
- ✅ `wa-webhook-mobility` - 🔒 PROTECTED - Production trips/drivers
- ✅ `wa-webhook-insurance` - 🔒 PROTECTED - Production insurance
- ✅ `wa-webhook-profile` - 🔒 PROTECTED - Production user profiles
- ✅ `wa-webhook-property` - Property/real-estate domain
- ✅ `wa-webhook-buy-sell` - Marketplace domain (consider merging into property)
- ✅ `wa-webhook-waiter` - F&B/restaurant domain
- ✅ `wa-webhook-jobs` - Job board domain
- ✅ `wa-webhook-voice-calls` - Voice integration

**Decision:** Keep webhooks separate by domain. Potential merge: buy-sell → property

#### Agent Functions (2 active)

- `agent-buy-sell` - Overlaps with `wa-webhook-buy-sell`
- `agent-property-rental` - Overlaps with `wa-webhook-property`

**Consolidation Opportunity:**

- Merge agent logic into respective webhooks
- **Target:** 2 → 0 (save 2 functions)

---

### Phase 2B: Administrative Function Consolidation

#### Admin Functions (6 current)

- `admin-health` - Health checks
- `admin-messages` - Message management
- `admin-settings` - Settings management
- `admin-stats` - Statistics/analytics
- `admin-trips` - Trip management (mobility-specific)
- `admin-users` - User management

**Consolidation Opportunities:**

1. **Create unified admin API:** `admin-api`
   - Merge health, messages, settings, stats, users
   - Use route-based handlers internally
   - **Save:** 5 → 1 (save 4 functions)

2. **Keep domain-specific:**
   - `admin-trips` could stay or merge into mobility admin

**Target:** 6 → 2 functions (save 4 functions)

---

### Phase 2C: Utility Function Consolidation

#### Cleanup Functions (Multiple)

Current cleanup-related functions:

- `cleanup-expired`
- `cleanup-expired-intents`
- `cleanup-mobility-intents`
- `data-retention`

**Consolidation:**

- Create unified `scheduled-cleanup` function
- Use job types/parameters to differentiate
- **Target:** 4 → 1 (save 3 functions)

#### Lookup Functions

- `ai-lookup-customer`
- `bars-lookup`
- `business-lookup`

**Consolidation:**

- Consider unified `entity-lookup` with type parameter
- **Potential save:** 3 → 1 (save 2 functions)

#### Auth Functions

- `auth-qr-generate`
- `auth-qr-poll`
- `auth-qr-verify`

**Consolidation:**

- Create unified `auth-qr` with action parameter
- **Target:** 3 → 1 (save 2 functions)

---

### Phase 2D: Feature-Specific Review

#### Analytics Functions

- `analytics-forecast`
- `ai-contact-queue`
- Various monitoring functions

**Action:** Review usage and consolidate where appropriate

#### OCR/Processing Functions

- Check for remaining OCR functions
- Consolidate into single OCR service if multiple exist

---

## 📊 Consolidation Summary

| Category          | Current | Target   | Savings |
| ----------------- | ------- | -------- | ------- |
| Archived cleanup  | 120     | 117      | ✅ 3    |
| Agent functions   | 2       | 0        | 2       |
| Admin functions   | 6       | 2        | 4       |
| Cleanup utilities | 4       | 1        | 3       |
| Lookup functions  | 3       | 1        | 2       |
| Auth QR functions | 3       | 1        | 2       |
| **TOTAL**         | **117** | **~101** | **16**  |

**With additional review:** Target 80-90 (need to identify 11-21 more)

---

## 🚀 Implementation Plan

### Week 1: Safe Consolidations

**Day 1-2:** Admin Function Consolidation

```bash
# Create unified admin-api
mkdir -p supabase/functions/admin-api
# Merge routes from admin-{health,messages,settings,stats,users}
# Test thoroughly
# Archive old functions
```

**Day 3:** Agent Function Migration

```bash
# Merge agent-buy-sell logic into wa-webhook-buy-sell
# Merge agent-property-rental logic into wa-webhook-property
# Test integration
# Archive agent functions
```

**Day 4:** Cleanup Function Consolidation

```bash
# Create scheduled-cleanup with job types
# Migrate all cleanup logic
# Update cron schedules
# Test and archive old functions
```

**Day 5:** Utility Consolidations

```bash
# Consolidate lookup functions
# Consolidate auth-qr functions
# Test and archive
```

### Week 2: Deep Review & Additional Consolidation

**Day 6-7:** Function Usage Analysis

- Query production logs for unused functions
- Identify low-traffic candidates for consolidation
- Document dependencies

**Day 8-9:** Execute Additional Consolidations

- Merge identified low-traffic functions
- Create consolidated endpoints where appropriate

**Day 10:** Testing & Documentation

- Comprehensive testing of all changes
- Update documentation
- Deploy to staging
- Monitor

---

## ✅ Success Criteria

- [ ] Reduced from 117 to <90 functions
- [ ] All consolidated functions tested
- [ ] No production incidents
- [ ] Documentation updated
- [ ] Deployment runbook created
- [ ] Rollback plan documented

---

## ⚠️ Risk Mitigation

1. **Test thoroughly** - Each consolidation must have test coverage
2. **Feature flags** - Use flags to enable/disable consolidated endpoints
3. **Gradual rollout** - Deploy consolidations incrementally
4. **Monitor closely** - Watch error rates and performance
5. **Keep archives** - Don't delete code, archive in git
6. **Document changes** - Update all references in docs

---

## 📋 Execution Checklist

### Phase 2A: Archived Cleanup

- [x] Remove .archived directories (3 functions)
- [x] Verify removal
- [x] Commit changes

### Phase 2B: Agent Consolidation

- [ ] Analyze agent-buy-sell usage
- [ ] Merge into wa-webhook-buy-sell
- [ ] Test integration
- [ ] Analyze agent-property-rental
- [ ] Merge into wa-webhook-property
- [ ] Archive agent functions

### Phase 2C: Admin Consolidation

- [ ] Create admin-api structure
- [ ] Migrate admin-health
- [ ] Migrate admin-messages
- [ ] Migrate admin-settings
- [ ] Migrate admin-stats
- [ ] Migrate admin-users
- [ ] Test unified admin-api
- [ ] Archive old admin functions

### Phase 2D: Utility Consolidation

- [ ] Create scheduled-cleanup
- [ ] Migrate cleanup functions (4)
- [ ] Create entity-lookup
- [ ] Migrate lookup functions (3)
- [ ] Create auth-qr unified
- [ ] Migrate auth-qr functions (3)
- [ ] Test all utilities
- [ ] Archive old functions

### Phase 2E: Additional Review

- [ ] Analyze function usage logs
- [ ] Identify additional merge candidates
- [ ] Execute additional consolidations
- [ ] Reach target of 80-90 functions

---

**Next Step:** Begin with Phase 2B - Agent Function Consolidation (easiest wins)
