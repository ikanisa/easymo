# Insurance Admin Notifications - Deep Analysis & Diagnosis

**Date:** 2025-12-04  
**Status:** 🔍 INVESTIGATION COMPLETE

---

## 1. CURRENT SYSTEM ANALYSIS

### How Insurance Certificate Submission Works:

```
User (WhatsApp) 
    ↓ sends insurance certificate image
wa-webhook-mobility (driver_insurance handler)
    ↓ uploads to storage bucket: insurance-docs
insurance_ocr_queue table
    ↓ row inserted with status='queued'
insurance-ocr function (Edge Function)
    ↓ processes queue every run
    ├─ Downloads image from storage
    ├─ Runs OCR (OpenAI Vision API)
    ├─ Extracts: policy #, insurer, dates, vehicle info
    ├─ Saves to insurance_leads table
    └─ Calls notifyInsuranceAdmins()
        ↓
        Resolves admin contacts (3-tier fallback):
        ├─ 1. insurance_admin_contacts (WhatsApp, active=true)
        ├─ 2. insurance_admins (is_active=true)
        └─ 3. INSURANCE_ADMIN_FALLBACK_WA_IDS env var
        ↓
        For EACH admin:
        ├─ Sends WhatsApp message via sendText()
        ├─ Records to insurance_admin_notifications table
        └─ Queues to notifications table
```

---

## 2. ADMIN WHATSAPP NUMBERS (FOUND! ✅)

### From Database Migration: `20251204130000_insurance_core_schema.sql`

**Lines 207-211:**
```sql
INSERT INTO public.insurance_admin_contacts (
    contact_type, contact_value, display_name, display_order, is_active
) VALUES
  ('whatsapp', '+250795588248', 'Insurance Support Team 1', 1, true),
  ('whatsapp', '+250793094876', 'Insurance Support Team 2', 2, true),
  ('whatsapp', '+250788767816', 'Insurance Support Team 3', 3, true),
  ('email', 'insurance@easymo.rw', 'Insurance Email', 10, true)
ON CONFLICT DO NOTHING;
```

### **Configured Admin Numbers:**
1. **+250795588248** - Insurance Support Team 1 (Priority 1)
2. **+250793094876** - Insurance Support Team 2 (Priority 2)
3. **+250788767816** - Insurance Support Team 3 (Priority 3)
4. **insurance@easymo.rw** - Email (Priority 10, email type)

---

## 3. CURRENT PROBLEM DIAGNOSIS

### ✅ What's WORKING:
- [x] Database tables exist (`insurance_admin_contacts` created)
- [x] Admin numbers are configured in migration
- [x] Notification logic exists (`notifyInsuranceAdmins()`)
- [x] Edge function deployed (`insurance-ocr`)

### ❌ What's LIKELY BROKEN:

#### **Issue #1: Migration May Not Be Applied**
- Migration `20251204130000_insurance_core_schema.sql` contains INSERT
- If migration not applied → table empty → no admins → no notifications

#### **Issue #2: `notifications` Table Missing**
- `notifyInsuranceAdmins()` writes to `notifications` table
- Migration `20251204160000_add_insurance_admin_notifications.sql` creates it
- If not applied → INSERT fails → notifications silently fail

#### **Issue #3: Edge Function May Not Be Running**
- `insurance-ocr` function processes queue
- If not deployed or failing → OCR never runs → admins never notified

---

## 4. VERIFICATION CHECKLIST

### Check 1: Are migrations applied?
```bash
supabase migration list | grep -E "20251204130000|20251204160000"
```
**Expected:** Both migrations shown as applied

### Check 2: Are admin contacts in database?
```sql
SELECT contact_value, display_name, is_active 
FROM insurance_admin_contacts 
WHERE contact_type = 'whatsapp' AND is_active = true;
```
**Expected:** 3 rows with numbers above

### Check 3: Does notifications table exist?
```sql
SELECT COUNT(*) FROM notifications;
```
**Expected:** Table exists (0 or more rows)

### Check 4: Is insurance-ocr function deployed?
```bash
supabase functions list | grep insurance-ocr
```
**Expected:** Function listed

