# Insurance Webhook Function - Deep Audit Report

**Date:** December 18, 2025  
**Function:** `wa-webhook-insurance`  
**Issue:** Users tap insurance from home menu but don't get responses, no logs in edge function

---

## Executive Summary

The insurance webhook functionality has **CRITICAL GAPS**:
1. **Two disconnected implementations** - one unused standalone function, one inline handler
2. **Database schema mismatch** - current table uses `destination`, user wants `phone`
3. **No logging** - function never gets called, so no logs appear
4. **Workflow confusion** - unclear which code path is actually executed

---

## Current Architecture

### 1. Standalone Function (NOT USED)
**Location:** `supabase/functions/wa-webhook-insurance/index.ts`

This is a **complete standalone edge function** that:
- Expects WhatsApp webhook payload
- Fetches contacts from `insurance_admin_contacts` table
- Uses `destination` column (not `phone`)
- Formats contacts and sends WhatsApp message
- **PROBLEM:** This function is **NEVER CALLED** from the routing logic

### 2. Inline Handler (ACTUALLY USED)
**Location:** `supabase/functions/wa-webhook-core/router.ts` → `handleInsuranceAgentRequest()`

This is called when user selects "insurance" from home menu:
- Queries `insurance_admin_contacts` table
- Uses `destination` column
- Formats message inline
- Sends WhatsApp message directly
- **PROBLEM:** Uses different logic than standalone function, different error handling

---

## Database Schema Analysis

### Current Schema (FROM SUPABASE)
```sql
insurance_admin_contacts (
  id uuid PRIMARY KEY,
  channel text NOT NULL DEFAULT 'whatsapp',
  destination text NOT NULL UNIQUE,  -- ← Uses 'destination', not 'phone'
  display_name text,
  category text DEFAULT 'insurance',
  display_order integer DEFAULT 1,
  priority integer DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz,
  updated_at timestamptz
)
```

### User's Desired Schema (FROM MIGRATION)
```sql
insurance_admin_contacts (
  phone text PRIMARY KEY,  -- ← Wants 'phone', not 'destination'
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz,
  updated_at timestamptz
)
```

**GAP:** Column name mismatch (`destination` vs `phone`)

### Current Data
```sql
-- Current records in database:
1. destination: '+250795588248', display_name: 'Insurance Team'
2. destination: '+250796884076', display_name: 'Claims Support'
```

---

## Workflow Analysis

### Expected Flow
```
User taps "insurance" from home menu
  ↓
wa-webhook-core receives request
  ↓
handleHomeMenu() detects selection === "insurance"
  ↓
handleInsuranceAgentRequest(phoneNumber) called
  ↓
Query insurance_admin_contacts table
  ↓
Format message with contact links
  ↓
Send WhatsApp message to user
```

### Actual Flow (WHAT HAPPENS)
```
User taps "insurance" from home menu
  ↓
wa-webhook-core receives request ✅
  ↓
handleHomeMenu() detects selection === "insurance" ✅
  ↓
handleInsuranceAgentRequest(phoneNumber) called ✅
  ↓
[PROBLEM: Function might be failing silently]
  ↓
User receives no response ❌
```

---

## Critical Issues Identified

### 1. ⚠️ **CRITICAL: Column Name Mismatch**
**Location:** `supabase/functions/wa-webhook-core/router.ts:60`

**Problem:**
- Code queries: `.select("destination, display_name")`
- User's migration wants: `phone` column
- Current table has: `destination` column

**Impact:** Function works with current schema, but user wants to change to `phone`

**Fix Required:** Update code to use `phone` instead of `destination`, OR update migration to use `destination`

### 2. ⚠️ **CRITICAL: Standalone Function Never Called**
**Location:** `supabase/functions/wa-webhook-insurance/index.ts`

**Problem:**
- Complete standalone function exists with proper error handling
- But it's NEVER routed to or called
- Home menu uses inline handler instead

**Impact:** Duplicate code, maintenance burden, confusion

**Fix Required:** Either:
- Option A: Route to standalone function (recommended)
- Option B: Remove standalone function and keep inline handler

### 3. ⚠️ **CRITICAL: No Structured Logging**
**Location:** `supabase/functions/wa-webhook-core/router.ts:55-105`

**Problem:**
- Uses basic `logInfo()`, `logError()`, `logWarn()` functions
- Not using structured logging from observability.ts
- Errors might be swallowed

**Current Code:**
```typescript
logInfo("INSURANCE_SELECTED", { from: phoneNumber }, { correlationId: corrId });
// ... no structured events for insurance workflow
```

**Impact:** Cannot debug why users aren't getting responses

**Fix Required:** Add structured logging like:
```typescript
await logStructuredEvent("INSURANCE_REQUEST_START", {
  from: phoneNumber,
  correlationId,
});
```

### 4. ⚠️ **CRITICAL: Silent Error Handling**
**Location:** `supabase/functions/wa-webhook-core/router.ts:100-104`

**Problem:**
- Errors are caught but only logged
- No structured error events
- User gets generic fallback message
- No visibility into what went wrong

```typescript
} catch (err) {
  logError("INSURANCE_HANDLER_ERROR", { error: String(err) }, { correlationId: crypto.randomUUID() });
  // Send fallback message on any error
  await sendText(phoneNumber, "For insurance services, please contact our support team.");
}
```

