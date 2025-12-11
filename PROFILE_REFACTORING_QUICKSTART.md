# Profile Refactoring - Quick Start Guide

**🚀 Ready to Execute**  
**⏱️ Estimated Time**: 8-10 working days  
**📋 Status**: All analysis complete, scripts ready

---

## 📚 Documentation Overview

You now have **4 comprehensive documents** + **1 executable script**:

| Document | Size | Purpose | When to Use |
|----------|------|---------|-------------|
| **PROFILE_REFACTORING_SUMMARY.md** | 8KB | Executive overview | Share with stakeholders |
| **PROFILE_REFACTORING_PLAN.md** | 14KB | Complete execution plan | During implementation |
| **PROFILE_DOMAIN_ANALYSIS.md** | 13KB | Detailed breakdown | Technical reference |
| **PROFILE_REFACTORING_QUICKSTART.md** | This file | Getting started | Start here! |
| **scripts/profile-refactor-phase1.sh** | 14KB | Phase 1 automation | Run to begin |

---

## 🎯 The Problem (60 Second Summary)

```
wa-webhook-profile = 1,434 lines 🔴 GOD FUNCTION
├── Wallet (2,260 lines) ⚠️ Should be separate webhook
├── Business (1,548 lines) ⚠️ Should be in buy-sell
├── Bars (2,203 lines) ⚠️ Should be in waiter
├── Jobs (439 lines) ⚠️ Should be in jobs
├── Properties (455 lines) ⚠️ Should be in property
├── Vehicles (526 lines) ⚠️ Should be in mobility
└── Profile (1,077 lines) ✅ Should stay here (reduce to ~300)

Goal: Split into focused webhooks ✅
Target: 300 lines (down from 1,434) = -79%
```

---

## ✅ Pre-Flight Checklist

Before starting, ensure:

- [ ] ✅ You've read `PROFILE_REFACTORING_SUMMARY.md`
- [ ] ✅ Team is aware and aligned
- [ ] ✅ You have access to:
  - Supabase project
  - GitHub repository (commit access)
  - WhatsApp test account
- [ ] ✅ Current main branch is stable
- [ ] ✅ All tests passing (`pnpm test:functions`)
- [ ] ✅ No ongoing profile-related PRs

---

## 🚀 Phase 1: Create Wallet Webhook (P0 - START HERE)

**Priority**: P0 (Immediate)  
**Time**: 1-2 days  
**Risk**: Low  
**Impact**: Creates new `wa-webhook-wallet` with 2,260 lines

### Step 1: Run Automation Script

```bash
# From project root
./scripts/profile-refactor-phase1.sh
```

**What it does**:
- ✅ Creates `supabase/functions/wa-webhook-wallet/` structure
- ✅ Copies 12 wallet handler files (2,260 lines)
- ✅ Generates `index.ts` template (~300 lines)
- ✅ Creates `function.json` and `README.md`

**Expected output**:
```
✅ Phase 1 Complete: wa-webhook-wallet created
📊 Summary:
   - Created wa-webhook-wallet structure
   - Copied 12 wallet handler files
   - Created index.ts template (~300 lines)
```

### Step 2: Review Generated Code

```bash
# View generated webhook
cd supabase/functions/wa-webhook-wallet

# Check structure
ls -la
# Expected:
# index.ts (main handler)
# wallet/ (12 handler files)
# function.json
# README.md
```

### Step 3: Complete Wallet Routes

The generated `index.ts` has placeholders. You need to:

1. **Review wallet routes** in original `wa-webhook-profile/index.ts` (lines ~234-500)
2. **Add missing routes** to `wa-webhook-wallet/index.ts`
3. **Verify all IDS constants** are imported

**Critical routes to verify**:
- `IDS.WALLET_HOME` → `./wallet/home.ts`
- `IDS.WALLET_TRANSFER` → `./wallet/transfer.ts`
- `IDS.WALLET_EARN` → `./wallet/earn.ts`
- `IDS.WALLET_REDEEM` → `./wallet/redeem.ts`
- `IDS.WALLET_TRANSACTIONS` → `./wallet/transactions.ts`
- `IDS.WALLET_REFERRAL` → `./wallet/referral.ts`
- And 6 more...

### Step 4: Test Wallet Webhook

```bash
# Unit tests (if any)
cd supabase/functions/wa-webhook-wallet
deno test --allow-all

# Integration tests
cd ../../..
pnpm test:functions

# Health check
supabase functions serve wa-webhook-wallet
# Then: curl http://localhost:54321/functions/v1/wa-webhook-wallet/health
```

### Step 5: Update Profile Webhook

Remove wallet routes from `wa-webhook-profile/index.ts`:

