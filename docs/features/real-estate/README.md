# Real Estate Domain - Quick Reference

**Investigation Date:** December 10, 2025  
**Status:** ✅ Complete - Ready for Implementation  
**Priority:** 🔴 CRITICAL

## 🎯 The Problem

**4 separate agent implementations** causing:

- Inconsistent AI behavior
- Hardcoded fake data on errors
- Maintenance overhead
- Unpredictable costs (different models)

## 📋 The Solution

**Consolidate to 1 unified implementation** in 5 phases over 2 days.

## 🔗 Key Documents

| Document                                             | Purpose                      | Lines |
| ---------------------------------------------------- | ---------------------------- | ----- |
| [INVESTIGATION_REPORT.md](./INVESTIGATION_REPORT.md) | Complete findings & analysis | 400+  |
| [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md)     | Implementation roadmap       | 360   |

## 🚀 Quick Start

### For Reviewers

1. Read [INVESTIGATION_REPORT.md](./INVESTIGATION_REPORT.md) (10 min)
2. Review [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md) (15 min)
3. Approve and assign to developer

### For Implementers

1. Start with Phase 1 in [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md)
2. Follow 5 phases sequentially
3. Run tests after each phase
4. Update documentation as you go

## 📊 Quick Stats

| Metric                | Value             |
| --------------------- | ----------------- |
| Agent Implementations | 4 → 1             |
| System Prompts        | 4 → 1             |
| Estimated Effort      | 16 hours (2 days) |
| Files to Create       | 7                 |
| Files to Modify       | 5                 |
| Files to Delete       | 5                 |
| Priority              | 🔴 CRITICAL       |

## 🔴 Critical Issues

1. **Hardcoded Fallback Data** - Users see fake listings on errors
2. **4 Different Prompts** - Inconsistent AI behavior
3. **Database Column Names** - price vs price_monthly vs price_amount
4. **Different Models** - gemini vs gpt-4o

## ✅ What's Good

1. **State Management** - Excellent architecture in `_shared/agents/real-estate/types.ts`
2. **wa-webhook-property** - Already correct, no changes needed
3. **Database Schema** - Well-designed, just needs column standardization

## 🎯 Implementation Phases

| Phase | Tasks               | Duration | Priority |
| ----- | ------------------- | -------- | -------- |
| 1     | Unified Structure   | 4 hours  | P0       |
| 2     | Fix Critical Issues | 4 hours  | P0       |
| 3     | Update Consumers    | 4 hours  | P1       |
| 4     | Database            | 2 hours  | P1       |
| 5     | Clean Up            | 2 hours  | P2       |

## 📁 Key Files

### Current Implementations (4)

```
packages/agents/src/agents/property/real-estate.agent.ts
supabase/functions/wa-webhook/domains/ai-agents/real_estate_agent.ts
supabase/functions/wa-webhook/domains/property/ai_agent.ts
packages/ai/src/agents/openai/agent-definitions.ts
```

### Source of Truth

```
supabase/functions/_shared/agents/real-estate/types.ts  ← State management
```

### Target Structure

```
packages/agents/src/agents/property/
├── real-estate.agent.ts        # Main agent (refactored)
├── prompts/system-prompt.ts    # Single prompt
└── tools/                      # Unified tools
    ├── search-listings.ts
    ├── search-by-location.ts
    ├── deep-search.ts
    ├── contact-owner.ts
    └── schedule-viewing.ts
```

## 💰 Benefits

- ✅ **75% less code** to maintain (4 → 1 implementation)
- ✅ **Consistent AI** behavior
- ✅ **Better UX** (no fake data)
- ✅ **Predictable costs** (single model)
- ✅ **Easier onboarding** (one codebase to learn)

## ⚠️ Risks & Mitigation

| Risk                      | Mitigation                                 |
| ------------------------- | ------------------------------------------ |
| Breaking integrations     | Keep backwards compatibility in state keys |
| Database migration issues | Test in staging first, use COALESCE        |
| Feature regressions       | Comprehensive tests, gradual rollout       |

## 📅 Timeline

**Target Start:** December 11, 2025  
**Target Complete:** December 12, 2025

- **Day 1:** Phases 1-2 (P0 critical fixes)
- **Day 2:** Phases 3-5 (updates, database, cleanup)

## 🔍 Investigation Methodology

1. Code search for all real estate/property files
2. Manual review of each implementation
3. Database schema analysis
4. State management review
5. Documentation of findings

## 📞 Questions?

See detailed documentation:

- [INVESTIGATION_REPORT.md](./INVESTIGATION_REPORT.md) - Full analysis
- [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md) - Implementation guide

---

**Status:** ✅ Investigation Complete  
**Branch:** refactor/phase2-edge-functions  
**Commit:** c3b25fd3  
**Ready:** Yes - Awaiting implementation assignment
