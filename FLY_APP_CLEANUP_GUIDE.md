# Fly.io App Cleanup Guide

## 🧹 Current Situation

You have **8 Fly.io apps** but only need **1**:

### ✅ Keep This One
- **whatsapp-voice-bridge-dark-dew-6515** (ACTIVE - 2 machines running)
  - URL: https://whatsapp-voice-bridge-dark-dew-6515.fly.dev
  - Status: Deployed and working
  - This is the one we've been using

### ❌ Delete These 7
1. whatsapp-voice-bridge-snowy-pond-1543 (Pending)
2. whatsapp-voice-bridge-morning-surf-3945 (Pending)
3. whatsapp-voice-bridge-cool-leaf-8892 (Pending)
4. whatsapp-voice-bridge-twilight-sunset-7950 (Pending)
5. whatsapp-voice-bridge-cool-shadow-5075 (Pending)
6. whatsapp-voice-bridge-long-haze-5011 (Pending)
7. whatsapp-voice-bridge (Suspended)

These were created during multiple `flyctl launch` attempts.

---

## 🗑️ How to Clean Up

### Option 1: Delete via Fly.io Dashboard (Easiest)

1. Go to https://fly.io/dashboard
2. For each app to delete:
   - Click on the app name
   - Go to Settings
   - Scroll to bottom
   - Click "Delete App"
   - Confirm deletion

### Option 2: Delete via CLI

```bash
# Delete each app
flyctl apps destroy whatsapp-voice-bridge-snowy-pond-1543 --yes
flyctl apps destroy whatsapp-voice-bridge-morning-surf-3945 --yes
flyctl apps destroy whatsapp-voice-bridge-cool-leaf-8892 --yes
flyctl apps destroy whatsapp-voice-bridge-twilight-sunset-7950 --yes
flyctl apps destroy whatsapp-voice-bridge-cool-shadow-5075 --yes
flyctl apps destroy whatsapp-voice-bridge-long-haze-5011 --yes
flyctl apps destroy whatsapp-voice-bridge --yes
```

### Option 3: Delete Multiple at Once

```bash
# Create a quick script
for app in \
  whatsapp-voice-bridge-snowy-pond-1543 \
  whatsapp-voice-bridge-morning-surf-3945 \
  whatsapp-voice-bridge-cool-leaf-8892 \
  whatsapp-voice-bridge-twilight-sunset-7950 \
  whatsapp-voice-bridge-cool-shadow-5075 \
  whatsapp-voice-bridge-long-haze-5011 \
  whatsapp-voice-bridge
do
  echo "Deleting $app..."
  flyctl apps destroy "$app" --yes || true
done

echo "✅ Cleanup complete!"
```

---

## ✅ After Cleanup

You should have only:
- **1 app**: whatsapp-voice-bridge-dark-dew-6515
- **Status**: Deployed
- **Machines**: 2 running
- **URL**: https://whatsapp-voice-bridge-dark-dew-6515.fly.dev

---

## 💡 Why This Happened

During deployment testing, we ran `flyctl launch` multiple times:
- Each `launch` creates a new app
- The apps weren't deleted after testing
- Only the last one (dark-dew-6515) is actually being used

---

## 🎯 What to Do Now

1. **Clean up the duplicate apps** (use Option 1 - Dashboard is easiest)
2. **Keep only**: whatsapp-voice-bridge-dark-dew-6515
3. **Then test the voice calls** - the service is ready!

---

## 📞 Testing the Voice Calls

Once cleanup is done:

```bash
# Watch logs
flyctl logs --app whatsapp-voice-bridge-dark-dew-6515

# Make a test call to your WhatsApp Business number

# You should see in logs:
# === STARTING VOICE CALL SESSION ===
# STEP 1: Setting up WebRTC peer connection...
# ✓ WebRTC setup complete
# STEP 2: Connecting to OpenAI Realtime API...
# ✓ OpenAI connection established
# STEP 3: Setting up audio bridging...
# ✓ Audio bridge configured
# === VOICE CALL SESSION READY ===
```

---

**Priority**: Clean up the 7 duplicate apps first, then we can properly test the voice calls with the enhanced logging! 🧹
