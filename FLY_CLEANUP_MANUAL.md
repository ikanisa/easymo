# Fly.io App Cleanup - Manual Steps

**Created:** 2025-12-07  
**Status:** Ready to Execute

---

## 🎯 Objective

Delete 7 duplicate Fly.io voice bridge apps, keeping only:
- ✅ **whatsapp-voice-bridge-dark-dew-6515** (the working one)

---

## ⚠️ Apps to Delete (7 total)

1. `whatsapp-voice-bridge-snowy-pond-1543` ✅ DELETED
2. `whatsapp-voice-bridge-morning-surf-3945` ✅ DELETED
3. `whatsapp-voice-bridge-cool-leaf-8892`
4. `whatsapp-voice-bridge-twilight-sunset-7950`
5. `whatsapp-voice-bridge-cool-shadow-5075`
6. `whatsapp-voice-bridge-long-haze-5011`
7. `whatsapp-voice-bridge` (suspended)

---

## 🚀 Method 1: CLI (Fastest)

Open your terminal and run:

```bash
# Delete remaining 5 apps (2 already deleted)
fly apps destroy whatsapp-voice-bridge-cool-leaf-8892 --yes
fly apps destroy whatsapp-voice-bridge-twilight-sunset-7950 --yes
fly apps destroy whatsapp-voice-bridge-cool-shadow-5075 --yes
fly apps destroy whatsapp-voice-bridge-long-haze-5011 --yes
fly apps destroy whatsapp-voice-bridge --yes

# Verify only one remains
fly apps list | grep voice-bridge
```

**Expected output:**
```
whatsapp-voice-bridge-dark-dew-6515    personal    running    ...
```

---

## 🖥️ Method 2: Web Dashboard (Easiest)

1. **Open Fly.io Dashboard:**
   ```
   https://fly.io/dashboard
   ```

2. **Delete each duplicate app:**
   - Find app in the list
   - Click on app name
   - Click "Settings" tab
   - Scroll down to "Delete App"
   - Type app name to confirm
   - Click "Delete App"

3. **Repeat for all 5 remaining duplicates:**
   - whatsapp-voice-bridge-cool-leaf-8892
   - whatsapp-voice-bridge-twilight-sunset-7950
   - whatsapp-voice-bridge-cool-shadow-5075
   - whatsapp-voice-bridge-long-haze-5011
   - whatsapp-voice-bridge

4. **Verify only one remains:**
   - Should only see: `whatsapp-voice-bridge-dark-dew-6515`

---

## ✅ Verification Steps

After cleanup, verify:

```bash
# 1. List all voice bridge apps (should be only 1)
fly apps list | grep voice-bridge

# 2. Check status of the kept app
fly status --app whatsapp-voice-bridge-dark-dew-6515

# 3. Verify it's running
fly apps list --json | jq '.[] | select(.Name | contains("voice-bridge"))'
```

**Expected output:**
```
whatsapp-voice-bridge-dark-dew-6515    personal    running    [timestamp]
```

---

## 📊 Cleanup Progress

- [x] whatsapp-voice-bridge-snowy-pond-1543 ✅ DELETED
- [x] whatsapp-voice-bridge-morning-surf-3945 ✅ DELETED
- [ ] whatsapp-voice-bridge-cool-leaf-8892
- [ ] whatsapp-voice-bridge-twilight-sunset-7950
- [ ] whatsapp-voice-bridge-cool-shadow-5075
- [ ] whatsapp-voice-bridge-long-haze-5011
- [ ] whatsapp-voice-bridge (suspended)

---

## 🔍 After Cleanup: Test Voice Calls

Once cleanup is complete:

### 1. Watch logs in real-time:
```bash
fly logs --app whatsapp-voice-bridge-dark-dew-6515
```

### 2. Make a WhatsApp voice call

Call your WhatsApp Business number and watch the logs.

### 3. Expected log output:
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

### 4. If it fails, you'll see exactly where:
```
=== STARTING VOICE CALL SESSION ===
STEP 1: Setting up WebRTC peer connection...
❌ ERROR: [specific error message]
```

---

## 🆘 Troubleshooting

### Can't delete via CLI?
→ Use Web Dashboard (Method 2)

### App is "suspended"?
→ Still delete it - suspended apps can be deleted

### Delete confirmation needed?
→ Type the full app name exactly as shown

### Accidentally deleted the wrong app?
→ Redeploy from `services/whatsapp-voice-bridge/`:
```bash
cd services/whatsapp-voice-bridge
fly deploy --app whatsapp-voice-bridge-dark-dew-6515
```

---

## 📝 Cleanup Script (Optional)

A script has been created at:
```
cleanup-fly-apps.sh
```

To use it:
```bash
chmod +x cleanup-fly-apps.sh
./cleanup-fly-apps.sh
```

---

## 🎯 Next Steps After Cleanup

1. ✅ Verify only `whatsapp-voice-bridge-dark-dew-6515` remains
2. 🧪 Test voice calls with enhanced logging
3. 🐛 Debug any issues found
4. 🚀 Deploy other services (Admin PWA, Vendor Portal, etc.)

---

**Status:** 2/7 apps deleted, 5 remaining  
**Next Action:** Delete remaining 5 apps via CLI or Dashboard  
**Estimated Time:** 2-3 minutes
