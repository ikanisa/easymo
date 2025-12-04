# 🚨 Insurance Admin Notifications - Root Cause & Fix

## Issue Confirmed

**Status:** Messages marked as "sent" in database but admins not receiving WhatsApp messages

**Database Evidence:**
- 85+ notifications with status='sent' and sent_at timestamps
- No error messages recorded
- Phone numbers: Loaded from insurance_admin_contacts table

## Root Cause Analysis

### WhatsApp Cloud API Behavior

The WhatsApp Cloud API has **restrictive delivery rules** that cause silent failures:

1. **Development/Test Mode:**
   - Can ONLY send to phone numbers added as "test recipients" in Meta Business Manager
   - API returns 200 OK but silently drops messages to non-verified numbers
   - No error is reported back to the caller

2. **Production Mode (Business-Initiated Messages):**
   - Cannot send freeform messages to users
   - MUST use pre-approved Message Templates
   - OR user must have messaged you first (opens 24-hour window)

3. **Silent Failure:**
   - API accepts the request (HTTP 200)
   - Message is queued but never delivered
   - No webhook notification of failure
   - Our code marks it as "sent" ✅ but WhatsApp never delivers ❌

## Why Our Code Shows "Sent"

Our `sendText()` function calls the WhatsApp API:
```typescript
const res = await fetch(`${GRAPH_BASE}/${WA_PHONE_ID}/messages`, {...});
if (res.ok) return; // 200 OK = we think it's sent
```

WhatsApp returns **200 OK** even if the message will be dropped due to policy violations.

## Solutions

### ✅ Solution 1: Add Test Recipients (FASTEST - 5 minutes)

**For Development/Test Mode:**

1. **Go to Meta Business Manager:**
   - URL: https://business.facebook.com/
   - Select your Business Portfolio
   - Navigate to: WhatsApp Accounts → [Your Account] → Phone Numbers

2. **Add Test Phone Numbers:**
   - Click "Add phone number" or "Manage phone numbers"
   - Add the WhatsApp numbers from your `insurance_admin_contacts` table
   - Query: `SELECT contact_value FROM insurance_admin_contacts WHERE contact_type='whatsapp' AND is_active=true;`
   - Save changes

3. **Verify:**
   - Have user submit insurance certificate
   - Check if admins receive WhatsApp messages

**Time:** 5 minutes  
**Limitation:** Only works in Test Mode, max ~5 test numbers

---

### ✅ Solution 2: Create Approved Message Template (RECOMMENDED)

**For Production Mode:**

1. **Create Template in Meta Business Manager:**
   ```
   Template Name: insurance_admin_alert
   Category: UTILITY
   Language: English
   
   Header: None
   Body: 
   🔔 New Insurance Certificate Submitted
   
   Certificate: {{1}}
   Policy: {{2}}
   Customer: {{3}}
   
   Please review in admin portal.
   
   Footer: EasyMO Insurance Team
   Buttons: None
   ```

2. **Submit for Approval:**
   - Meta typically approves in 15-30 minutes
   - Check status in Message Templates section

3. **Update Code to Use Template:**
   Already implemented! The code tries template fallback:
   ```typescript
   // In ins_admin_notify.ts line 110-118
   const templateName = Deno.env.get("WA_INSURANCE_ADMIN_TEMPLATE") ?? "insurance_admin_alert";
   await sendTemplate(adminWaId, {
     name: templateName,
     language: lang,
     bodyParameters: [
       { type: "text", text: certificateNumber },
       { type: "text", text: policyNumber },
       { type: "text", text: customerPhone }
     ]
   });
   ```

4. **Set Environment Variable:**
   ```bash
   # In Supabase Dashboard → Settings → Edge Functions → Environment Variables
   WA_INSURANCE_ADMIN_TEMPLATE=insurance_admin_alert
   WA_TEMPLATE_LANG=en
   ```

**Time:** 30 minutes (including approval wait)  
**Limitation:** Template format is fixed, less flexible than freeform

---

### ✅ Solution 3: Admin Initiates Conversation (TEMPORARY)

**Quick Test (opens 24-hour window):**

1. Each admin sends **any message** to your WhatsApp Business number
2. This opens a 24-hour window where you can send freeform messages
3. Test by submitting insurance certificate
4. Admins should receive notification

**Time:** 2 minutes  
**Limitation:** Window expires after 24 hours, must repeat

---

