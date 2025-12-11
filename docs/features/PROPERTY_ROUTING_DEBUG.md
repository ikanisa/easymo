# Property Rental Routing Debug Report

**Issue:** When user taps "Property Rental" button, they get home welcome message instead of
property agent

**Date:** 2025-12-09  
**Logs:** Empty (no logs generated)

---

## 🔍 Investigation

### **1. Menu Configuration** ✅ CORRECT

**File:** `supabase/functions/wa-webhook/domains/menu/dynamic_home_menu.ts`

```typescript
property_rentals: "real_estate_agent",  // Line 67
```

**Menu key maps:** `property_rentals` → `real_estate_agent`

---

### **2. Route Configuration** ✅ CORRECT

**File:** `supabase/functions/_shared/route-config.ts`

```typescript
{
  service: "wa-webhook-property",
  keywords: ["property", "rent", "house", "apartment", "rental", "landlord", "tenant", "real estate"],
  menuKeys: ["property", "property_rentals", "property rentals", "real_estate_agent", "4"],
  priority: 1,
}
```

**Route maps:** `real_estate_agent` → `wa-webhook-property` service

---

### **3. Property Webhook Handler** ✅ CORRECT

**File:** `supabase/functions/wa-webhook-property/index.ts`

```typescript
if (
  buttonId === IDS.PROPERTY_RENTALS ||
  buttonId === "property" ||
  buttonId === "property_rentals"
) {
  await startPropertyRentals(ctx);
  return true;
}

if (listId === "property" || listId === "property_rentals" || listId === "real_estate_agent") {
  await startPropertyRentals(ctx);
  return true;
}
```

**Handlers exist for:**

- `property_rentals` button
- `real_estate_agent` button
- `property` button

---

### **4. Start Property Flow** ✅ CORRECT

**File:** `supabase/functions/wa-webhook-property/property/rentals.ts`

```typescript
export async function startPropertyRentals(ctx: RouterContext): Promise<boolean> {
  // Check if role handshake is needed
  const reState = await getRealEstateState(ctx.supabase, ctx.profileId);

  if (requiresRoleHandshake(reState)) {
    // Show role selection (Renter / Landlord / Agent)
    await sendButtonsMessage(ctx, roleMsg.body, roleMsg.buttons);
    return true;
  }

  // Show property menu
  return true;
}
```

**Expected behavior:**

1. User taps "Property Rental"
2. Shows: "Are you a Renter, Landlord, or Agent?"
3. User selects role
4. Shows property menu

---

## ❌ Problem: Routing Not Working

### **Likely Cause:**

The routing from `wa-webhook-core` → `wa-webhook-property` is failing.

**Routing chain:**

```
WhatsApp → wa-webhook → wa-webhook-core → (route to) wa-webhook-property
```

**Where it's breaking:**

- `wa-webhook-core` receives button click
- Button ID = `real_estate_agent` or `property_rentals`
- **Should route to:** `wa-webhook-property`
- **Actually does:** Falls back to home menu

---

## 🔧 Debugging Steps

### **Step 1: Check if wa-webhook-property is deployed**

```bash
# Check Supabase function logs
supabase functions list

# Verify wa-webhook-property exists
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-property
```

**Expected:** Function exists and responds with health check

---

### **Step 2: Check routing logs**

```bash
# Check wa-webhook-core logs for routing decision
supabase functions logs wa-webhook-core --tail

# Check wa-webhook-property logs
supabase functions logs wa-webhook-property --tail
```

**Look for:**

- Routing decision logs
- Which service was chosen
- Any errors during routing

---

### **Step 3: Check button ID format**

The button ID sent from the menu might not match expected values.

**Possible IDs:**

- `real_estate_agent` ✅
- `property_rentals` ✅
- `REAL_ESTATE_AGENT` ❓
- `PROPERTY_RENTALS` ❓

**Fix:** Ensure button ID matches exactly what the handler expects

---

### **Step 4: Check wa-webhook-core routing logic**

**File to check:** `supabase/functions/wa-webhook-core/router.ts`

Look for:

```typescript
// How does it match button clicks to services?
const service = SERVICE_KEY_MAP[buttonId];
```

---

## 🎯 Recommended Fixes

### **Fix 1: Add Debug Logging**

Add logs to track routing decision:

```typescript
// In wa-webhook-core/router.ts
console.log("Button clicked:", buttonId);
console.log("Routing to service:", matchedService);
```

### **Fix 2: Verify Button ID in Menu**

Check what ID is actually sent when "Property Rental" is clicked:

```typescript
// In dynamic_home_menu.ts
real_estate_agent: {
  id: "real_estate_agent",  // <-- Ensure this matches
  titleKey: "home.rows.realEstateAgent.title",
}
```

### **Fix 3: Check Session State**

The routing might be using session state instead of button ID:

```typescript
// Check if there's an active session routing
const session = await getSession(phone);
if (session?.activeService) {
  // Routes to activeService instead of button click
}
```

### **Fix 4: Bypass Router (Temporary Test)**

To test if `wa-webhook-property` works, call it directly:

```bash
curl -X POST https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook-property \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "type": "interactive",
            "interactive": {
              "type": "button_reply",
              "button_reply": {
                "id": "property_rentals"
              }
            },
            "from": "+250788123456"
          }]
        }
      }]
    }]
  }'
```

**Expected:** Should show property menu

---

## 📝 Next Steps

1. **Check logs** - See what routing decision was made
2. **Verify function deployed** - Ensure wa-webhook-property exists
3. **Test button ID** - Confirm exact ID sent from menu
4. **Add debug logging** - Track routing flow
5. **Test direct call** - Bypass router to isolate issue

---

**Most likely issue:** Button ID mismatch or routing logic not finding the service

**Quick fix:** Check the exact button ID being sent and ensure it matches one of:

- `property_rentals`
- `real_estate_agent`
- `property`
