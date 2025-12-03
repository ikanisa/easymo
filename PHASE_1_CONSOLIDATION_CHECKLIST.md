# Phase 1: AI Agent Consolidation - Action Checklist

**Goal:** Consolidate wa-webhook-ai-agents → wa-webhook-unified (AI agents only)  
**Timeline:** 3-4 weeks  
**Risk Level:** LOW (zero production impact)  
**LOC Cleanup:** ~6,500 lines

---

## ✅ Pre-Flight Checks

- [ ] Review SUPABASE_FUNCTIONS_CONSOLIDATION_PLAN.md (approved)
- [ ] Confirm production services will NOT be modified:
  - [ ] wa-webhook-mobility ✅ KEEP
  - [ ] wa-webhook-profile ✅ KEEP
  - [ ] wa-webhook-insurance ✅ KEEP
  - [ ] wa-webhook-jobs ✅ KEEP
  - [ ] wa-webhook-marketplace ✅ KEEP
  - [ ] wa-webhook-property ✅ KEEP
- [ ] Confirm wa-webhook-core will remain (needed for routing)
- [ ] Set up monitoring dashboards for AI agent traffic
- [ ] Create rollback procedure documentation

---

## Week 1: Agent Migration (ADDITIVE ONLY)

### Copy Database-Driven Agents to wa-webhook-unified

- [ ] Copy `wa-webhook-ai-agents/agents/farmer-agent.ts` → `wa-webhook-unified/agents/`
- [ ] Copy `wa-webhook-ai-agents/agents/insurance-agent.ts` → `wa-webhook-unified/agents/`
- [ ] Copy `wa-webhook-ai-agents/agents/jobs-agent.ts` → `wa-webhook-unified/agents/`
- [ ] Copy `wa-webhook-ai-agents/agents/marketplace-agent.ts` → `wa-webhook-unified/agents/`
- [ ] Copy `wa-webhook-ai-agents/agents/property-agent.ts` → `wa-webhook-unified/agents/`
- [ ] Copy `wa-webhook-ai-agents/agents/rides-agent.ts` → `wa-webhook-unified/agents/`
- [ ] Copy `wa-webhook-ai-agents/agents/waiter-agent.ts` → `wa-webhook-unified/agents/`

### Update Agent Registry

- [ ] Update `wa-webhook-unified/core/agent-registry.ts` to register all 8 agents
- [ ] Verify agent imports and initialization
- [ ] Update `wa-webhook-unified/core/unified-orchestrator.ts` if needed

### Testing

- [ ] Run unit tests for each agent in wa-webhook-unified
- [ ] Run integration tests (end-to-end message flows)
- [ ] Test database-driven config loading (ai_agent_system_instructions, ai_agent_personas)
- [ ] Verify all agent tools work correctly

### Deployment

- [ ] Deploy wa-webhook-unified to staging
- [ ] Test in staging environment
- [ ] Deploy wa-webhook-unified to production with UNIFIED_ROLLOUT_PERCENT=0
- [ ] Verify deployment successful (health check)

---

## Week 2: Internal Cleanup & Testing

### Delete Obsolete Agent Code (INTERNAL CLEANUP)

**Delete these 15 OLD agent files from wa-webhook-ai-agents/ai-agents/:**

- [ ] Delete `business_broker_agent.ts` (OLD, unused)
- [ ] Delete `farmer.ts` (OLD duplicate)
- [ ] Delete `farmer_agent.ts` (OLD duplicate)
- [ ] Delete `farmer_home.ts` (OLD duplicate)
- [ ] Delete `general_broker.ts` (OLD, unused)
- [ ] Delete `handlers.ts` (OLD)
- [ ] Delete `index.ts` (OLD)
- [ ] Delete `insurance_agent.ts` (OLD duplicate)
- [ ] Delete `integration.ts` (OLD)
- [ ] Delete `jobs_agent.ts` (OLD duplicate)
- [ ] Delete `location-helper.ts` (OLD)
- [ ] Delete `real_estate_agent.ts` (OLD duplicate)
- [ ] Delete `rides_agent.ts` (OLD duplicate)
- [ ] Delete `sales_agent.ts` (OLD)
- [ ] Delete `waiter_agent.ts` (OLD duplicate)

**Or simply:**
- [ ] Delete entire `supabase/functions/wa-webhook-ai-agents/ai-agents/` directory

### Verify No References

- [ ] Search codebase for imports from `ai-agents/` (should be zero)
- [ ] Verify wa-webhook-ai-agents/agents/ still intact
- [ ] Run tests to confirm no broken imports

### Testing & Monitoring Setup

- [ ] Set up error monitoring for wa-webhook-unified
- [ ] Set up latency tracking
- [ ] Set up session continuity tracking
- [ ] Create comparison dashboard (wa-webhook-ai-agents vs wa-webhook-unified)
- [ ] Document baseline metrics (current wa-webhook-ai-agents performance)

