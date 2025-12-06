# Button Handler Deployment - READY

**Date:** 2025-12-06 14:37 UTC  
**Status:** ✅ CODE READY - DEPLOY NOW

---

## 🎯 What to Deploy

The WhatsApp button handler for intent notification opt-out/opt-in.

**Files:**
1. ✅ `supabase/functions/wa-webhook-core/handlers/intent-opt-out.ts` (220 lines)
2. ✅ `supabase/functions/wa-webhook-core/index.ts` (updated with handler)

---

## 🚀 Deployment Command

```bash
cd /Users/jeanbosco/workspace/easymo

# First, restore the Call Center AGI changes
git checkout feature/my-business-integration
git stash pop

# Deploy the updated webhook core
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
supabase functions deploy wa-webhook-core --project-ref lhbowpbcpwoiparwnwgt
```

---

## ✅ What Gets Deployed

### Updated Function: wa-webhook-core

**New handler:** `handlers/intent-opt-out.ts`
- Processes button clicks from notifications
- Handles SUBSCRIBE/STOP text commands
- Calls database functions
- Sends confirmation messages

**Updated router:** `index.ts`
- Checks opt-out/opt-in BEFORE routing
- Returns early if handled
- Logs events

---

## 🧪 Testing After Deployment

### Test 1: Text Command - SUBSCRIBE
```
1. Send WhatsApp message: "SUBSCRIBE"
2. Expected: Receive welcome message
3. Check logs for: PROCESSING_OPT_IN, OPT_IN_COMPLETE
```

### Test 2: Text Command - STOP
```
1. Send WhatsApp message: "STOP"
2. Expected: Receive opt-out confirmation
3. Check logs for: PROCESSING_OPT_OUT, OPT_OUT_COMPLETE
4. Verify in DB: notifications_enabled = false
```

### Test 3: Button Click (requires intent notification first)
```
1. Create an intent (voice call to agent)
2. Wait for notification (5 min)
3. Click "🔕 Stop notifications" button
4. Expected: Receive confirmation message
5. Check logs for: INTENT_OPT_OUT_HANDLED
```

---

## 📊 Database Verification

### Check opt-out status
```sql
SELECT 
  phone_number,
  notifications_enabled,
  opted_out_at,
  opted_out_reason
FROM intent_notification_preferences
ORDER BY created_at DESC
LIMIT 5;
```

### Check if intents were cancelled
```sql
SELECT 
  phone_number,
  intent_type,
  status,
  created_at
FROM user_intents
WHERE status = 'cancelled'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📝 Deployment Checklist

- [ ] Restore stashed changes (git stash pop)
- [ ] Set SUPABASE_ACCESS_TOKEN
- [ ] Deploy wa-webhook-core function
- [ ] Test SUBSCRIBE command
- [ ] Test STOP command
- [ ] Monitor logs for errors
- [ ] Verify database updates

---

## ⚠️ Important Notes

**This completes the opt-out feature!**

Without this deployment:
- ❌ Users clicking button get no response
- ❌ SUBSCRIBE command doesn't work
- ❌ Bad user experience

With this deployment:
- ✅ Button clicks work instantly
- ✅ Text commands work
- ✅ Professional UX
- ✅ Database updated correctly

---

## 🔗 Related

- Database functions: Already deployed ✅
- Intent processor: Already deployed ✅
- Interactive button: Already deployed ✅
- **Button handler: DEPLOYING NOW** ⏳

---

**Status:** READY TO DEPLOY  
**Impact:** HIGH (completes feature)  
**Risk:** LOW (no breaking changes)  
**Time:** 5 minutes
