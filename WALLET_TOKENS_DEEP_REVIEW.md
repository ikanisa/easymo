# Wallet & Tokens System - Deep Review & Implementation Plan

**Review Date:** 2025-11-23  
**Status:** 🔴 CRITICAL - Missing Database Components

---

## 🔴 ISSUES IDENTIFIED

### Issue 1: "Can't create your share link" (EARN TOKENS)
**Status:** ✅ FIXED - Share easyMO is working
**Root Cause:** Migrations were deployed successfully
**Solution:** Already deployed in previous fix

### Issue 2: "No response when transferring tokens"
**Status:** ❌ BROKEN - Missing RPC function
**Root Cause:** `wallet_transfer()` RPC function NOT deployed
**Solution:** Deploy migration `20251123152000_add_wallet_transfer_rpc.sql`

### Issue 3: "Can't show rewards" (REDEEM)
**Status:** ❌ BROKEN - Missing tables and RPC
**Root Cause:** Missing `redeem_rewards`, `redeem_requests` tables and `wallet_redeem_request()` RPC
**Solution:** Deploy migrations `20251118101400_create_redeem_tables.sql` and related

---

## 📊 DATABASE STATUS (Current)

### ✅ Tables That Exist
- `token_allocations` - Token grant/debit records
- `referral_links` - User referral codes (Share easyMO)
- `user_referrals` - Referral tracking
- `profiles` - User profiles with token balance

### ❌ Tables MISSING
- `wallet_partners` - Partners who can receive/send tokens
- `redeem_rewards` - Available rewards catalog
- `redeem_requests` - User redemption requests
- `token_rewards` - Reward definitions (possible alternate name)

### ❌ RPC Functions MISSING
- `wallet_transfer(p_from, p_to, p_amount, p_reason, p_meta)` - Transfer tokens
- `wallet_redeem_request(p_profile, p_option_id, p_idempotency_key)` - Redeem tokens
- `wallet_summary(p_profile_id)` - Get balance summary

---

## 🎯 REQUIREMENTS SPECIFICATION

### 1. Earn Tokens (Referral System)
**Status:** ✅ WORKING

**Flow:**
```
User taps "Earn tokens"
    ↓
Generate referral link (https://wa.me/22893002751?text=REF:<CODE>)
    ↓
Friend taps link → Sends message with REF:CODE
    ↓
System calls process_referral(code, new_user_id)
    ↓
INSERT INTO token_allocations (profile_id, amount=1000, type='referral_bonus')
    ↓
Referrer earns 10 tokens (1000 cents) ✅
```

**Database:**
- ✅ `referral_links` table
- ✅ `user_referrals` table
- ✅ `process_referral()` RPC

---

### 2. Insurance Token Allocation (Admin Panel)
**Status:** ⚠️ PARTIAL - Logic exists, admin UI needs verification

**Requirements:**
- Admin selects user's WhatsApp number from dropdown
- Dropdown shows ONLY users with active insurance policies
- User can earn 2000 tokens per insurance policy
- Cannot allocate tokens twice for same policy
- One user can have multiple policies → multiple 2000 token rewards

**Flow:**
```
Admin Panel
    ↓
Select user with active insurance policy
    ↓
Click "Allocate Tokens"
    ↓
INSERT INTO token_allocations (
    profile_id,
    amount=200000,  -- 2000 tokens
    type='insurance_purchase',
    metadata={policy_id}
)
    ↓
Check: Has this policy_id been allocated before?
    ↓
If NO → Grant 2000 tokens
If YES → Show error "Already allocated for this policy"
```

**Database Tables Needed:**
- ✅ `token_allocations` (exists)
- ✅ `insurance_policies` (exists - need to verify)
- ❌ Admin UI endpoint (needs implementation/verification)

**Logic:**
```sql
-- Check if already allocated
SELECT COUNT(*) FROM token_allocations
WHERE metadata->>'policy_id' = '<policy_id>'
AND type = 'insurance_purchase';

-- If count = 0, allocate
INSERT INTO token_allocations (profile_id, amount, type, metadata)
VALUES ('<user_id>', 200000, 'insurance_purchase', '{"policy_id": "<policy_id>"}');
```

---

### 3. Transfer Tokens
**Status:** ❌ BROKEN - Missing RPC function

