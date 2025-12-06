# 🚀 MANUAL DEPLOYMENT STEPS - Button Handler

**Run these commands in your terminal NOW**

---

## Step 1: Navigate to Project
```bash
cd /Users/jeanbosco/workspace/easymo
```

---

## Step 2: Set Credentials
```bash
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
```

---

## Step 3: Deploy the Function
```bash
supabase functions deploy wa-webhook-core --project-ref lhbowpbcpwoiparwnwgt
```

**Expected output:**
```
Deploying wa-webhook-core...
Uploading intent-opt-out.ts
Uploading index.ts
✓ Deployed function wa-webhook-core
```

---

## Step 4: Test Immediately

### Test 1: Send "SUBSCRIBE"
Open WhatsApp, send to your test number:
```
SUBSCRIBE
```

**Expected response:**
```
✅ *Welcome Back!*

You are now subscribed to match notifications.

We'll notify you when we find matches for your requests.

💬 To stop notifications anytime:
• Click "🔕 Stop notifications" button on any notification
• Or reply *STOP*
```

### Test 2: Send "STOP"  
```
STOP
```

**Expected response:**
```
🔕 *Notifications Stopped*

You will no longer receive match notifications from EasyMO.

Your pending intents have been cancelled.

📱 To start receiving notifications again, reply *SUBSCRIBE*.
```

---

## ✅ Success Criteria

If both tests work:
- ✅ Deployment successful
- ✅ Button handler working
- ✅ Feature 100% complete

If issues:
- Check Supabase logs
- Verify database functions exist
- Check environment variables

---

**THAT'S IT!** 

Just 3 commands to deploy. Then test with WhatsApp.

🎉 This completes the entire Enhanced Call Center AGI system!