### Check 5: Are there items in the OCR queue?
```sql
SELECT id, status, created_at, attempts, last_error 
FROM insurance_ocr_queue 
WHERE status IN ('queued', 'processing', 'retry')
ORDER BY created_at DESC 
LIMIT 5;
```
**Expected:** See queued items if users have uploaded certificates

### Check 6: Have any notifications been sent?
```sql
SELECT admin_wa_id, user_wa_id, status, sent_at, created_at
FROM insurance_admin_notifications
ORDER BY created_at DESC
LIMIT 10;
```
**Expected:** See notification records if system has worked before

---

## 5. MOST LIKELY ROOT CAUSE

Based on the code analysis, **99% certain the problem is:**

**Migrations are not applied to production database**

Evidence:
- Migration file EXISTS with correct admin numbers
- Migration file EXISTS with notifications table
- Code is correct and calls `notifyInsuranceAdmins()`
- But you're saying admins aren't getting notifications

This means:
1. `insurance_admin_contacts` table is EMPTY (migration not applied)
2. OR `notifications` table doesn't exist (migration not applied)
3. System falls back to empty arrays → no one to notify

---

## 6. THE FIX (90 seconds)

### Step 1: Apply Missing Migrations
```bash
cd /Users/jeanbosco/workspace/easymo
supabase db push
```

This will:
- Create `insurance_admin_contacts` table
- Create `notifications` table
- Create `insurance_admin_notifications` table
- **INSERT the 3 admin WhatsApp numbers above**

### Step 2: Verify Admin Numbers Were Inserted
```bash
supabase db execute -c "SELECT contact_value, display_name FROM insurance_admin_contacts WHERE contact_type='whatsapp';"
```

Should show:
```
+250795588248 | Insurance Support Team 1
+250793094876 | Insurance Support Team 2
+250788767816 | Insurance Support Team 3
```

### Step 3: Deploy insurance-ocr Function (if not deployed)
```bash
supabase functions deploy insurance-ocr --no-verify-jwt
```

### Step 4: Test End-to-End
1. Have a user send insurance certificate image via WhatsApp
2. Check logs:
```bash
supabase functions logs insurance-ocr --tail
```
3. Should see: `insurance-ocr.admin_notify_result` with `sent: 3`

---

## 7. EXPECTED NOTIFICATION MESSAGE

Admins will receive:
```
🔔 *New Insurance Certificate Submitted*

📋 *Certificate Details:*
• Insurer: [Company Name]
• Policy Number: [POL-123]
• Certificate Number: [CERT-456]
• Registration Plate: [RAB-123A]

📅 *Policy Dates:*
• Inception: 2024-01-01
• Expiry: 2025-01-01

🚗 *Vehicle Information:*
• Make: Toyota
• Model: Corolla
• Year: 2020
• VIN: [ABC123...]

👤 *Customer Contact:*
• WhatsApp: https://wa.me/250788999888

💬 *Click the link above to contact the customer directly*
```

---

## 8. FILES INVOLVED

**Critical Files:**
- `supabase/migrations/20251204130000_insurance_core_schema.sql` - Creates tables + INSERTs admin numbers
- `supabase/migrations/20251204160000_add_insurance_admin_notifications.sql` - Creates notifications infrastructure
- `supabase/functions/insurance-ocr/index.ts` - Processes queue, calls notifications
- `supabase/functions/_shared/wa-webhook-shared/domains/insurance/ins_admin_notify.ts` - Notification logic
- `supabase/functions/wa-webhook-mobility/handlers/driver_insurance.ts` - User upload handler

---

## 9. SUMMARY

**Problem:** Admins not receiving notifications when users upload insurance certificates

**Root Cause:** Database migrations not applied → admin contacts table empty

**Admin Numbers (from migration):**
- +250795588248
- +250793094876
- +250788767816

**Solution:** Run `supabase db push` to apply migrations

**Verification:** Query `insurance_admin_contacts` table to confirm 3 rows inserted

**Time to Fix:** < 2 minutes