```typescript
// BEFORE (lines ~234-500):
else if (id === IDS.WALLET_HOME) {
  const { startWallet } = await import("./wallet/home.ts");
  handled = await startWallet(ctx, state);
}
// ... 250+ lines of wallet routes

// AFTER:
else if (id === IDS.WALLET_HOME || id.startsWith("WALLET_")) {
  // Forward to wa-webhook-wallet
  logEvent("WALLET_FORWARDED", { id, target: "wa-webhook-wallet" });
  await setState(supabase, ctx.profileId!, "wallet_redirect", { key: "wallet", buttonId: id });
  // TODO: Implement proper webhook forwarding
  handled = true;
}
```

### Step 6: Deploy to Staging

```bash
# Deploy wallet webhook
supabase functions deploy wa-webhook-wallet --project-ref <staging-ref>

# Deploy updated profile webhook
supabase functions deploy wa-webhook-profile --project-ref <staging-ref>
```

### Step 7: Test End-to-End

Use WhatsApp simulator or test account:

1. **Open profile menu**
2. **Click "Wallet" button**
3. **Verify redirects to wallet webhook**
4. **Test all wallet features**:
   - ✅ View balance
   - ✅ Transfer tokens
   - ✅ Earn tokens
   - ✅ Redeem rewards
   - ✅ View transactions
   - ✅ Referral codes
   - ✅ Purchase tokens
   - ✅ Cash out

### Step 8: Deploy to Production

```bash
# Production deployment
supabase functions deploy wa-webhook-wallet --project-ref <prod-ref>
supabase functions deploy wa-webhook-profile --project-ref <prod-ref>

# Monitor logs
supabase functions logs wa-webhook-wallet --tail
```

### Step 9: Commit & PR

```bash
git checkout -b refactor/profile-phase1-wallet
git add supabase/functions/wa-webhook-wallet/
git add supabase/functions/wa-webhook-profile/index.ts
git commit -m "refactor(profile): Extract wallet to dedicated webhook (Phase 1)

- Created wa-webhook-wallet with 2,260 lines of wallet logic
- Removed wallet routes from wa-webhook-profile
- wa-webhook-profile reduced from 1,434 → ~1,000 lines (-30%)

Part of Profile Refactoring Plan (8 phases)
See: PROFILE_REFACTORING_PLAN.md"

git push origin refactor/profile-phase1-wallet
```

**✅ Phase 1 Complete!**

---

## 🔄 Phase 2: Business → buy-sell (P1)

**Priority**: P1 (Week 1)  
**Time**: 1 day  
**Risk**: Low

### Quick Steps

```bash
# Move business files
mkdir -p supabase/functions/wa-webhook-buy-sell/my-business
cp -r supabase/functions/wa-webhook-profile/business/* \
      supabase/functions/wa-webhook-buy-sell/my-business/

# Update wa-webhook-buy-sell/index.ts
# Add routes for:
# - IDS.MY_BUSINESSES → ./my-business/list.ts
# - IDS.CREATE_BUSINESS → ./my-business/create.ts
# - IDS.EDIT_BIZ → ./my-business/update.ts
# - And 4 more...

# Test
cd supabase/functions/wa-webhook-buy-sell
deno test --allow-all

# Deploy
supabase functions deploy wa-webhook-buy-sell
supabase functions deploy wa-webhook-profile  # Remove business routes
```

**See**: `PROFILE_REFACTORING_PLAN.md` Phase 2 for details

---

## 🔄 Phase 3: Bars → waiter (P1)

**Priority**: P1 (Week 1)  
**Time**: 1 day  
**Risk**: Low

### Quick Steps

```bash
# Move bar files
mkdir -p supabase/functions/wa-webhook-waiter/my-bars
cp -r supabase/functions/wa-webhook-profile/bars/* \
      supabase/functions/wa-webhook-waiter/my-bars/

# Update wa-webhook-waiter/index.ts (add bar management routes)
# Test & deploy
```

**See**: `PROFILE_REFACTORING_PLAN.md` Phase 3 for details

---

## 🔄 Phases 4-6: Jobs, Properties, Vehicles (P2)

**Priority**: P2 (Week 2)  
**Time**: 3 days  
**Risk**: Low

Follow same pattern as Phases 2-3:
1. Move files to appropriate webhook
2. Update routes
3. Test
4. Deploy

**See**: `PROFILE_REFACTORING_PLAN.md` Phases 4-6 for details

---

## 🎯 Phase 7: Simplify Profile (P2)

**Priority**: P2 (Week 2)  
**Time**: 1 day  
**Risk**: Medium

### Final Cleanup

```bash
# Remove moved directories
rm -rf supabase/functions/wa-webhook-profile/wallet
rm -rf supabase/functions/wa-webhook-profile/business
rm -rf supabase/functions/wa-webhook-profile/bars
rm -rf supabase/functions/wa-webhook-profile/jobs
rm -rf supabase/functions/wa-webhook-profile/properties
rm -rf supabase/functions/wa-webhook-profile/vehicles

# Simplify index.ts
# Target: ~300 lines (down from 1,434)
# Keep only: profile core, saved locations, routing logic
```

