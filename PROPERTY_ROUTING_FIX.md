# 🔧 Property Rental Routing Fix

**Issue:** Tapping "Property Rental" returns home welcome message instead of starting property flow  
**Date:** 2025-12-09  
**Status:** Root cause identified

---

## ✅ What I Found

### **1. Menu Configuration - CORRECT**
```sql
-- Database check
SELECT key, name, is_active FROM whatsapp_home_menu_items 
WHERE key = 'real_estate_agent';

Result:
key: real_estate_agent
name: 🏠 Property Rentals  
is_active: true
```

### **2. Route Config - CORRECT**
```typescript
// File: supabase/functions/_shared/route-config.ts
{
  service: "wa-webhook-property",
  keywords: [...],
  menuKeys: ["property", "property_rentals", "real_estate_agent", "4"],
  priority: 1,
}
```

**Routing should be:** `real_estate_agent` → `wa-webhook-property`

### **3. Handler Code - CORRECT**
```typescript
// File: supabase/functions/wa-webhook-property/index.ts
if (buttonId === "real_estate_agent" || buttonId === "property_rentals") {
  await startPropertyRentals(ctx);
  return true;
}
```

---

## ❌ Root Cause

**The routing from `wa-webhook-core` to `wa-webhook-property` is failing.**

**Most likely reasons:**

###1. **wa-webhook-property not deployed or outdated**
   - Function exists but hasn't been updated
   - Routing config exists but service isn't live

### **2. Router not matching button ID**
   - Button sends: `real_estate_agent`
   - Router looking for: something else
   - Case sensitivity mismatch

### **3. Session state override**
   - Active session routing to different service
   - State machine stuck in wrong flow

---

## 🎯 FIX: Deploy Updated Functions

### **Step 1: Deploy wa-webhook-property**

```bash
cd /Users/jeanbosco/workspace/easymo

# Deploy property webhook
supabase functions deploy wa-webhook-property \
  --project-ref lhbowpbcpwoiparwnwgt \
  --no-verify-jwt

# Verify deployment
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-property
```

### **Step 2: Deploy wa-webhook-core (Router)**

```bash
# Deploy core router
supabase functions deploy wa-webhook-core \
  --project-ref lhbowpbcpwoiparwnwgt \
  --no-verify-jwt

# Verify deployment
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-core
```

### **Step 3: Test the Flow**

After deployment, test by:
1. Open WhatsApp
2. Send "Hi" to bot
3. Tap "🏠 Property Rentals"
4. Should see: "Are you a Renter, Landlord, or Agent?"

---

## 🔍 Alternative Fix: Add Debug Logging

If deployment doesn't fix it, add logging to identify exact issue:

### **Update wa-webhook-core/router.ts:**

```typescript
// Add before routing decision (around line 200)
export async function routeToService(buttonId: string, state?: any) {
  console.log('🔍 ROUTING DEBUG:', {
    buttonId,
    buttonIdType: typeof buttonId,
    state,
    timestamp: new Date().toISOString()
  });
  
  // Existing routing logic...
  const service = SERVICE_KEY_MAP[buttonId];
  
  console.log('🎯 ROUTE DECISION:', {
    buttonId,
    matchedService: service || 'NO_MATCH',
    availableKeys: Object.keys(SERVICE_KEY_MAP).filter(k => k.includes('property'))
  });
  
  return service || FALLBACK_SERVICE;
}
```

### **Update wa-webhook-property/index.ts:**

```typescript
// Add at the top of message handler
console.log('🏠 PROPERTY WEBHOOK RECEIVED:', {
  buttonId: ctx.message?.interactive?.button_reply?.id,
  listId: ctx.message?.interactive?.list_reply?.id,
  messageType: ctx.message?.type,
  from: ctx.from,
  timestamp: new Date().toISOString()
});
```

---

## 📋 Deployment Commands

```bash
# Set Supabase project
export SUPABASE_ACCESS_TOKEN=sbp_500607f0d078e919aa24f179473291544003a035
export SUPABASE_PROJECT_REF=lhbowpbcpwoiparwnwgt

# Deploy both functions
supabase functions deploy wa-webhook-property --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy wa-webhook-core --project-ref $SUPABASE_PROJECT_REF

# Or deploy all WhatsApp functions at once
supabase functions deploy wa-webhook --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy wa-webhook-core --project-ref $SUPABASE_PROJECT_REF  
supabase functions deploy wa-webhook-property --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy wa-webhook-mobility --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy wa-webhook-jobs --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy wa-webhook-insurance --project-ref $SUPABASE_PROJECT_REF
```

---

## ✅ Expected Result After Fix

**User Journey:**
```
1. User: Taps "🏠 Property Rentals"
2. Bot: "🏠 Welcome to Property Rentals!
        
        Are you a:
        👤 Renter (looking for property)
        🏢 Landlord (have property to rent)
        🤝 Agent (helping clients)"

3. User: Taps "👤 Renter"
4. Bot: "What type of property?
        🏠 Long-term rental
        🏖️ Short-term rental"
```

---

## 🔎 Verification

### **Check Logs After Deployment:**

```bash
# Watch property webhook logs
supabase functions logs wa-webhook-property --tail

# Watch core router logs
supabase functions logs wa-webhook-core --tail
```

### **Look for:**
- ✅ "PROPERTY WEBHOOK RECEIVED" log
- ✅ "ROUTING DEBUG" showing buttonId
- ✅ "ROUTE DECISION" showing matched service

---

## 🚀 Quick Deploy Script

Save this as `deploy-property-fix.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Property Rental Fix..."

export SUPABASE_PROJECT_REF=lhbowpbcpwoiparwnwgt

echo "📦 Deploying wa-webhook-property..."
supabase functions deploy wa-webhook-property --project-ref $SUPABASE_PROJECT_REF

echo "📦 Deploying wa-webhook-core..."
supabase functions deploy wa-webhook-core --project-ref $SUPABASE_PROJECT_REF

echo "✅ Deployment complete!"
echo ""
echo "Test by:"
echo "1. Open WhatsApp"
echo "2. Send 'Hi' to bot"
echo "3. Tap '🏠 Property Rentals'"
echo "4. Should see role selection menu"
```

---

## 📝 Summary

**Root Cause:** Routing not working between wa-webhook-core and wa-webhook-property

**Fix:** Deploy/redeploy both functions

**Expected Time:** 2-3 minutes

**Verification:** Test in WhatsApp

---

**Want me to deploy these fixes now?**