**Requirements:**
- User must have minimum 2000 tokens to transfer
- Can transfer to:
  - Listed partner numbers (from `wallet_partners` table)
  - Manually entered WhatsApp number
- Cannot transfer to yourself
- Must have sufficient balance

**Flow:**
```
User taps "Transfer tokens"
    ↓
Check balance >= 2000 tokens
    ↓
If balance < 2000:
    Show "⚠️ You need at least 2000 tokens to transfer. Your balance: X."
    ↓
If balance >= 2000:
    Show partner list OR "Enter number manually"
    ↓
User selects recipient
    ↓
User enters amount
    ↓
Validate: amount <= balance
    ↓
Call wallet_transfer(from, to, amount)
    ↓
Debit sender: INSERT token_allocations (profile_id=from, amount=-X, type='transfer_sent')
Credit recipient: INSERT token_allocations (profile_id=to, amount=+X, type='transfer_received')
    ↓
Send confirmation messages to both users
```

**Database:**
- ✅ `token_allocations` (for debits/credits)
- ❌ `wallet_partners` (MISSING - list of partner numbers)
- ❌ `wallet_transfer()` RPC (MISSING)

---

### 4. Redeem Tokens
**Status:** ❌ BROKEN - Missing tables and RPC

**Requirements:**
- User must have minimum 2000 tokens to redeem
- Shows list of available rewards
- User selects reward, confirms
- Tokens deducted, redemption request created for admin fulfillment

**Flow:**
```
User taps "Redeem"
    ↓
Check balance >= 2000 tokens
    ↓
If balance < 2000:
    Show "⚠️ You need at least 2000 tokens to redeem. Your balance: X."
    ↓
If balance >= 2000:
    Load rewards from redeem_rewards table
    ↓
User selects reward (e.g., "5000 RWF Airtime - 5000 tokens")
    ↓
Confirm redemption
    ↓
Call wallet_redeem_request(profile_id, option_id)
    ↓
Debit tokens: INSERT token_allocations (profile_id, amount=-5000, type='redemption')
INSERT INTO redeem_requests (profile_id, option_id, status='pending')
    ↓
Send message: "✅ Redemption requested. You'll be notified when ready."
    ↓
Admin receives notification
```

**Database:**
- ✅ `token_allocations` (for debits)
- ❌ `redeem_rewards` (MISSING - catalog of rewards)
- ❌ `redeem_requests` (MISSING - track redemption requests)
- ❌ `wallet_redeem_request()` RPC (MISSING)

---

## 📋 MIGRATIONS TO DEPLOY

### Priority 1: Core Wallet Functions
1. `20251118093000_wallet_double_entry.sql` - Double-entry wallet system
2. `20251118101400_create_redeem_tables.sql` - Redeem rewards tables
3. `20251118101500_wallet_redeem_referral_v2.sql` - Redeem/referral logic

### Priority 2: Token System
4. `20251123133000_token_allocations.sql` - Token allocations table
5. `20251123152000_add_wallet_transfer_rpc.sql` - wallet_transfer() RPC
6. `20251123150000_create_token_rewards_table.sql` - Token rewards catalog

### Priority 3: Configuration
7. `20251122111700_fix_wallet_system_config.sql` - Wallet system config
8. `20251123175000_wallet_insurance_eligible.sql` - Insurance eligibility
9. `20251123180000_set_wallet_system_profile.sql` - Wallet system profile

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Deploy Database Migrations ⏳
```bash
export DATABASE_URL="postgresql://postgres:***@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# Core wallet
psql $DATABASE_URL -f supabase/migrations/20251118093000_wallet_double_entry.sql
psql $DATABASE_URL -f supabase/migrations/20251118101400_create_redeem_tables.sql
psql $DATABASE_URL -f supabase/migrations/20251118101500_wallet_redeem_referral_v2.sql

# Token system
psql $DATABASE_URL -f supabase/migrations/20251123133000_token_allocations.sql
psql $DATABASE_URL -f supabase/migrations/20251123152000_add_wallet_transfer_rpc.sql
psql $DATABASE_URL -f supabase/migrations/20251123150000_create_token_rewards_table.sql

# Configuration
psql $DATABASE_URL -f supabase/migrations/20251122111700_fix_wallet_system_config.sql
psql $DATABASE_URL -f supabase/migrations/20251123175000_wallet_insurance_eligible.sql
psql $DATABASE_URL -f supabase/migrations/20251123180000_set_wallet_system_profile.sql
```

