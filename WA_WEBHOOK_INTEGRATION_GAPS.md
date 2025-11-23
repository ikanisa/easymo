# WA-Webhook Integration Gaps Analysis
**Date**: 2025-11-23  
**Issue**: Migrations created but not integrated into wa-webhook code

---

## Problem Statement

Database migrations were created for:
1. ✅ wallet_get_balance RPC
2. ✅ insurance_admin_contacts table
3. ✅ token_allocations
4. ✅ countries table
5. ✅ rides enhancements
6. ✅ location_cache helpers

However, **NOT ALL** of these are being used in wa-webhook domains.

---

## Investigation Results

### ✅ ALREADY INTEGRATED

#### 1. Wallet RPC (`wallet_get_balance`)
**Migration**: `20251123135000_add_wallet_get_balance.sql`

**Usage in wa-webhook**:
- ✅ `domains/wallet/transfer.ts` - Line uses wallet_get_balance
- ✅ `domains/wallet/redeem.ts` - Line uses wallet_get_balance

**Status**: ✅ **INTEGRATED**

---

### ❌ NOT INTEGRATED

#### 2. Location Cache Helpers
**Files Created**:
- `domains/mobility/location_cache.ts` (100 lines)
- `domains/mobility/location_cache.test.ts` (60 lines)

**Problem**: NOT imported/used in `nearby.ts`, `schedule.ts`, or `driver_actions.ts`

**Impact**: Location validation helpers exist but aren't being called

**Fix Needed**: Import and use in mobility flows

---

#### 3. Insurance Admin Contacts
**Migration**: `20251123134000_seed_insurance_contacts.sql`

**Current Code**: `ins_admin_notify.ts` still uses hardcoded logic

**Problem**: Should query `insurance_admin_contacts` table instead of hardcoded numbers

**Fix Needed**: Update `ins_admin_notify.ts` to use new table

---

#### 4. Countries Table
**Migration**: `20251123130000_create_countries_table.sql`

**Problem**: No code in wa-webhook uses this table yet

**Expected Usage**:
- MOMO QR generation should check `countries.supports_momo`
- Exchange flows should validate country support

**Fix Needed**: Integrate into exchange/admin flows

---

#### 5. Token Allocations
**Migration**: `20251123133000_token_allocations.sql`

**Problem**: Created token_allocations table but no wa-webhook code uses it

**Expected Usage**:
- Insurance bonus allocation
- Referral rewards
- Admin token grants

**Fix Needed**: Create allocation workflow in wallet domain

---

## Root Cause

**The migrations update the DATABASE, but the WA-WEBHOOK CODE wasn't updated to USE them!**

This is a **code integration gap**, not a deployment issue.

---

## Required Fixes

### Priority 1: Insurance Admin Contacts

**File**: `supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts`

**Current**: Hardcoded admin WA IDs
**Fix**: Query `insurance_admin_contacts` table

```typescript
// BEFORE (hardcoded)
const adminWaIds = ["250795588248", "250793094876", "250788767816"];

// AFTER (from database)
const { data: admins } = await supabase
  .from('insurance_admin_contacts')
  .select('contact_value')
  .eq('is_active', true)
  .eq('contact_type', 'whatsapp');

const adminWaIds = (admins || []).map(a => 
  a.contact_value.replace(/\D/g, '')
);
```

---

### Priority 2: Location Cache Integration

**Files**: 
- `domains/mobility/nearby.ts`
- `domains/mobility/schedule.ts`
- `domains/mobility/driver_actions.ts`

**Fix**: Import and use location_cache helpers

```typescript
// Add import
import { 
  checkLocationCache, 
  isLocationCacheValid 
} from './location_cache.ts';

// Use in code
const cacheCheck = checkLocationCache(profile.last_location_at);
if (cacheCheck.needsRefresh) {
  await sendMessage(cacheCheck.message);
  return;
}
```

---

### Priority 3: Countries Table Integration

**File**: Create `domains/exchange/country_support.ts`

**Purpose**: Check country support for features

```typescript
export async function checkCountrySupport(
  supabase: SupabaseClient,
  phoneNumber: string,
  feature: 'momo' | 'rides' | 'insurance'
) {
  const countryCode = extractCountryCode(phoneNumber);
  
  const { data: country } = await supabase
    .from('countries')
    .select('*')
    .eq('country_code', countryCode)
    .single();
    
  if (!country) return { supported: false };
  
  switch(feature) {
    case 'momo':
      return { supported: country.supports_momo, provider: country.momo_provider };
    case 'rides':
      return { supported: country.supports_rides };
    case 'insurance':
      return { supported: country.supports_insurance };
  }
}
```

---

### Priority 4: Token Allocations Workflow

**File**: Create `domains/wallet/allocate.ts`

**Purpose**: Admin token allocation interface

```typescript
export async function processTokenAllocation(
  ctx: RouterContext,
  recipientPhone: string,
  amount: number,
  reason: string
) {
  // Find recipient
  const { data: recipient } = await ctx.supabase
    .from('profiles')
    .select('id')
    .eq('phone_number', recipientPhone)
    .single();
    
  if (!recipient) {
    return { error: 'Recipient not found' };
  }
  
  // Create allocation record
  const { data: allocation } = await ctx.supabase
    .from('token_allocations')
    .insert({
      admin_id: ctx.profileId,
      recipient_id: recipient.id,
      amount,
      reason,
      status: 'approved'
    })
    .select()
    .single();
    
  // Execute allocation
  await ctx.supabase.rpc('wallet_delta_fn', {
    p_profile_id: recipient.id,
    p_amount_tokens: amount,
    p_entry_type: 'admin_allocation',
    p_reference_table: 'token_allocations',
    p_reference_id: allocation.id
  });
  
  return { success: true, allocation };
}
```

---

## Implementation Plan

### Step 1: Fix Insurance Admin Contacts (15 min)
- Update `ins_admin_notify.ts`
- Test admin notifications
- Deploy

### Step 2: Integrate Location Cache (20 min)
- Update `nearby.ts`
- Update `schedule.ts`
- Update `driver_actions.ts`
- Test location workflows
- Deploy

### Step 3: Add Country Support Checks (25 min)
- Create `country_support.ts`
- Integrate into MOMO flows
- Integrate into rides flows
- Test
- Deploy

### Step 4: Token Allocation Workflow (30 min)
- Create `wallet/allocate.ts`
- Add admin menu option
- Create allocation UI
- Test
- Deploy

**Total Estimated Time**: 90 minutes

---

## Testing Checklist

After fixes:

- [ ] Insurance admin receives notifications (using database contacts)
- [ ] Location cache validation messages appear
- [ ] MOMO QR shows country not supported for unsupported countries
- [ ] Admin can allocate tokens via menu
- [ ] All token allocations logged in token_allocations table

---

## Why This Happened

1. **Migrations were created** ✅
2. **Migrations were applied** ✅
3. **Code was NOT updated to use the new tables/RPCs** ❌

**Lesson**: Creating database migrations is only HALF the work. The application code must be updated to USE the new schema.

---

## Recommended Action

**IMMEDIATE**: Fix Priority 1 & 2 (insurance + location cache)
**THIS WEEK**: Fix Priority 3 & 4 (countries + allocations)

These are **code-level integrations**, not deployment issues. The database is ready; the code just needs to call it.

---

**Analysis Date**: 2025-11-23 11:30 UTC
**Status**: Gaps identified, fixes designed, ready to implement
