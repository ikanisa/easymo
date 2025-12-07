# WhatsApp Voice Bridge - Fly.io Deployment Guide 🚀

## 🎯 Overview

Deploy WhatsApp Voice Bridge to Fly.io - Simple, fast, and free tier available.

**Platform**: Fly.io  
**Deployment Time**: ~3-5 minutes  
**Cost**: Free tier (3 shared-cpu-1x VMs)  
**Status**: ✅ Ready to Deploy

---

## ✅ Why Fly.io?

- ✅ **Simpler than Railway** - Just 3 commands
- ✅ **Free tier** - 3 shared VMs, 256MB RAM each
- ✅ **Fast global deployment** - Edge locations worldwide
- ✅ **Automatic SSL** - Free HTTPS certificates
- ✅ **Auto-scaling** - Scale to zero when idle
- ✅ **Great for WebRTC** - Low latency, persistent connections

---

## 🚀 Quick Deploy (3 Commands)

### Step 1: Install Fly CLI

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Or via Homebrew
brew install flyctl

# Verify installation
flyctl version
```

### Step 2: Login to Fly.io

```bash
flyctl auth login
```

This opens your browser for authentication.

### Step 3: Deploy

```bash
cd services/whatsapp-voice-bridge

# Launch (creates app and deploys)
flyctl launch

# When prompted:
# - App name: whatsapp-voice-bridge (or leave blank for auto-generated)
# - Region: iad (US East - Ashburn)
# - Database: No
# - Redis: No
```

**That's it!** Fly.io will:
1. Detect the Dockerfile
2. Build the image
3. Deploy to the cloud
4. Give you a URL: `https://whatsapp-voice-bridge.fly.dev`

---

## 🔐 Set Secrets (Required)

```bash
# Set sensitive environment variables as secrets
flyctl secrets set \
  OPENAI_API_KEY="sk-proj-your-key-here" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
```

This will automatically restart the app with the new secrets.

---

## 🧪 Post-Deployment Testing

### 1. Get Your App URL

```bash
flyctl info

# Or open in browser
flyctl open
```

Your URL will be: `https://whatsapp-voice-bridge.fly.dev`

### 2. Test Health Endpoint

```bash
curl https://whatsapp-voice-bridge.fly.dev/health

# Expected response:
# {"status":"ok","service":"whatsapp-voice-bridge","timestamp":"..."}
```

### 3. Check Logs

```bash
# Real-time logs
flyctl logs

# Or in dashboard
flyctl dashboard
```

### 4. Update Supabase Secret

```bash
SERVICE_URL="https://whatsapp-voice-bridge.fly.dev"

supabase secrets set VOICE_BRIDGE_URL="$SERVICE_URL" \
  --project-ref lhbowpbcpwoiparwnwgt
```

### 5. Deploy Edge Function

```bash
supabase functions deploy wa-webhook-voice-calls \
  --project-ref lhbowpbcpwoiparwnwgt
```

### 6. Integration Test

1. Call your WhatsApp Business number
2. **Expected**:
   - ✅ Hear GPT-5: "Hi, I'm EasyMO AI. How can I help you?"
   - ✅ Speak a question
   - ✅ Hear GPT-5 respond
   - ✅ Clear audio quality
   - ✅ Low latency (< 200ms)

---

## 📋 Configuration Files

### `fly.toml` (Already Created)

```toml
app = "whatsapp-voice-bridge"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  LOG_LEVEL = "info"
  PORT = "8080"
  # ... other env vars

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### Environment Variables

**Public (in fly.toml)**:
- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `PORT=8080`
- `OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN`
- `OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU`
- `OPENAI_REALTIME_MODEL=gpt-5-realtime`
- `SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co`

**Secrets (set via flyctl)**:
- `OPENAI_API_KEY` ⚠️ Required
- `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Required

---

## 🎓 Common Commands

```bash
# Deploy changes
flyctl deploy

# View app status
flyctl status

# View logs
flyctl logs

# Restart app
flyctl apps restart whatsapp-voice-bridge

# Scale resources
flyctl scale memory 512  # Increase to 512MB

# Open dashboard
flyctl dashboard

# SSH into machine
flyctl ssh console

# Check secrets
flyctl secrets list
```

---

## 💰 Fly.io Pricing

### Free Tier (Hobby Plan)
- ✅ **3 shared-cpu-1x VMs** (256 MB RAM each)
- ✅ **160 GB outbound data transfer**
- ✅ **Automatic SSL**
- ✅ **Auto-scaling**
- ✅ **Perfect for this use case**

### Resource Usage (WhatsApp Voice Bridge)
- **RAM**: ~50-100 MB per instance
- **CPU**: Shared 1x (sufficient)
- **Bandwidth**: ~10 MB per 5-minute call
- **Monthly estimate**: ~500 calls = 5 GB bandwidth

**Cost**: **$0** (FREE - well within free tier limits)

