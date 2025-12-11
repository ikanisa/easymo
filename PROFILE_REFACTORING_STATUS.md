# Profile Refactoring - Current Status

**Date**: 2025-12-11  
**Progress**: 31.25% Complete (2.5/8 phases)

---

## ✅ COMPLETED PHASES

### Phase 1: Create wa-webhook-wallet ✅
**Status**: COMPLETE - Committed & Pushed

**What Was Done**:
- Created `supabase/functions/wa-webhook-wallet/` (352 lines)
- Copied 12 wallet handler files (2,260 lines)
- Implemented 32 complete routes:
  - 17 interactive button routes
  - 15 text message routes
- Full observability and error handling
- All wallet logic extracted from profile

**Files Created**:
- `wa-webhook-wallet/index.ts` (352 lines)
- `wa-webhook-wallet/function.json`
- `wa-webhook-wallet/README.md`
- `wa-webhook-wallet/wallet/` (12 files, 2,260 lines)

**Commit**: `96c26100`

---

### Phase 1.5: Remove Wallet Routes from Profile ✅
**Status**: COMPLETE - Committed & Pushed

**What Was Done**:
- Removed all wallet interactive button routes (17 routes)
- Removed all wallet text handlers (15 routes)
- Removed wallet state handlers (5 states)
- Removed referral code detection
- Replaced with deprecation messages

**Impact**:
- Profile reduced: 1,434 → 1,300 lines (-134 lines, -9.3%)
- 0 wallet imports remaining
- Clean separation achieved

**Commit**: `9f3c8a55`

---

### Phase 2: Add Business to wa-webhook-buy-sell ✅
**Status**: COMPLETE - Committed & Pushed

**What Was Done**:
- Copied 7 business files to `wa-webhook-buy-sell/my-business/` (1,548 lines)
- Added 13 interactive button routes to buy-sell webhook
- Added 5 text state handlers
- Business CRUD fully functional in buy-sell

**Files Created**:
- `wa-webhook-buy-sell/my-business/add_manual.ts` (16,030 bytes)
- `wa-webhook-buy-sell/my-business/create.ts` (1,792 bytes)
- `wa-webhook-buy-sell/my-business/delete.ts` (1,392 bytes)
- `wa-webhook-buy-sell/my-business/index.ts` (413 bytes)
- `wa-webhook-buy-sell/my-business/list.ts` (3,626 bytes)
- `wa-webhook-buy-sell/my-business/search.ts` (16,781 bytes)
- `wa-webhook-buy-sell/my-business/update.ts` (3,317 bytes)

**Files Modified**:
- `wa-webhook-buy-sell/index.ts` (+240 lines)

**Commit**: `106ebc94`

---

## ⏳ IN PROGRESS

### Phase 2 Cleanup: Remove Business from Profile
**Status**: PENDING (Next step)

**What Needs to Be Done**:
- Remove business interactive routes from profile (lines 253-404)
- Remove business text handlers from profile (lines 1006-1033)
- Replace with deprecation messages
- Expected reduction: 1,300 → ~700 lines (-600 lines, -46%)

**Business Imports to Remove** (22 found):
- `./business/list.ts` (6 imports)
- `./business/create.ts` (1 import)
- `./business/update.ts` (3 imports)
- `./business/delete.ts` (2 imports)
- `./business/search.ts` (3 imports)
- `./business/add_manual.ts` (7 imports)

**Route Patterns to Remove**:
- `IDS.MY_BUSINESSES`, `MY_BUSINESSES`, `my_business`
- `IDS.CREATE_BUSINESS`
- `BIZ::*`, `EDIT_BIZ::*`, `DELETE_BIZ::*`
- `CONFIRM_DELETE_BIZ::*`, `EDIT_BIZ_NAME::*`, `EDIT_BIZ_DESC::*`
- `BACK_BIZ::*`, `biz::*`
- `IDS.BUSINESS_SEARCH`, `claim::*`, `IDS.BUSINESS_CLAIM_CONFIRM`
- `IDS.BUSINESS_ADD_MANUAL`, `skip_description`, `skip_location`, `cat::*`

**State Handlers to Remove**:
- `business_create_name`
- `business_edit_name`
- `business_edit_description`
- `business_search`
- `business_add_manual`

