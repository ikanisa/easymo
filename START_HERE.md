# 🚀 INSURANCE DEPLOYMENT - START HERE

**Quick automated deployment in 3 simple steps**

---

## Before You Start

Make sure you have:
- ✅ Code editor open (VS Code, etc.)
- ✅ Terminal access
- ✅ Git configured
- ✅ Supabase CLI installed

---

## STEP-BY-STEP DEPLOYMENT

### Step 1: Apply Code Fixes (5 minutes)

Open these files and apply the changes:

#### Fix 1: Rate Limiting
**File:** `supabase/functions/insurance-ocr/index.ts`

**Line 17** (after imports), ADD:
```typescript
import { rateLimitMiddleware } from "../_shared/rate-limit/index.ts";
```

**Line 88** (after OPTIONS handler), ADD:
```typescript
  // Rate limiting: 10 OCR requests per minute per IP/user
  const rateLimitCheck = await rateLimitMiddleware(req, {
    limit: 10,
    windowSeconds: 60,
  });

  if (!rateLimitCheck.allowed) {
    logStructuredEvent("INS_OCR_RATE_LIMITED", {
      ip: req.headers.get("x-forwarded-for") || "unknown",
    }, "warn");
    return rateLimitCheck.response!;
  }
```

---

#### Fix 2: Race Condition  
**File:** `supabase/functions/wa-webhook-insurance/insurance/ins_handler.ts`

**Lines 338-367**, FIND this code:
```typescript
const { data: existingLead } = await ctx.supabase
  .from("insurance_leads")
  .select("status")
  .eq("id", params.leadId)
  .single();

if (existingLead?.status === "ocr_ok") {
  return true;
}

const { error: updateError } = await ctx.supabase
  .from("insurance_leads")
  .update({...})
  .eq("id", params.leadId);
```

**REPLACE with this atomic update:**
```typescript
const { data: updatedLead, error: updateError } = await ctx.supabase
  .from("insurance_leads")
  .update({
    raw_ocr: raw,
    extracted: normalized,
    status: "ocr_ok",
    file_path: params.storagePath,
  })
  .eq("id", params.leadId)
  .eq("status", "received")  // ⭐ Atomic CAS
  .select("id, status")
  .maybeSingle();

if (!updatedLead) {
  console.info("INS_INLINE_ALREADY_PROCESSED", { 
    leadId: params.leadId,
    reason: updateError ? "update_error" : "already_processed"
  });
  return true;
}
```

---

#### Fix 3: Renewal Reminder
**File:** `supabase/functions/insurance-renewal-reminder/index.ts`

**Line 3**, ADD these imports:
```typescript
import { sendButtonsMessage } from "../_shared/wa-webhook-shared/utils/reply.ts";
import type { RouterContext } from "../_shared/wa-webhook-shared/types.ts";
```

**Line 60**, FIND:
```typescript
await sendButtonsMessage(
  { from: policy.wa_id, supabase },
  message,
  buttons
);
```

**REPLACE with:**
```typescript
const ctx: RouterContext = {
  from: policy.wa_id,
  supabase,
  profileId: policy.user_id,
  locale: 'en' as const,
};

await sendButtonsMessage(ctx, message, buttons);
```

---

#### Fix 4: Test Import
**File:** `supabase/functions/wa-webhook-insurance/insurance/ins_normalize.test.ts`

**Line 1**, CHANGE from:
```typescript
import { normalizeInsuranceExtraction } from "./ins_normalize.ts";
```

**TO:**
```typescript
import { normalizeInsuranceExtraction } from "../../_shared/wa-webhook-shared/domains/insurance/ins_normalize.ts";
```

---

### Step 2: Apply Database Migration (2 minutes)

```bash
chmod +x step2-apply-database.sh
./step2-apply-database.sh
```

This will:
- Create migration file
- Apply to database
- Verify tables created

**Expected output:**
```
✅ Migration file created
✅ Database migration applied successfully!

 table_name
----------------------------
 insurance_admin_contacts
 insurance_claims
 insurance_leads
 insurance_media
 insurance_media_queue
 insurance_quotes
 insurance_renewals
```

---

### Step 3: Commit and Deploy (3 minutes)

```bash
chmod +x step3-commit-and-deploy.sh
./step3-commit-and-deploy.sh
```

This will:
- Commit changes to git
- Push to GitHub
- Deploy all functions to Supabase

**Expected output:**
```
✅ Changes committed
✅ Pushed to GitHub
✅ wa-webhook-insurance deployed
✅ insurance-ocr deployed
✅ insurance-renewal-reminder deployed
```

---

### Step 4: Configure Cron Job (1 minute)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Edge Functions** → **Cron Jobs**
3. Click **Add Cron Job**
4. Configure:
   - **Function:** `insurance-renewal-reminder`
   - **Schedule:** `0 9 * * *` (daily at 9 AM)
   - Click **Create**

---

### Step 5: Verify Deployment (2 minutes)

```bash
chmod +x test-insurance-deployment.sh
./test-insurance-deployment.sh
```

**Expected output:**
```
✅ All 7 insurance tables exist
✅ Admin contacts configured (2 active)
✅ RLS policies enabled (15 policies)
✅ get_expiring_policies() function exists
✅ Performance indexes created (21 indexes)
✅ OCR endpoint responding
```

---

## 🎉 DEPLOYMENT COMPLETE!

Your insurance microservice is now **production ready** and **live**!

### Test It Out

1. **Upload Insurance Document**
   - Send insurance certificate image via WhatsApp
   - Should receive OCR summary
   - Admin should be notified

2. **Submit a Claim**
   - Type "claim" in WhatsApp
   - Follow the flow
   - Upload supporting documents

3. **Check Status**
   - Type "claim status <reference>"
   - Should show current status

---

## Troubleshooting

### Issue: Code fixes not working
- **Solution:** Check example files in project root:
  - `INSURANCE_FIX_1_rate_limiting.ts.example`
  - `INSURANCE_FIX_2_race_condition.ts.example`
  - `INSURANCE_FIX_3_renewal_reminder.ts.example`

### Issue: Database migration fails
- **Solution:** Check if tables already exist:
  ```bash
  psql "$DATABASE_URL" -c "\dt insurance*"
  ```

### Issue: Git push fails
- **Solution:** Pull latest changes first:
  ```bash
  git pull --rebase origin main
  ./step3-commit-and-deploy.sh
  ```

### Issue: Function deployment fails
- **Solution:** Check Supabase CLI login:
  ```bash
  export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
  supabase functions deploy --help
  ```

---

## Support

**Documentation:**
- Full QA Report: `WA_WEBHOOK_INSURANCE_QA_REPORT.md`
- Fix Details: `WA_WEBHOOK_INSURANCE_CRITICAL_FIXES_COMPLETE.md`
- Quick Deploy: `DEPLOY_NOW.md`

**Logs:**
```bash
# View function logs
supabase functions logs wa-webhook-insurance --tail
supabase functions logs insurance-ocr --tail

# Check database
psql "$DATABASE_URL" -c "SELECT * FROM insurance_leads ORDER BY created_at DESC LIMIT 5;"
```

---

**Total Time:** ~15 minutes  
**Difficulty:** ⭐⭐☆☆☆ (Easy)  
**Status:** ✅ READY TO GO