### If You Need More
- **Scale up**: `flyctl scale memory 512` ($5/month)
- **More VMs**: `flyctl scale count 2` (adds redundancy)

---

## 🔍 Troubleshooting

### Deployment fails: "App name already taken"

```bash
# Use a unique name
flyctl launch --name whatsapp-voice-bridge-prod
```

### Build fails: "Cannot find module 'wrtc'"

**Solution**: The Dockerfile builds TypeScript correctly. Check:
```bash
flyctl logs
```

### Health check returns 404

**Check**:
1. App is running: `flyctl status`
2. Correct port (8080): Check `fly.toml`
3. Logs for errors: `flyctl logs`

**Solution**:
```bash
# Restart the app
flyctl apps restart whatsapp-voice-bridge
```

### App crashes: "Out of memory"

**Solution**: Increase memory allocation
```bash
flyctl scale memory 512
```

### No audio during call

**Check**:
1. Secrets are set: `flyctl secrets list`
2. OPENAI_API_KEY is correct
3. Service logs show "Connected to OpenAI"
4. VOICE_BRIDGE_URL updated in Supabase

**Debug**:
```bash
# Check logs
flyctl logs --app whatsapp-voice-bridge

# SSH into machine
flyctl ssh console
```

---

## 🏗️ Architecture

```
WhatsApp Cloud API
    ↓ (WebRTC)
wa-webhook-voice-calls (Supabase Edge)
    ↓ (HTTP)
whatsapp-voice-bridge (Fly.io) ← YOU ARE HERE
    ↓ (WebSocket)
OpenAI Realtime API (GPT-5)

Audio Pipeline:
WhatsApp (G.711 @ 8kHz)
    ↓
RTCAudioSink → PCM 8kHz → Resample → PCM 24kHz
    ↓
OpenAI Realtime
    ↓
PCM 24kHz → Resample → PCM 8kHz → RTCAudioSource
    ↓
WhatsApp (G.711 @ 8kHz)
```

---

## 🎯 Deployment Checklist

### Pre-Deploy
- [x] Code merged to main
- [x] Build successful
- [x] `fly.toml` created
- [x] Dockerfile updated
- [ ] Fly.io CLI installed
- [ ] OpenAI API key ready

### Deploy
- [ ] `flyctl auth login`
- [ ] `flyctl launch`
- [ ] Secrets set (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] App deployed successfully

### Post-Deploy
- [ ] Health check passing
- [ ] Logs clean
- [ ] Supabase secret updated
- [ ] Edge function deployed
- [ ] Test call successful

---

## 📚 Documentation

- **Fly.io Docs**: https://fly.io/docs
- **Fly.io Dashboard**: https://fly.io/dashboard
- **Technical Guide**: `services/whatsapp-voice-bridge/AUDIO_PIPELINE_IMPLEMENTATION.md`
- **Audio Pipeline**: Complete bidirectional audio flow implemented

---

## �� Fly.io vs Railway vs Cloud Run

| Feature | Fly.io | Railway | Cloud Run |
|---------|--------|---------|-----------|
| Setup Complexity | ⭐⭐ Simple | ⭐⭐⭐ Medium | ⭐⭐⭐⭐ Complex |
| Free Tier | ✅ 3 VMs | ✅ 500 hrs | ❌ Needs billing |
| Commands | 3 commands | Web UI | Many commands |
| WebRTC Support | ✅ Excellent | ✅ Good | ✅ Excellent |
| Auto-scaling | ✅ Yes | ✅ Yes | ✅ Yes |
| Global CDN | ✅ Yes | ⚠️ Limited | ✅ Yes |

**Winner for this use case**: **Fly.io** ✅

---

## 🚀 Complete Deployment Example

```bash
# 1. Install Fly CLI
brew install flyctl

# 2. Login
flyctl auth login

# 3. Navigate to service
cd services/whatsapp-voice-bridge

# 4. Launch app
flyctl launch
# Choose:
# - Name: whatsapp-voice-bridge
# - Region: iad (US East)
# - No to databases

# 5. Set secrets
flyctl secrets set \
  OPENAI_API_KEY="sk-proj-your-key-here" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"

# 6. Test
curl https://whatsapp-voice-bridge.fly.dev/health

# 7. Update Supabase
cd ../..
supabase secrets set VOICE_BRIDGE_URL="https://whatsapp-voice-bridge.fly.dev" \
  --project-ref lhbowpbcpwoiparwnwgt

# 8. Deploy edge function
supabase functions deploy wa-webhook-voice-calls \
  --project-ref lhbowpbcpwoiparwnwgt

# 9. Make test call!
```

**Total time**: ~5 minutes

---

**Status**: ✅ **READY TO DEPLOY TO FLY.IO**

**Next Step**:
```bash
brew install flyctl
flyctl auth login
cd services/whatsapp-voice-bridge
flyctl launch
```

Simple, fast, and free! 🚀