---

## 📊 OVERALL STATISTICS

### Lines Extracted
- **Wallet**: 2,755 lines (495 main + 2,260 handlers)
- **Business**: 1,548 lines (handlers only, routes still in profile)
- **Total So Far**: 4,303 lines extracted

### Profile Webhook
- **Before**: 1,434 lines (10+ domains)
- **After Phase 1.5**: 1,300 lines (9 domains)
- **Current**: 1,300 lines (business routes present, need removal)
- **Target After Phase 2**: ~700 lines (8 domains)
- **Final Target**: ~300 lines (profile core only)

### Git Status
- **Branch**: `refactor/profile-phase1-wallet`
- **Commits**: 3 commits pushed
- **Status**: All changes committed and pushed
- **PR**: Ready to create

---

## 🚀 NEXT STEPS

### Immediate (Complete Phase 2)
1. **Remove business routes from profile** (manual edit required)
   - Interactive routes: lines 253-404 (~150 lines)
   - Text handlers: lines 1006-1033 (~25 lines)
   - Total removal: ~175 lines

2. **Test both webhooks**
   - wa-webhook-wallet (all wallet flows)
   - wa-webhook-buy-sell (all business flows)

3. **Commit Phase 2 cleanup**
   ```bash
   git add supabase/functions/wa-webhook-profile/index.ts
   git commit -m "refactor(profile): Phase 2 cleanup - Remove business routes"
   git push origin refactor/profile-phase1-wallet
   ```

### Create Pull Request
```
Title: refactor(profile): Phases 1-2 - Extract wallet & business to dedicated webhooks

Description:
PHASES 1-2 OF 8: Extract wallet and business logic

Completed:
✅ Phase 1: Created wa-webhook-wallet (2,755 lines extracted)
✅ Phase 1.5: Removed wallet routes from profile (-134 lines)
✅ Phase 2: Added business to wa-webhook-buy-sell (1,548 lines)
⏳ Phase 2 Cleanup: Business routes removal pending

Impact:
- wa-webhook-wallet: NEW dedicated wallet service
- wa-webhook-buy-sell: Enhanced with business management
- wa-webhook-profile: Reduced by 9.3%, more cleanup pending

Next: Complete Phase 2 cleanup, then Phases 3-8

See: PROFILE_REFACTORING_STATUS.md for detailed progress
```

### Future Phases (After Phase 2 Complete)
- **Phase 3**: Bars → waiter (~2,203 lines)
- **Phase 4**: Jobs → jobs (~439 lines)
- **Phase 5**: Properties → property (~455 lines)
- **Phase 6**: Vehicles → mobility (~526 lines)
- **Phase 7**: Simplify profile (~300 lines target)
- **Phase 8**: Delete `services/profile` (unused)

---

## 📋 TESTING CHECKLIST

### wa-webhook-wallet
- [ ] View wallet balance
- [ ] Transfer tokens
- [ ] Earn tokens (share flows)
- [ ] Redeem rewards
- [ ] View transactions
- [ ] Referral codes
- [ ] Purchase tokens
- [ ] Cash out to MoMo
- [ ] MoMo QR flows
- [ ] Leaderboard

### wa-webhook-buy-sell
- [ ] List my businesses
- [ ] Create new business
- [ ] Edit business (name, description)
- [ ] Delete business
- [ ] Business search
- [ ] Claim business
- [ ] Manual business add

### wa-webhook-profile
- [ ] Profile home menu
- [ ] Edit profile (name, language)
- [ ] Saved locations (add, edit, delete)
- [ ] No wallet/business functionality (deprecated messages)

---

## 🎯 SUCCESS CRITERIA

### Phase 2 Complete When:
- [x] Business files copied to wa-webhook-buy-sell
- [x] Business routes added to buy-sell webhook
- [ ] Business routes removed from profile webhook
- [ ] Profile reduced to ~700 lines
- [ ] All tests passing
- [ ] No regressions in any domain

### Ready for Phases 3-8 When:
- [ ] PR merged
- [ ] Deployed to production
- [ ] All flows tested and working
- [ ] Team trained on new structure

---

**Last Updated**: 2025-12-11 11:28 UTC  
**Next Review**: After Phase 2 cleanup completion
