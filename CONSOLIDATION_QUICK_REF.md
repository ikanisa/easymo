# Edge Function Consolidation - Quick Reference V3

## 🎯 Phase 1: Enhanced Consolidation (Current)

**Goal:** AI agents + jobs + marketplace + property → wa-webhook-unified  
**Timeline:** 5-6 weeks  
**Risk:** LOW (critical services protected) ✅  

### What's Changing
```
DELETE: wa-webhook-ai-agents/ai-agents/ (15 files, 6,500 LOC)
COPY:   wa-webhook-ai-agents/agents/* → wa-webhook-unified/agents/
COPY:   wa-webhook-jobs → wa-webhook-unified/domains/jobs/
COPY:   wa-webhook-marketplace → wa-webhook-unified/domains/marketplace/
COPY:   wa-webhook-property → wa-webhook-unified/domains/property/
DEPLOY: Gradual rollout per domain 0% → 100%
ARCHIVE: ai-agents, jobs, marketplace, property (after 30 days stable)
```

### 🔴 CRITICAL - NEVER MODIFY
```
🚫 DO NOT TOUCH: wa-webhook-mobility (26K LOC) - CRITICAL PRODUCTION
🚫 DO NOT TOUCH: wa-webhook-profile (6.5K LOC) - CRITICAL PRODUCTION
🚫 DO NOT TOUCH: wa-webhook-insurance (2.3K LOC) - CRITICAL PRODUCTION
```

### 🟡 Can Consolidate
```
✅ wa-webhook-jobs (4.4K LOC) → wa-webhook-unified
✅ wa-webhook-marketplace (4.2K LOC) → wa-webhook-unified
✅ wa-webhook-property (2.4K LOC) → wa-webhook-unified
✅ wa-webhook-core (router - KEEP for critical services)
```

---

## 📅 Weekly Checklist

| Week | Tasks | Domains |
|------|-------|---------|
| 1 | Copy agents, test | Agents only |
| 2 | Copy jobs/marketplace/property, add flags | All domains |
| 3 | Delete old code, deploy at 0% | All at 0% |
| 4 | Rollout AI agents 0% → 100% | Agents |
| 5 | Rollout jobs 0% → 100% | Jobs |
| 6 | Rollout marketplace & property 0% → 100% | Marketplace, Property |
| 7+ | Monitor 30 days each, archive | All |

---

## 🚨 Critical Rules

1. 🔴 **NEVER MODIFY** mobility, profile, insurance (CRITICAL PRODUCTION)
2. **GRADUAL ROLLOUT PER DOMAIN** - Use separate feature flags for each
3. **MONITOR INDEPENDENTLY** - Track each domain separately
4. **ROLLBACK PER DOMAIN** - Can roll back any domain to 0% instantly

---

## 📊 Rollout Steps (Per Domain)

```bash
# Week 4: AI Agents
Set UNIFIED_ROLLOUT_PERCENT=5  # AI agents only
Monitor 24-48 hours
Increase: 10% → 25% → 50% → 100%

# Week 5: Jobs Domain
Set ENABLE_UNIFIED_JOBS=true
Set JOBS_ROLLOUT_PERCENT=5
Monitor 24-48 hours
Increase: 10% → 25% → 50% → 100%

# Week 6: Marketplace & Property
Set ENABLE_UNIFIED_MARKETPLACE=true
Set MARKETPLACE_ROLLOUT_PERCENT=5
(Same for property)
Increase: 10% → 25% → 50% → 100%
```

---

## ✅ Success Metrics (Per Domain)

| Metric | Target |
|--------|--------|
| Error Rate | ≤ Baseline (current service) |
| Latency p95 | < 1200ms |
| Session Continuity | 100% |
| LOC Reduced | 17,000 total |
| Functions Archived | 4 (ai-agents, jobs, marketplace, property) |
| Critical Services Impacted | 0 (mobility, profile, insurance) |

---

## 🔄 Rollback Procedure (Per Domain)

**If error rate > 1% OR latency p95 > 2000ms in ANY domain:**

```bash
# Instant rollback for specific domain
Set UNIFIED_ROLLOUT_PERCENT=0        # For AI agents
Set JOBS_ROLLOUT_PERCENT=0           # For jobs
Set MARKETPLACE_ROLLOUT_PERCENT=0    # For marketplace
Set PROPERTY_ROLLOUT_PERCENT=0       # For property

# Verify traffic back to original service
Check domain-specific monitoring

# Investigate and fix issues
Review logs, debug, fix

# Resume rollout when ready
Start from lower percentage
```

---

## 📂 Domains to Copy (Weeks 1-2)

**AI Agents (Week 1):**
- farmer-agent.ts
- insurance-agent.ts
- jobs-agent.ts
- marketplace-agent.ts
- property-agent.ts
- rides-agent.ts
- waiter-agent.ts
- support-agent.ts (already exists)

**Domain Services (Week 2):**
- wa-webhook-jobs/* → wa-webhook-unified/domains/jobs/
- wa-webhook-marketplace/* → wa-webhook-unified/domains/marketplace/
- wa-webhook-property/* → wa-webhook-unified/domains/property/

**Delete (Week 3):**
- wa-webhook-ai-agents/ai-agents/ (entire folder)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| CONSOLIDATION_SUMMARY.md (V3) | Executive overview |
| SUPABASE_FUNCTIONS_CONSOLIDATION_PLAN.md (V3) | Full detailed plan (30K) |
| PHASE_1_CONSOLIDATION_CHECKLIST.md | Week-by-week tasks (needs V3 update) |
| This file (V3) | Quick reference |

---

## ⚠️ Common Mistakes to Avoid

1. ❌ Modifying mobility, profile, or insurance services
2. ❌ Deleting wa-webhook-core
3. ❌ Rolling out all domains at once (must be sequential)
4. ❌ Not monitoring each domain independently
5. ❌ Deploying without per-domain feature flags

---

## 📞 Get Help

**Technical Questions:** Review SUPABASE_FUNCTIONS_CONSOLIDATION_PLAN.md (V3)  
**Implementation Questions:** Follow PHASE_1_CONSOLIDATION_CHECKLIST.md  
**Rollback Issues:** See "Rollback Procedure" above  
**Critical Services:** 🚫 DO NOT MODIFY mobility, profile, insurance  

---

**Last Updated:** December 3, 2025 (V3 Enhanced)  
**Status:** Ready for Implementation ✅  
**Critical Services Protected:** mobility, profile, insurance 🔴
