# DEPLOY NOW - Step by Step Instructions

**Date**: 2025-12-07  
**Time**: 10:03 UTC

---

## 🚀 STEP 1: Deploy Voice Bridge to Fly.io

Open your terminal and run:

```bash
cd services/whatsapp-voice-bridge
flyctl deploy
```

**Expected output:**
- Building Docker image (~2 min)
- Pushing to Fly.io registry (~1 min)
- Deploying to machines (~2 min)
- Health checks passing
- "Visit your newly deployed app at https://whatsapp-voice-bridge-dark-dew-6515.fly.dev/"

**Wait for this to complete before proceeding to Step 2**

---

## 🚀 STEP 2: Deploy Edge Function to Supabase

### Set your credentials:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_500607f0d078e919aa24f179473291544003a035"
export SUPABASE_DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
```

### Deploy the function:

```bash
cd ../../supabase
supabase functions deploy wa-webhook-voice-calls --project-ref lhbowpbcpwoiparwnwgt
```

**Expected output:**
- Bundling function
- Uploading to Supabase
- Function deployed successfully
- Version number displayed

---

## ✅ STEP 3: Verify Deployments

### Check Voice Bridge:
```bash
curl https://whatsapp-voice-bridge-dark-dew-6515.fly.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "whatsapp-voice-bridge",
  "activeCalls": 0,
  "uptime": 123
}
```

### Check Edge Function:
```bash
supabase functions list --project-ref lhbowpbcpwoiparwnwgt
```

Should show `wa-webhook-voice-calls` with latest version.

---

## 🧪 STEP 4: Test Voice Call

### Watch logs in real-time:
```bash
flyctl logs --app whatsapp-voice-bridge-dark-dew-6515
```

### Make a test call:
1. Call your WhatsApp business number from your phone
2. Wait for connection
3. Speak when connected
4. **AI should respond within 1-2 seconds** ✅

### Expected logs (SUCCESS):
```
[INFO] === STARTING VOICE CALL SESSION ===
[INFO] STEP 1: Setting up WebRTC peer connection...
[INFO] ✓ WebRTC setup complete
[INFO] STEP 2: Connecting to OpenAI Realtime API...
[INFO] ✓ OpenAI connection established  ← NO ERROR HERE!
[INFO] STEP 3: Setting up audio bridging...
[INFO] ✓ Audio bridge configured
[INFO] === VOICE CALL SESSION READY ===
[INFO] Sending audio to OpenAI
[INFO] Received audio from OpenAI
[INFO] Sent audio to WhatsApp
```

### What you should hear:
- AI greets you immediately
- Clear audio quality
- AI responds to what you say
- Natural conversation

---

## 🐛 If Something Goes Wrong

### Still seeing "invalid_model" error:

**Check the model in logs:**
```bash
flyctl logs --app whatsapp-voice-bridge-dark-dew-6515 | grep model
```

Should show: `model: gpt-4o-realtime-preview`

**If still wrong, force rebuild:**
```bash
cd services/whatsapp-voice-bridge
flyctl deploy --force
```

### OpenAI connection fails:

1. **Check API key:**
   ```bash
   flyctl secrets list --app whatsapp-voice-bridge-dark-dew-6515
   ```
   Should show `OPENAI_API_KEY` (value hidden)

2. **Check OpenAI status:**
   Visit: https://status.openai.com

3. **Review detailed logs:**
   ```bash
   flyctl logs --app whatsapp-voice-bridge-dark-dew-6515
   ```

### Edge function not working:

```bash
# Check deployment
supabase functions list --project-ref lhbowpbcpwoiparwnwgt

# Redeploy if needed
supabase functions deploy wa-webhook-voice-calls --project-ref lhbowpbcpwoiparwnwgt
```

### Voice Bridge not responding:

```bash
# Check status
flyctl status --app whatsapp-voice-bridge-dark-dew-6515

# Restart machines if needed
flyctl machine restart 2873d34a39e0d8 --app whatsapp-voice-bridge-dark-dew-6515
flyctl machine restart 8d934ecee4dee8 --app whatsapp-voice-bridge-dark-dew-6515
```

---

## 📊 Quick Reference

### URLs:
- **Voice Bridge**: https://whatsapp-voice-bridge-dark-dew-6515.fly.dev
- **Health Check**: https://whatsapp-voice-bridge-dark-dew-6515.fly.dev/health
- **Fly Dashboard**: https://fly.io/apps/whatsapp-voice-bridge-dark-dew-6515
- **Supabase Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt

### Commands:
```bash
# Watch logs
flyctl logs --app whatsapp-voice-bridge-dark-dew-6515

# Check status
flyctl status --app whatsapp-voice-bridge-dark-dew-6515

# List secrets
flyctl secrets list --app whatsapp-voice-bridge-dark-dew-6515

# Deploy edge function
supabase functions deploy wa-webhook-voice-calls --project-ref lhbowpbcpwoiparwnwgt
```

---

## ✨ Success!

When you see these logs and hear AI responding, the system is working:

✅ WebRTC connected  
✅ OpenAI connected (no model error)  
✅ Audio flowing bidirectionally  
✅ AI responding naturally  
✅ Clear audio quality  

**The voice calling system is now fully operational!** 🎉

---

## 📝 What Was Fixed

- Changed OpenAI model from `gpt-5-realtime` (invalid) to `gpt-4o-realtime-preview` (valid)
- Fixed in 7 files across voice bridge and edge function
- Updated all deployment scripts and documentation
- System now connects to OpenAI successfully

---

## 🔗 Documentation

- **START_HERE.md** - Quick start guide
- **COMPLETE_ANALYSIS_AND_FIX.md** - Full technical analysis
- **This file** - Deployment instructions

---

**Ready?** Run the commands above to deploy! 🚀
