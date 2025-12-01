# Webhook Consolidation - Action Plan & Next Steps

**Date:** December 1, 2025  
**Status:** Phase 1 Complete ✅ | Phase 2.1 Setup Complete ✅  
**Current Branch:** `feature/webhook-consolidation-complete`

---

## 📋 Immediate Actions (Today/This Week)

### 1. Create Pull Request ⬅️ **DO THIS NOW**

```bash
# Push branch to remote
git push -u origin feature/webhook-consolidation-complete

# Create PR using GitHub CLI (if available)
gh pr create --title "Webhook Consolidation - Phase 1 & Phase 2.1" \
  --body-file PR_DESCRIPTION.md \
  --base main \
  --label "enhancement,documentation,infrastructure"

# OR create PR manually at:
# https://github.com/ikanisa/easymo/compare/feature/webhook-consolidation-complete
```

**PR Template:** `PR_DESCRIPTION.md` (ready to use)

### 2. Request Reviews

**Reviewers needed:**
- 2+ senior engineers (code review)
- 1 DevOps engineer (deployment review)
- 1 tech lead (architecture review)

**Estimated review time:** 30-45 minutes

**What to review:**
1. Feature flag logic in `router.ts` (42 lines)
2. Routing config in `route-config.ts` (9 lines)
3. Documentation completeness
4. Deployment safety

### 3. Deploy to Staging

**After PR approval:**

```bash
# Deploy wa-webhook-core with feature flags
supabase functions deploy wa-webhook-core --project-ref staging

# Set environment variables in Supabase dashboard
ENABLE_UNIFIED_ROUTING=true
UNIFIED_ROLLOUT_PERCENT=0
UNIFIED_AGENTS=support

# Test with WhatsApp messages
# Send "support" or "help" - should route to wa-webhook-unified
# Send "farmer" or "marketplace" - should route to legacy services

# Monitor logs
# Look for "UNIFIED_CANARY_ROUTING" events
```

**Success criteria:**
- ✅ Support queries route to wa-webhook-unified
- ✅ Other queries route to legacy services
- ✅ No errors in logs
- ✅ Response times normal

### 4. Deploy to Production (Disabled State)

**After staging test passes:**

```bash
# Deploy to production
supabase functions deploy wa-webhook-core

# DON'T set env vars (or set to disabled)
ENABLE_UNIFIED_ROUTING=false
UNIFIED_ROLLOUT_PERCENT=0

# Verify zero impact
# All traffic should continue to legacy services
```

**Success criteria:**
- ✅ Deployment successful
- ✅ Routing behavior unchanged
- ✅ Zero user impact
- ✅ Feature flags ready for future use

---

## 📅 Week-by-Week Plan

### Week 1 (Dec 1-7): Phase 1 & 2.1 ✅ **DONE**
- [x] Deep analysis
- [x] Feature flags
- [x] Documentation
- [x] Phase 2 setup
- [ ] PR review and approval
- [ ] Deploy to staging
- [ ] Deploy to production (disabled)

### Week 2 (Dec 8-14): Phase 2.2-2.4 - Port Shared Features

**Tasks:**
1. Port payment-handler.ts → marketplace-payment.ts (3-4 hours)
2. Port payment.ts → marketplace-payment-core.ts (3-4 hours)
3. Port media.ts → media-upload.ts (2 hours)
4. Port utils/index.ts → marketplace-utils.ts (1-2 hours)
5. Write unit tests (2 hours)
6. Update wa-webhook-marketplace to use shared tools (1 hour)

**Deliverables:**
- 4 new shared tool files (~1,383 lines)
- Unit tests passing
- wa-webhook-marketplace using shared tools
- Deployed and tested

**Success criteria:**
- All tools ported and working
- No functionality lost
- Tests passing
- Documentation updated

### Week 3 (Dec 15-21): Agent Migration (Part 1)

**Migrate 5 agents:**
1. Farmer Agent (Day 1)
2. Waiter Agent (Day 2)
3. Insurance Agent (Day 3)
4. Jobs Agent (Day 4)
5. Rides Agent (Day 5)

**Per-agent checklist:**
- [ ] Copy from wa-webhook-ai-agents/agents/
- [ ] Update to unified BaseAgent interface
- [ ] Test with unified orchestrator
- [ ] Add to AgentRegistry
- [ ] Add keywords to IntentClassifier
- [ ] Write E2E test
- [ ] Deploy with feature flag (agent allowlist)
- [ ] Monitor for 48 hours

### Week 4 (Dec 22-28): Agent Migration (Part 2) & Testing