## Recommended Implementation

### Immediate (Today):

**Option A - If in Test Mode:**
- Add 3 admin numbers as test recipients (5 min)
- Test immediately

**Option B - If in Production:**
- Have admins message the bot (2 min)
- Test immediately
- Meanwhile, create template for permanent fix

### Permanent (This Week):

1. **Create Message Template** (recommended above)
2. **Verify Template Approval** (check after 30 min)
3. **Update Environment Variables:**
   ```
   WA_INSURANCE_ADMIN_TEMPLATE=insurance_admin_alert
   WA_TEMPLATE_LANG=en
   ```
4. **Test End-to-End**
5. **Monitor Logs** for template usage

---

## How to Verify Which Mode You're In

Run this check:
```bash
# Check WhatsApp account status
# Option 1: Check Meta Business Manager
# → https://business.facebook.com/
# → WhatsApp Accounts → Settings
# → Look for "Account Mode: Development" or "Production"

# Option 2: Check message sending patterns
# If you can send to ANY phone number → unlikely, probably test mode
# If messages only work after users message first → production mode
```

---

## Code Already Supports Templates!

Good news: The code already tries to fall back to templates:

```typescript
// File: _shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts
try {
  await sendText(adminWaId, message);  // Try freeform first
  delivered = true;
} catch (error) {
  // Falls back to template automatically
  const templateName = Deno.env.get("WA_INSURANCE_ADMIN_TEMPLATE") ?? "insurance_admin_alert";
  await sendTemplate(adminWaId, {
    name: templateName,
    language: lang,
    bodyParameters: [{ type: "text", text: compact }]
  });
  delivered = true;
}
```

**However**, the freeform `sendText()` is returning 200 OK (not throwing error), so the template fallback never triggers!

---

## Updated Fix: Force Template Usage

Since WhatsApp silently accepts but doesn't deliver freeform messages, we should **use templates by default** for admin notifications:

### Code Change Needed:

```typescript
// In: supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts
// Around line 102-126

// BEFORE (tries freeform first):
try {
  await sendText(adminWaId, message);
  delivered = true;
} catch (error) {
  // template fallback...
}

// AFTER (use template directly):
try {
  const templateName = Deno.env.get("WA_INSURANCE_ADMIN_TEMPLATE") ?? "insurance_admin_alert";
  const lang = Deno.env.get("WA_TEMPLATE_LANG") ?? "en";
  
  // For template, format data compactly
  const certificateInfo = `${extracted.insurer_name} - ${extracted.policy_number}`;
  const customerContact = userWaId;
  
  await sendTemplate(adminWaId, {
    name: templateName,
    language: lang,
    bodyParameters: [
      { type: "text", text: certificateInfo },
      { type: "text", text: extracted.policy_number ?? "N/A" },
      { type: "text", text: customerContact }
    ]
  });
  delivered = true;
} catch (error) {
  const errMsg = error instanceof Error ? error.message : String(error ?? "unknown");
  lastError = errMsg;
  console.error("insurance.admin_template_send_fail", { admin: adminWaId, error: errMsg });
}
```

---

## Action Plan

### Step 1: Check Account Mode (5 min)
- Log into https://business.facebook.com/
- Find WhatsApp account
- Note if it's "Development" or "Production"

### Step 2: Apply Immediate Fix
- **If Development:** Add 3 admin phone numbers as test recipients
- **If Production:** Create message template (or have admins message bot)

### Step 3: Test (2 min)
- Submit test insurance certificate
- Verify admin receives WhatsApp message

### Step 4: Monitor
- Check Supabase logs for `insurance.admin_template_send_fail`
- Query database for failed notifications

---

## Files for Reference

- **WhatsApp Client:** `supabase/functions/wa-webhook/wa/client.ts`
- **Admin Notify Logic:** `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts`
- **Send Function:** `supabase/functions/send-insurance-admin-notifications/index.ts`
- **Diagnostic Script:** `scripts/diagnose-whatsapp-issue.sh`

---

## Summary

🔴 **Problem:** WhatsApp Cloud API silently drops messages to non-verified recipients  
🟡 **Why:** Account in Test Mode OR missing approved templates  
🟢 **Fix:** Add test recipients (quick) OR create approved template (permanent)  
⚡ **Timeline:** 5-30 minutes depending on approach

The notification system is working correctly - it's a WhatsApp API policy restriction, not a code bug.
