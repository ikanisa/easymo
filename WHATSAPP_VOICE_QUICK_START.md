# WhatsApp Voice Calling - Quick Start

## 🎯 Objective
Get WhatsApp voice calls working in **under 2 hours**.

## ✅ Prerequisites
- [x] WhatsApp Business Cloud API configured
- [x] OpenAI API key with Realtime API access
- [x] Google Cloud Platform account
- [x] Supabase project set up

## 🚀 Deployment Steps (30 minutes)

### Step 1: Deploy Voice Bridge Service (15 min)

\`\`\`bash
cd services/whatsapp-voice-bridge

# Set environment variables
export OPENAI_API_KEY="sk-proj-YOUR_KEY_HERE"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_KEY_HERE"

# Install dependencies
pnpm install

# Build
pnpm build

# Deploy to Cloud Run
./deploy.sh

# ✅ Note the deployed URL (example):
# https://whatsapp-voice-bridge-xxxxxxx.run.app
\`\`\`

**Expected output:**
\`\`\`
✅ Deployment successful!
   URL: https://whatsapp-voice-bridge-xxxxxxx.run.app
\`\`\`

### Step 2: Configure Supabase (5 min)

\`\`\`bash
# Set Voice Bridge URL in Supabase
supabase secrets set VOICE_BRIDGE_URL="https://whatsapp-voice-bridge-xxxxxxx.run.app"

# Verify secrets are set
supabase secrets list
\`\`\`

### Step 3: Deploy Edge Function (5 min)

\`\`\`bash
supabase functions deploy wa-webhook-voice-calls
\`\`\`

### Step 4: Test (5 min)

Make a WhatsApp voice call to your business number and speak!

---

**Full Guide**: See [WHATSAPP_VOICE_DEPLOYMENT_GUIDE.md](./WHATSAPP_VOICE_DEPLOYMENT_GUIDE.md)
