# WhatsApp Voice Bridge - Railway Deployment Guide 🚂

## 🎯 Overview

Deploy the WhatsApp Voice Bridge service to Railway (no billing account needed for Cloud Run).

**Service**: `whatsapp-voice-bridge`  
**Platform**: Railway.app  
**Cost**: Free tier available (500 hours/month)  
**Build Time**: ~2-3 minutes  
**Status**: ✅ Ready to Deploy

---

## 🚀 Quick Deploy (Web UI - Recommended)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Verify your email

### Step 2: Deploy from GitHub

**Option A: One-Click Deploy**
1. Go to https://railway.app/new
2. Select "Deploy from GitHub repo"
3. Choose `ikanisa/easymo` repository
4. Set **Root Directory**: `services/whatsapp-voice-bridge`
5. Click "Deploy"

**Option B: Manual Setup**
1. Create new project in Railway dashboard
2. Click "New" → "GitHub Repo"
3. Select `ikanisa/easymo`
4. Railway will auto-detect Node.js

### Step 3: Configure Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```bash
# Required
OPENAI_API_KEY=sk-proj-your-key-here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcndud2d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDU1ODEyNywiZXhwIjoyMDc2MTM0MTI3fQ.mcL3A7LLsyo7Y45hnBXLAYCbp7FpEAfXVRrZoC4CWqc