**Impact:** Users might be receiving fallback message, but we can't see why

### 5. ⚠️ **Schema Inconsistency**
**Problem:**
- User's migration script creates table with `phone` column
- Current code expects `destination` column
- Migration also removes: `channel`, `category`, `display_order`, `priority`

**Impact:** Migration will break existing code

**Fix Required:** Align schema - either:
- Update code to match migration (use `phone`, remove channel/category filters)
- Update migration to match code (use `destination`, keep channel/category)

---

## Code Comparison

### Standalone Function (wa-webhook-insurance/index.ts)
**Pros:**
- ✅ Proper structured logging
- ✅ Better error handling
- ✅ Uses handlers/contacts.ts for separation of concerns
- ✅ More maintainable

**Cons:**
- ❌ Never called/used
- ❌ Uses `destination` column (mismatch with user's migration)

### Inline Handler (wa-webhook-core/router.ts)
**Pros:**
- ✅ Actually gets called
- ✅ Simpler (inline)

**Cons:**
- ❌ No structured logging
- ❌ Poor error handling
- ❌ Uses `destination` column (mismatch with user's migration)
- ❌ Harder to maintain

---

## Recommended Fixes

### Fix 1: Align Database Schema
**Decision needed:** Use `phone` or `destination`?

**If using `phone` (per user's migration):**
1. Update `handleInsuranceAgentRequest()` to use `phone` column
2. Remove filters for `channel` and `category`
3. Update `wa-webhook-insurance/handlers/contacts.ts` to use `phone`
4. Apply user's migration

**If using `destination` (current):**
1. Update user's migration to use `destination` instead of `phone`
2. Keep current code as-is

**RECOMMENDATION:** Use `phone` (simpler, matches user's intent)

### Fix 2: Consolidate to Single Implementation
**Option A: Use Standalone Function (RECOMMENDED)**
```typescript
// In wa-webhook-core/handlers/home-menu.ts
else if (selection === "insurance") {
  logInfo("INSURANCE_SELECTED", { from: phoneNumber }, { correlationId: corrId });
  
  // Forward to standalone function
  const insuranceUrl = `${MICROSERVICES_BASE_URL}/wa-webhook-insurance`;
  const response = await fetch(insuranceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
      "x-correlation-id": corrId,
    },
    body: JSON.stringify({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: phoneNumber,
              id: crypto.randomUUID(),
            }],
          },
        }],
      }],
    }),
  });
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
```

**Option B: Remove Standalone Function**
- Delete `wa-webhook-insurance` function
- Keep inline handler
- Improve error handling and logging

**RECOMMENDATION:** Option A (use standalone function) for better separation of concerns

### Fix 3: Add Structured Logging
```typescript
// In handleInsuranceAgentRequest()
await logStructuredEvent("INSURANCE_REQUEST_START", {
  from: `***${phoneNumber.slice(-4)}`,
  correlationId,
});

// ... query contacts ...

await logStructuredEvent("INSURANCE_CONTACTS_FETCHED", {
  from: `***${phoneNumber.slice(-4)}`,
  contactCount: contacts.length,
  correlationId,
});

// ... send message ...

await logStructuredEvent("INSURANCE_MESSAGE_SENT", {
  from: `***${phoneNumber.slice(-4)}`,
  contactCount: contacts.length,
  correlationId,
});
```

### Fix 4: Fix Column Name in Code
**Update:** `supabase/functions/wa-webhook-core/router.ts:60`
```typescript
// OLD:
.select("destination, display_name")

// NEW (if using phone):
.select("phone, display_name")

// Also update line 86:
const cleanNumber = contact.phone.replace(/^\+/, "").replace(/\D/g, "");  // was: contact.destination
```

---

## Testing Checklist

After fixes, test:
- [ ] User taps "insurance" from home menu
- [ ] Function logs appear in Supabase logs
- [ ] User receives message with contact links
- [ ] Contact links are valid WhatsApp links
- [ ] Both contacts appear in message
- [ ] Message formatting is correct
- [ ] Error handling works (test with empty table)

---

## Migration Script Review

The user provided migration script creates:
- Table with `phone` column (not `destination`)
- Simplified schema (removes `channel`, `category`, `display_order`, `priority`)
- Whitelist constraint (only 2 allowed numbers)
- RLS policy for read access

**Issue:** This schema doesn't match current code expectations.

**Fix Required:** Either update migration OR update code to match migration.

---

## Summary of Required Changes

1. ✅ **DECIDE:** Use `phone` or `destination` column
2. ✅ **UPDATE:** Code to use chosen column name
3. ✅ **CONSOLIDATE:** Choose single implementation (standalone or inline)
4. ✅ **ADD:** Structured logging throughout
5. ✅ **TEST:** End-to-end flow
6. ✅ **DEPLOY:** All changes

---

## Priority Order

1. **P0 - CRITICAL:** Fix column name mismatch (code vs migration)
2. **P0 - CRITICAL:** Add structured logging to see what's happening
3. **P1 - HIGH:** Consolidate to single implementation
4. **P2 - MEDIUM:** Improve error handling
5. **P3 - LOW:** Code cleanup and documentation