### Phase 2: Verify Database ✅
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('wallet_partners', 'redeem_rewards', 'redeem_requests', 'token_allocations');

-- Check RPC functions
SELECT proname FROM pg_proc 
WHERE proname IN ('wallet_transfer', 'wallet_redeem_request', 'wallet_summary');

-- Test wallet_transfer
SELECT wallet_transfer(
    '<sender_id>'::uuid,
    '<recipient_id>'::uuid,
    1000,
    'test_transfer',
    '{"test": true}'::jsonb
);
```

### Phase 3: Deploy Edge Function 🚀
```bash
# Already deployed, but redeploy to ensure latest code
pnpm run functions:deploy:wa-main
```

### Phase 4: Admin Panel Implementation 🎨
**Location:** `admin-app/components/wallet/`

**Components Needed:**
1. Insurance Token Allocation UI
   - Dropdown: Users with active insurance policies
   - Button: "Allocate 2000 Tokens"
   - Validation: Check if policy already allocated

2. Wallet Management Dashboard
   - View all token allocations
   - Filter by type (referral, insurance, transfer, redemption)
   - User token balances

**API Endpoints:**
```typescript
// GET /api/admin/insurance/eligible-for-tokens
// Returns: Users with active insurance who haven't been allocated tokens

// POST /api/admin/wallet/allocate-insurance-tokens
// Body: { user_id, policy_id, amount: 200000 }
// Returns: Success/failure
```

### Phase 5: Testing Checklist ✅
- [ ] Earn tokens (referral) works
- [ ] Transfer tokens with balance check (2000 min)
- [ ] Transfer to partner number
- [ ] Transfer to manual number
- [ ] Redeem tokens with balance check (2000 min)
- [ ] Redeem shows rewards list
- [ ] Redeem deducts tokens
- [ ] Admin can allocate insurance tokens
- [ ] Cannot allocate same policy twice
- [ ] User with multiple policies gets multiple rewards

---

## 🎯 SUCCESS CRITERIA

### Earn Tokens
✅ User taps "Earn tokens"  
✅ Receives referral link  
✅ Friend joins via link  
✅ Referrer earns 10 tokens  

### Transfer Tokens
- [ ] Balance check enforced (2000 min)
- [ ] Partner list loads
- [ ] Manual number entry works
- [ ] Transfer successful
- [ ] Recipient notified
- [ ] Balances updated correctly

### Redeem Tokens
- [ ] Balance check enforced (2000 min)
- [ ] Rewards list loads
- [ ] Redemption creates request
- [ ] Tokens deducted
- [ ] Admin notified

### Admin Panel
- [ ] Insurance token allocation UI exists
- [ ] Shows only eligible users (active policies)
- [ ] Allocates 2000 tokens per policy
- [ ] Prevents duplicate allocation
- [ ] Supports multiple policies per user

---

## 📁 Files Modified/Created

### Edge Function (wa-webhook)
- ✅ `domains/wallet/home.ts` - Wallet menu
- ✅ `domains/wallet/earn.ts` - Earn tokens (referrals)
- ✅ `domains/wallet/transfer.ts` - Transfer tokens
- ✅ `domains/wallet/redeem.ts` - Redeem tokens
- ✅ `domains/wallet/allocate.ts` - Token allocation logic
- ✅ `rpc/wallet.ts` - Wallet RPC wrappers

### Admin Panel (admin-app)
- ⏳ `components/wallet/InsuranceTokenAllocator.tsx` - NEW
- ⏳ `app/api/admin/wallet/allocate-insurance-tokens/route.ts` - NEW
- ⏳ `app/admin/wallet/page.tsx` - Wallet management dashboard

### Database Migrations
- ✅ All migrations listed in Phase 1 plan

---

## 🚨 IMMEDIATE ACTION REQUIRED

1. **Deploy migrations** (Phase 1) - 15 minutes
2. **Verify database** (Phase 2) - 5 minutes
3. **Test wallet flows** (Phase 5) - 20 minutes
4. **Implement admin UI** (Phase 4) - 2-4 hours

**Total Time to Full Implementation:** ~3-4 hours

---

**Next Step:** Deploy migrations immediately to restore wallet functionality!