# Already configured
NODE_ENV=production
LOG_LEVEL=info
PORT=3100
OPENAI_ORG_ID=org-4Kr7lOqpDhJErYgyGzwgSduN
OPENAI_PROJECT_ID=proj_BL7HHgepm76lhElLqmfOckIU
OPENAI_REALTIME_MODEL=gpt-5-realtime
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
```

### Step 4: Configure Build Settings

**Settings** → **Build**:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `node dist/index.js`
- **Root Directory**: `services/whatsapp-voice-bridge`
- **Watch Paths**: `services/whatsapp-voice-bridge/**`

### Step 5: Deploy

1. Click "Deploy" in Railway dashboard
2. Wait 2-3 minutes for build
3. Railway will provide a public URL like:
   ```
   https://whatsapp-voice-bridge-production.up.railway.app
   ```

---

## 🛠️ CLI Deployment (Alternative)

### Install Railway CLI

```bash
# macOS
brew install railway

# npm
npm install -g @railway/cli

# Verify
railway --version
```

### Deploy with CLI

```bash
# 1. Login to Railway
railway login

# 2. Create new project
cd services/whatsapp-voice-bridge
railway init

# 3. Link to project
railway link

# 4. Set environment variables
railway variables set OPENAI_API_KEY="sk-proj-..."
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."
railway variables set NODE_ENV="production"
railway variables set LOG_LEVEL="info"
railway variables set PORT="3100"
railway variables set OPENAI_ORG_ID="org-4Kr7lOqpDhJErYgyGzwgSduN"
railway variables set OPENAI_PROJECT_ID="proj_BL7HHgepm76lhElLqmfOckIU"
railway variables set OPENAI_REALTIME_MODEL="gpt-5-realtime"
railway variables set SUPABASE_URL="https://lhbowpbcpwoiparwnwgt.supabase.co"

# 5. Deploy
railway up

# 6. Get URL
railway domain
```

---

## 📋 Environment Variables Reference

### Critical (Must Set)
```bash
OPENAI_API_KEY          # Get from https://platform.openai.com/api-keys
SUPABASE_SERVICE_ROLE_KEY # Already provided above
```

### Pre-configured (Copy from above)
```bash
NODE_ENV                # production
LOG_LEVEL               # info
PORT                    # 3100
OPENAI_ORG_ID          # org-4Kr7lOqpDhJErYgyGzwgSduN
OPENAI_PROJECT_ID      # proj_BL7HHgepm76lhElLqmfOckIU
OPENAI_REALTIME_MODEL  # gpt-5-realtime
SUPABASE_URL           # https://lhbowpbcpwoiparwnwgt.supabase.co
```

---

## 🧪 Post-Deployment Testing

### 1. Get Your Railway URL
```bash
# From Railway dashboard (Settings → Domains)
SERVICE_URL="https://whatsapp-voice-bridge-production.up.railway.app"
```

### 2. Test Health Endpoint
```bash
curl $SERVICE_URL/health

# Expected response:
# {"status":"ok","service":"whatsapp-voice-bridge","timestamp":"..."}
```

### 3. Check Logs
```bash
# Web UI: Railway dashboard → Deployments → View Logs

# CLI:
railway logs
```

### 4. Update Supabase Secret
```bash
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
   - ✅ Latency < 300ms

---

## 🎓 Railway.json Configuration

Already created at `services/whatsapp-voice-bridge/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🔍 Troubleshooting

### Build fails: "Cannot find module 'wrtc'"
**Solution**: Railway will automatically install dependencies. Ensure `wrtc` is in `dependencies` (not `devDependencies`)

**Check package.json**:
```json
"dependencies": {
  "wrtc": "^0.4.7",
  ...
}
```

### Service crashes: "Port already in use"
**Solution**: Railway sets `PORT` automatically via environment variable. Our code already handles this:
```typescript
const port = process.env.PORT || 3100;
```

### Health check returns 503
**Causes**:
1. Service still starting (wait 30 seconds)
2. Build failed (check Railway logs)
3. Environment variables missing (verify in dashboard)

**Solution**: Check Railway logs for errors

### No audio during call
**Check**:
1. OPENAI_API_KEY is set correctly (not placeholder)
2. Service logs show "Connected to OpenAI Realtime API"
3. WebRTC connection established
4. Edge function deployed and pointing to Railway URL

**Solution**:
```bash
# Verify environment
railway variables

# Check logs
railway logs --tail 100
```

---

## 💰 Railway Pricing

### Free Tier (Hobby Plan)
- **500 execution hours/month** (≈ 21 days continuous)
- **1 GB RAM**
- **1 vCPU**
- **100 GB bandwidth/month**
- **Automatic SSL**
- **Perfect for development & testing**

### Usage Estimate for WhatsApp Voice
- Average call: 5 minutes
- Calls per day: 50
- Monthly hours: ~4 hours
- **Cost**: FREE (within 500 hour limit)

### Upgrade if Needed
- **Developer Plan**: $5/month
  - 500 hours execution
  - Priority support
- **Team Plan**: $20/month
  - Unlimited hours
  - Team collaboration

---

## 🏗️ Architecture

```
WhatsApp Cloud API
    ↓ (WebRTC SDP)
wa-webhook-voice-calls (Supabase Edge Function)
    ↓ (HTTP POST)
whatsapp-voice-bridge (Railway) ← YOU ARE HERE
    ↓ (WebSocket)
OpenAI Realtime API (GPT-5)

Audio Flow:
WhatsApp → WebRTC → RTCAudioSink → Resample → OpenAI
OpenAI → Resample → RTCAudioSource → WebRTC → WhatsApp
```

---

## ✅ Deployment Checklist

### Pre-Deploy
- [x] Code merged to main
- [x] Build successful locally
- [x] Railway configuration created
- [ ] Railway account created
- [ ] OpenAI API key ready

### Deploy
- [ ] Project created in Railway
- [ ] Environment variables set
- [ ] Service deployed
- [ ] Deployment successful

### Post-Deploy
- [ ] Health check passing
- [ ] Service URL obtained
- [ ] Supabase secret updated
- [ ] Edge function deployed
- [ ] Integration test successful

---

## 📚 Documentation

- **Technical Guide**: `services/whatsapp-voice-bridge/AUDIO_PIPELINE_IMPLEMENTATION.md`
- **Implementation Summary**: `WHATSAPP_VOICE_AUDIO_PIPELINE_COMPLETE.md`
- **Railway Config**: `services/whatsapp-voice-bridge/railway.json`

---

## 🔗 Quick Links

- **Railway Dashboard**: https://railway.app/dashboard
- **Railway Docs**: https://docs.railway.app
- **OpenAI API Keys**: https://platform.openai.com/api-keys
- **Supabase Dashboard**: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt

---

## 🚀 Quick Start Commands

```bash
# Install Railway CLI
brew install railway

# Login
railway login

# Deploy
cd services/whatsapp-voice-bridge
railway init
railway link
railway up

# Set environment variables (one by one)
railway variables set OPENAI_API_KEY="sk-proj-..."
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."
railway variables set NODE_ENV="production"

# Get URL
railway domain

# View logs
railway logs
```

---

**Status**: ✅ **READY FOR RAILWAY DEPLOYMENT**

**Recommended**: Use the **Web UI** method (easiest) - just:
1. Go to https://railway.app/new
2. Connect GitHub repo
3. Set environment variables
4. Deploy!

The complete audio pipeline is ready to go live! 🚀
