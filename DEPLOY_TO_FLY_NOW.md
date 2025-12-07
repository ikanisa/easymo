# 🚀 Deploy WhatsApp Voice Bridge to Fly.io - NOW!

## ✅ STATUS: READY TO DEPLOY (3 Simple Commands)

**Platform**: Fly.io  
**Time**: 5 minutes  
**Cost**: FREE  
**Difficulty**: ⭐ Easy

---

## 🎯 Why Fly.io is Perfect

✅ **Simplest deployment** (3 commands vs Railway's complex UI)  
✅ **Free tier** (3 VMs, 256MB RAM each)  
✅ **Auto-scaling** (scales to zero when idle)  
✅ **Automatic SSL** (free HTTPS)  
✅ **Great for WebRTC** (low latency, persistent connections)  
✅ **No billing account required**

---

## 🚀 DEPLOY NOW (Copy & Paste)

### Step 1: Install Fly CLI (1 minute)

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Or via Homebrew
brew install flyctl
```

### Step 2: Login (30 seconds)

```bash
flyctl auth login
```

This opens your browser for authentication.

### Step 3: Deploy (3 minutes)

```bash
cd services/whatsapp-voice-bridge

# Launch and deploy
flyctl launch
```

**When prompted, answer**:
- **App name**: Press Enter (auto-generates) or type `whatsapp-voice-bridge`
- **Region**: Type `iad` (US East - best for WhatsApp)
- **Would you like to set up a Postgresql database?**: `N`
- **Would you like to set up an Upstash Redis database?**: `N`

Fly.io will:
1. Detect Dockerfile ✅
2. Build the image ✅
3. Deploy to cloud ✅
4. Give you a URL: `https://whatsapp-voice-bridge.fly.dev` ✅

### Step 4: Set Secrets (1 minute)

```bash
flyctl secrets set \
  OPENAI_API_KEY="sk-proj-your-key-here" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc"
```

**Replace** `sk-proj-your-key-here` with your actual OpenAI key.

---

## 🧪 TEST IT (30 seconds)

```bash
# Get your URL
flyctl info

# Test health
curl https://whatsapp-voice-bridge.fly.dev/health

# Expected: {"status":"ok","service":"whatsapp-voice-bridge"}
```

---

## 🔗 CONNECT TO SUPABASE (1 minute)

```bash
# Update Supabase secret
cd ../..
supabase secrets set VOICE_BRIDGE_URL="https://whatsapp-voice-bridge.fly.dev" \
  --project-ref lhbowpbcpwoiparwnwgt

# Deploy edge function
supabase functions deploy wa-webhook-voice-calls \
  --project-ref lhbowpbcpwoiparwnwgt
```

---

## 📞 MAKE TEST CALL!

Call your WhatsApp Business number and:

✅ Hear GPT-5: "Hi, I'm EasyMO AI. How can I help you?"  
✅ Ask a question  
✅ Hear GPT-5 respond in real-time  
✅ Experience clear audio quality

---

## 🎓 Useful Commands

```bash
# View logs
flyctl logs

# Restart app
flyctl apps restart whatsapp-voice-bridge

# Check status
flyctl status

# Open dashboard
flyctl dashboard

# Scale if needed
flyctl scale memory 512
```

---

## 💰 Cost Breakdown

### Free Tier Includes:
- ✅ 3 shared-cpu VMs (256MB each)
- ✅ 160 GB bandwidth/month
- ✅ Automatic SSL
- ✅ Auto-restart on failure

### Your Usage:
- **RAM**: ~50-100 MB per instance
- **Bandwidth**: ~10 MB per 5-minute call
- **Monthly**: ~500 calls = 5 GB bandwidth

**Total Cost**: **$0** (FREE) ✅

---

## 🐛 Quick Troubleshooting

### "App name already taken"
```bash
flyctl launch --name whatsapp-voice-bridge-prod
```

### Health check fails
```bash
# Check logs
flyctl logs

# Restart
flyctl apps restart whatsapp-voice-bridge
```

### No audio during call
```bash
# Verify secrets are set
flyctl secrets list

# Check OPENAI_API_KEY is not "your-key-here"
flyctl secrets set OPENAI_API_KEY="sk-proj-actual-key"
```

---

## 📋 Complete Deployment Checklist

- [ ] Install flyctl: `brew install flyctl`
- [ ] Login: `flyctl auth login`
- [ ] Navigate: `cd services/whatsapp-voice-bridge`
- [ ] Launch: `flyctl launch`
- [ ] Set secrets: `flyctl secrets set ...`
- [ ] Test: `curl https://whatsapp-voice-bridge.fly.dev/health`
- [ ] Update Supabase: `supabase secrets set VOICE_BRIDGE_URL=...`
- [ ] Deploy edge function: `supabase functions deploy wa-webhook-voice-calls`
- [ ] Make test call! ✅

---

## 🎯 What You're Deploying

```
WhatsApp Call → WebRTC → Voice Bridge (Fly.io) → OpenAI GPT-5
      ↓                                              ↓
  Your voice                                  AI response
      ↓                                              ↓
   8kHz PCM → Resample → 24kHz → OpenAI → 24kHz → Resample → 8kHz
      ↓                                              ↓
  WhatsApp ← WebRTC ← Voice Bridge (Fly.io) ← OpenAI GPT-5
```

**Features**:
- ✅ Real-time bidirectional audio
- ✅ Speak to GPT-5 naturally
- ✅ Hear GPT-5 respond instantly
- ✅ Auto-scaling (scales to zero)
- ✅ Production-ready monitoring

---

## 📚 Documentation

- **Full Guide**: `FLY_IO_DEPLOYMENT_GUIDE.md`
- **Technical**: `services/whatsapp-voice-bridge/AUDIO_PIPELINE_IMPLEMENTATION.md`
- **Fly.io Docs**: https://fly.io/docs

---

## ⏱️ Timeline

| Step | Time |
|------|------|
| Install flyctl | 1 min |
| Login | 30 sec |
| Deploy | 3 min |
| Set secrets | 1 min |
| Test | 30 sec |
| Update Supabase | 1 min |
| **Total** | **~7 minutes** |

---

**Status**: ✅ **READY - START NOW!**

```bash
# Quick start (copy & paste):
brew install flyctl
flyctl auth login
cd services/whatsapp-voice-bridge
flyctl launch
```

You're 7 minutes away from voice calls with GPT-5! 🚀