---

## Week 3: Gradual Rollout

### Traffic Migration (AI Agent Requests Only)

**Day 1-2: 5% Traffic**
- [ ] Set `UNIFIED_ROLLOUT_PERCENT=5` in environment variables
- [ ] Deploy configuration update
- [ ] Monitor for 48 hours:
  - [ ] Error rate < 0.1%
  - [ ] Latency p95 < 1200ms
  - [ ] Session continuity 100%
  - [ ] No customer complaints

**Day 3-4: 10% Traffic**
- [ ] Increase to `UNIFIED_ROLLOUT_PERCENT=10`
- [ ] Monitor for 48 hours (same criteria)

**Day 5-7: 25% Traffic**
- [ ] Increase to `UNIFIED_ROLLOUT_PERCENT=25`
- [ ] Monitor for 72 hours (same criteria)

**Day 8-10: 50% Traffic**
- [ ] Increase to `UNIFIED_ROLLOUT_PERCENT=50`
- [ ] Monitor for 72 hours (same criteria)
- [ ] Compare metrics: wa-webhook-ai-agents vs wa-webhook-unified

**Day 11-14: 100% Traffic**
- [ ] Increase to `UNIFIED_ROLLOUT_PERCENT=100`
- [ ] All AI agent traffic now on wa-webhook-unified
- [ ] Monitor continuously

### Rollback Procedure (If Issues Detected)
- [ ] Document rollback steps: Set `UNIFIED_ROLLOUT_PERCENT=0`
- [ ] Test rollback procedure in staging
- [ ] Define rollback triggers (error rate > 1%, latency p95 > 2000ms)

---

## Week 4+: Stabilization

### Monitoring Period (30 Days at 100%)

- [ ] Day 1-7: Daily monitoring (error rates, latency, sessions)
- [ ] Day 8-14: Monitor every 2 days
- [ ] Day 15-30: Weekly monitoring
- [ ] Collect user feedback (support tickets mentioning AI agents)
- [ ] Document any edge cases or issues

### Performance Comparison

- [ ] Compare metrics before/after:
  - [ ] Error rate
  - [ ] Response latency (p50, p95, p99)
  - [ ] Session continuity
  - [ ] User satisfaction
- [ ] Document improvements or regressions

### Archive wa-webhook-ai-agents

**After 30 days stable at 100%:**

- [ ] Verify zero traffic to wa-webhook-ai-agents
- [ ] Create archive: `supabase/functions/.archive/wa-webhook-ai-agents-YYYYMMDD/`
- [ ] Move wa-webhook-ai-agents to archive
- [ ] Update wa-webhook-core routing config (remove wa-webhook-ai-agents)
- [ ] Update documentation
- [ ] Notify team of completion

---

## Post-Consolidation

### Documentation Updates

- [ ] Update WEBHOOK_CONSOLIDATION_STATUS.md
- [ ] Update README files
- [ ] Update architecture diagrams
- [ ] Document lessons learned

### Code Quality

- [ ] Run linters on wa-webhook-unified
- [ ] Fix any warnings
- [ ] Add comments where needed
- [ ] Update tests

### Future Planning

- [ ] Evaluate Phase 2: Standalone agent-* functions consolidation
- [ ] Evaluate Phase 3: Admin API consolidation
- [ ] Evaluate Phase 4: Utility function consolidation
- [ ] Document future enhancement opportunities

---

## 🚨 Critical Reminders

**DO NOT:**
- ❌ Modify wa-webhook-mobility, -profile, -insurance, -jobs, -marketplace, -property
- ❌ Delete wa-webhook-core (needed for routing)
- ❌ Make breaking changes to webhook message formats
- ❌ Skip gradual rollout steps (always increase incrementally)

**DO:**
- ✅ Test thoroughly at each rollout stage
- ✅ Monitor metrics continuously
- ✅ Document any issues immediately
- ✅ Have rollback procedure ready
- ✅ Communicate progress to team

---

## Success Criteria

- [ ] ✅ All 8 agents working in wa-webhook-unified
- [ ] ✅ 100% of AI agent traffic on wa-webhook-unified
- [ ] ✅ Error rate ≤ baseline (wa-webhook-ai-agents)
- [ ] ✅ Latency ≤ baseline
- [ ] ✅ Zero production service disruptions
- [ ] ✅ 6,500 LOC cleaned up (ai-agents/ folder deleted)
- [ ] ✅ wa-webhook-ai-agents archived
- [ ] ✅ Documentation updated

---

**Status Tracking:** Update this checklist as you progress through each week.

**Last Updated:** December 3, 2025  
**Current Status:** Pre-Flight (awaiting approval)