**Migrate 4 agents:**
1. Property Agent (Day 1)
2. Sales Agent (Day 2)
3. Business Broker Agent (Day 3)
4. Marketplace Agent (Day 4-5, complex)

**Integration testing:**
- E2E test suite for all 10 agents
- Load testing (10k messages/min)
- Payment flow testing
- Session migration testing
- Agent handoff testing

### Week 5 (Dec 29 - Jan 4): Shared Code Cleanup

**Tasks:**
1. Consolidate WhatsApp clients (7 → 1)
2. Consolidate session managers (3 → 1)
3. Clean up duplicate base classes
4. Update all imports
5. Archive deprecated code

**Deliverables:**
- Single WhatsApp client implementation
- Single session manager
- ~12,000 lines of code removed
- All services using shared code

### Week 6 (Jan 5-11): Gradual Rollout & Deprecation

**Rollout schedule:**
- Day 1: Enable unified routing, 0% rollout (dry-run)
- Day 2: 5% canary rollout
- Day 3: 50% rollout
- Day 4: 100% rollout
- Day 5: Monitor and stabilize

**Deprecation:**
- Archive wa-webhook-ai-agents
- Archive wa-webhook-marketplace
- Remove from routing config
- Update documentation
- Remove feature flags (no longer needed)

---

## 🔧 Phase 2 Detailed Tasks

### Task 1: Port Payment Handler (3-4 hours)

**File to create:** `supabase/functions/_shared/tools/marketplace-payment.ts`

**Source:** `wa-webhook-marketplace/payment-handler.ts` (240 lines)

**What to do:**
1. Copy source file to new location
2. Update imports to use shared paths
3. Make generic (remove marketplace-specific assumptions)
4. Add comprehensive JSDoc comments
5. Export all public functions

**Functions to port:**
- `isPaymentCommand(text: string): boolean`
- `handlePaymentCommand(context: PaymentHandlerContext): Promise<string | null>`

**Testing:**
```typescript
// _shared/tools/__tests__/marketplace-payment.test.ts
Deno.test("isPaymentCommand detects payment keywords", () => {
  assert(isPaymentCommand("paid"));
  assert(isPaymentCommand("PAID"));
  assert(!isPaymentCommand("hello"));
});
```

### Task 2: Port Payment Core (3-4 hours)

**File to create:** `supabase/functions/_shared/tools/marketplace-payment-core.ts`

**Source:** `wa-webhook-marketplace/payment.ts` (547 lines)

**Functions to port:**
- `initiatePayment()`
- `buyerConfirmPayment()`
- `sellerConfirmPayment()`
- `cancelTransaction()`
- `getTransactionDetails()`

**Key features:**
- USSD tel: link generation
- Transaction state management
- MoMo merchant integration

### Task 3: Port Media Upload (2 hours)

**File to create:** `supabase/functions/_shared/media-upload.ts`

**Source:** `wa-webhook-marketplace/media.ts` (180 lines)

**Functions to port:**
- `downloadWhatsAppMedia()`
- `uploadToSupabase()`
- `handleMediaUpload()`
- `ensureStorageBucket()`

### Task 4: Port Utilities (1-2 hours)

**File to create:** `supabase/functions/_shared/marketplace-utils.ts`

**Source:** `wa-webhook-marketplace/utils/index.ts` (416 lines)

**Functions to port:**
- `extractWhatsAppMessage()`
- `parseLocationFromText()`
- `parseWhatsAppLocation()`
- `logMarketplaceEvent()`

---

## 📊 Progress Tracking

### Current Status
```
Overall: [████░░░░░░░░░░░░░░░░] 15%

Phase 1: [████████████████████] 100% ✅ COMPLETE
Phase 2: [█████░░░░░░░░░░░░░░░]  30% 🔄 Setup done
  2.1: Setup              [████████████████████] 100% ✅
  2.2: Payment handler    [░░░░░░░░░░░░░░░░░░░░]   0% ⏳
  2.3: Payment core       [░░░░░░░░░░░░░░░░░░░░]   0% ⏳
  2.4: Media upload       [░░░░░░░░░░░░░░░░░░░░]   0% ⏳
  2.5: Utilities          [░░░░░░░░░░░░░░░░░░░░]   0% ⏳
```

### Agent Migration Status
```
Agents: [██░░░░░░░░░░░░░░░░░░] 10% (1/10)

✅ Support (complete)
⏳ Farmer (Week 3, Day 1)
⏳ Waiter (Week 3, Day 2)
⏳ Insurance (Week 3, Day 3)
⏳ Jobs (Week 3, Day 4)
⏳ Rides (Week 3, Day 5)
⏳ Property (Week 4, Day 1)
⏳ Sales (Week 4, Day 2)
⏳ Business Broker (Week 4, Day 3)
⏳ Marketplace (Week 4, Day 4-5)
```

