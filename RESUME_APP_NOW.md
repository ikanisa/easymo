# Resume Voice Bridge App - Quick Commands

**Date:** 2025-12-07 09:09 UTC  
**App:** whatsapp-voice-bridge-dark-dew-6515  
**Status:** Suspended → Need to Resume

---

## 🚀 Resume the App (Run These Commands)

Open your terminal and run:

```bash
# Navigate to voice bridge directory
cd ~/workspace/easymo/services/whatsapp-voice-bridge

# Resume the app
fly apps resume whatsapp-voice-bridge-dark-dew-6515

# Check status
fly status --app whatsapp-voice-bridge-dark-dew-6515
```

**Expected output:**
```
App
  Name     = whatsapp-voice-bridge-dark-dew-6515
  Owner    = personal
  Hostname = whatsapp-voice-bridge-dark-dew-6515.fly.dev
  Platform = machines
  
Machines
  ID       STATUS   REGION  HEALTH  CHECKS
  xxxx     started  ams     passing  1 total
  yyyy     started  ams     passing  1 total
```

---

## 📊 Alternative: Redeploy

If resume doesn't work, redeploy:

```bash
cd ~/workspace/easymo/services/whatsapp-voice-bridge
fly deploy --app whatsapp-voice-bridge-dark-dew-6515
```

---

## 🧪 Test Voice Calls

Once running:

### Terminal 1: Watch logs
```bash
fly logs --app whatsapp-voice-bridge-dark-dew-6515
```

### Terminal 2: Make call
Call your WhatsApp Business number and watch the logs in Terminal 1.

---

## 📋 Expected Log Output

### If working:
```
=== STARTING VOICE CALL SESSION ===
STEP 1: Setting up WebRTC peer connection...
✓ WebRTC setup complete
STEP 2: Connecting to OpenAI Realtime API...
✓ OpenAI connection established
STEP 3: Setting up audio bridging...
✓ Audio bridge configured
=== VOICE CALL SESSION READY ===
```

### If failing:
```
=== STARTING VOICE CALL SESSION ===
STEP 1: Setting up WebRTC peer connection...
❌ ERROR: Connection failed
Details: [specific error message]
```

---

## 🔍 Quick Health Check

```bash
# Check app status
fly status --app whatsapp-voice-bridge-dark-dew-6515

# Check secrets are set
fly secrets list --app whatsapp-voice-bridge-dark-dew-6515

# View recent logs
fly logs --app whatsapp-voice-bridge-dark-dew-6515 -n 100
```

---

## 🆘 Troubleshooting

### App won't resume?
```bash
# Force restart
fly apps restart whatsapp-voice-bridge-dark-dew-6515
```

### Still suspended?
```bash
# Redeploy
cd services/whatsapp-voice-bridge
fly deploy --app whatsapp-voice-bridge-dark-dew-6515
```

### Secrets missing?
```bash
fly secrets set \
  OPENAI_API_KEY=your-openai-key \
  SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key \
  --app whatsapp-voice-bridge-dark-dew-6515
```

---

## ✅ Success Checklist

- [ ] App resumed/restarted
- [ ] Status shows "running"
- [ ] 2 machines active
- [ ] Health checks passing
- [ ] Logs streaming
- [ ] Voice call tested
- [ ] Issue identified (if any)

---

**Next:** Run these commands in your terminal to resume the app and test! 🚀