**See**: `PROFILE_REFACTORING_PLAN.md` Phase 7 for details

---

## 🗑️ Phase 8: Delete services/profile (P3)

**Priority**: P3 (Week 3)  
**Time**: 1 day  
**Risk**: Low

### Verify Unused

```bash
# Double-check no usage
grep -r "@easymo/profile" --include="*.ts" . | grep -v "node_modules"
# Expected: No results

# Delete
rm -rf services/profile

# Update pnpm-workspace.yaml (if needed)
```

**See**: `PROFILE_REFACTORING_PLAN.md` Phase 8 for details

---

## 📊 Progress Tracking

Use this checklist to track your progress:

### Phase 1: Wallet Extraction ⏳
- [ ] Run `./scripts/profile-refactor-phase1.sh`
- [ ] Review generated code
- [ ] Complete wallet routes in index.ts
- [ ] Test wallet webhook (health, unit, integration)
- [ ] Update profile webhook (remove wallet routes)
- [ ] Deploy to staging
- [ ] E2E testing (10+ wallet flows)
- [ ] Deploy to production
- [ ] Create PR and merge
- [ ] Document lessons learned

### Phase 2: Business → buy-sell
- [ ] Copy business files
- [ ] Update buy-sell routes
- [ ] Test
- [ ] Deploy
- [ ] E2E testing

### Phase 3: Bars → waiter
- [ ] Copy bar files
- [ ] Update waiter routes
- [ ] Test
- [ ] Deploy
- [ ] E2E testing

### Phase 4: Jobs → jobs
- [ ] Copy job files
- [ ] Update jobs routes
- [ ] Test
- [ ] Deploy

### Phase 5: Properties → property
- [ ] Copy property files
- [ ] Update property routes
- [ ] Test
- [ ] Deploy

### Phase 6: Vehicles → mobility
- [ ] Copy vehicle files
- [ ] Update mobility routes
- [ ] Test
- [ ] Deploy

### Phase 7: Simplify Profile
- [ ] Remove all moved directories
- [ ] Simplify index.ts to ~300 lines
- [ ] Update tests
- [ ] Deploy

### Phase 8: Delete services/profile
- [ ] Final verification (no usage)
- [ ] Delete services/profile
- [ ] Update workspace config

---

## 🆘 Troubleshooting

### Issue: "Cannot find module './wallet/home.ts'"
**Solution**: Verify all wallet files were copied correctly. Check `supabase/functions/wa-webhook-wallet/wallet/` exists.

### Issue: Tests failing after migration
**Solution**: Update test imports to point to new webhook locations.

### Issue: Webhook signature validation failing
**Solution**: Ensure `WHATSAPP_APP_SECRET` is set in environment.

### Issue: State not persisting across webhooks
**Solution**: Verify state keys remain consistent when forwarding between webhooks.

### Issue: Routing loops (infinite redirects)
**Solution**: Check forwarding logic doesn't redirect back to original webhook.

**More help**: See `PROFILE_REFACTORING_PLAN.md` Section 10 (Risks & Mitigation)

---

## 📈 Success Metrics

Track these metrics after each phase:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Profile webhook size** | ~300 lines | `wc -l supabase/functions/wa-webhook-profile/index.ts` |
| **Wallet webhook created** | ✅ | `ls supabase/functions/wa-webhook-wallet/` |
| **All tests passing** | 100% | `pnpm test:functions` |
| **No production errors** | 0 | Monitor logs for 24h |
| **User flows working** | 100% | Test critical journeys |

---

## 🎓 Key Takeaways

### Do's ✅
- ✅ Test each phase thoroughly before moving to next
- ✅ Deploy to staging first
- ✅ Monitor logs after each deployment
- ✅ Keep commits focused (one phase = one PR)
- ✅ Document lessons learned

### Don'ts ❌
- ❌ Skip testing phases
- ❌ Deploy multiple phases at once
- ❌ Ignore failing tests
- ❌ Delete code before verifying it works in new location
- ❌ Rush the migration

---

## 📞 Need Help?

1. **Technical Questions**: Review `PROFILE_REFACTORING_PLAN.md`
2. **Architecture Questions**: See `PROFILE_DOMAIN_ANALYSIS.md`
3. **Quick Reference**: Use `PROFILE_REFACTORING_SUMMARY.md`
4. **Blocked?**: Create GitHub issue with `[Profile Refactoring]` prefix

---

## 🚀 Ready to Start?

**Run this now**:
```bash
./scripts/profile-refactor-phase1.sh
```

Then follow Step 2 above.

**Good luck! 🎯**

---

*Generated: 2025-12-11*  
*Status: Ready to Execute*  
*Estimated Completion: ~10 working days*