---

## 🎯 Success Metrics

### Technical Metrics

| Metric | Current | Week 6 Target | Status |
|--------|---------|---------------|--------|
| Total Services | 10 | 7 | 🔴 Not started |
| Code Size (AI agents) | ~21,000 lines | ~8,000 lines | 🔴 Not started |
| Duplicate Agents | 16+ | 0 | 🔴 Not started |
| WhatsApp Clients | 7+ | 1 | 🔴 Not started |
| Session Managers | 3 | 1 | 🔴 Not started |
| Deployment Time | 120s | 45s | 🔴 Not started |
| **Documentation** | **2,751 lines** | **Complete** | **✅ Done** |

### Business Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Zero production impact (Phase 1) | ✅ Required | ✅ Achieved |
| Agent accuracy preserved | 100% | ⏳ Pending |
| Payment success rate | 100% | ⏳ Pending |
| Session continuity | 100% | ⏳ Pending |
| Response time SLA | p95 < 2s | ⏳ Pending |

---

## 💡 Tips for Success

### When Porting Code

1. **Copy first, refactor later**
   - Get working code moved quickly
   - Refactor after tests pass

2. **Test immediately**
   - Write tests as you port
   - Verify behavior matches original

3. **Update imports carefully**
   - Check all import paths
   - Ensure no circular dependencies

4. **Document as you go**
   - Add JSDoc to all functions
   - Update README files

### When Migrating Agents

1. **One agent at a time**
   - Don't rush
   - Test thoroughly before moving on

2. **Use feature flags**
   - Test with UNIFIED_AGENTS allowlist
   - Gradual rollout per agent

3. **Monitor closely**
   - Watch logs for errors
   - Check response quality

4. **Compare responses**
   - A/B test old vs new
   - Verify behavior unchanged

---

## 🚨 Blockers & Dependencies

### Current Blockers
- None! Phase 1 is complete and ready for review.

### Dependencies
1. **Phase 2.2-2.5** depends on:
   - Phase 1 deployed to production
   - Shared tools directory created ✅

2. **Agent migration** depends on:
   - Phase 2 porting complete
   - Shared tools tested and working

3. **Rollout** depends on:
   - All agents migrated
   - Integration tests passing
   - Load tests passing

---

## 📞 Communication Plan

### Stakeholder Updates

**Weekly status email:**
- Subject: "Webhook Consolidation - Week X Update"
- Sections: Progress, Blockers, Next Week
- Audience: Engineering team, product, DevOps

**Daily standups:**
- Brief progress update
- Blockers discussion
- Help needed

**Slack channel:** #webhook-migration
- Real-time updates
- Questions and answers
- Deploy notifications

### Documentation Updates

Update these files weekly:
- `WEBHOOK_CONSOLIDATION_TRACKER.md` - Progress
- `WEBHOOK_CONSOLIDATION_STATUS.md` - Overall status
- `_shared/tools/README.md` - Migration status table

---

## 🎉 Celebration Milestones

- ✅ **Phase 1 Complete** - Dec 1 (TODAY!)
- 🎯 **Phase 2 Complete** - Dec 14 (Week 2)
- 🎯 **First Agent Migrated** - Dec 15 (Week 3)
- 🎯 **All Agents Migrated** - Dec 28 (Week 4)
- 🎯 **5% Rollout** - Jan 6 (Week 6)
- 🎯 **100% Rollout** - Jan 8 (Week 6)
- 🎯 **Legacy Services Archived** - Jan 11 (Week 6)

---

## 📚 Reference Documents

Quick access:
- **PR Description:** `PR_DESCRIPTION.md` (use for PR)
- **Quick Ref:** `WEBHOOK_CONSOLIDATION_QUICK_REF.md`
- **Full Status:** `WEBHOOK_CONSOLIDATION_STATUS.md`
- **Deep Analysis:** `WEBHOOK_ARCHITECTURE_DEEP_ANALYSIS.md`
- **Phase 2 Plan:** `PHASE2_IMPLEMENTATION_PLAN.md`
- **Feature Flags:** `WEBHOOK_CONSOLIDATION_ENV_VARS.md`

---

**Next Action:** Create PR using `PR_DESCRIPTION.md` ⬆️

**Estimated Completion:** January 11, 2026 (6 weeks from start)

**Current Progress:** 15% complete

**Status:** ✅ On track, no blockers
