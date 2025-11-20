# 🚀 Deploy EasyMo AI to Your Firebase Project NOW

## ⚡ Quick Deploy (15 minutes)

Follow these steps to get your **REAL webhook URLs**.

---

## Step 1: Authenticate with Your Firebase Project

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project gen-lang-client-0738932886

# Verify it's set
gcloud config get-value project
# Should show: gen-lang-client-0738932886
```

---

## Step 2: Enable Required APIs (2 minutes)

```bash
cd /Users/jeanbosco/workspace/easymoai

# Enable all required APIs
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  bigquery.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  dialogflow.googleapis.com \
  artifactregistry.googleapis.com
```

---

## Step 3: Create Firestore Database (1 minute)

**Option A: Via Console**
1. Go to: https://console.firebase.google.com/project/gen-lang-client-0738932886/firestore
2. Click "Create database"
3. Select "Production mode"
4. Choose location: `us-central1`
5. Click "Enable"

**Option B: Via Command Line**
```bash
gcloud firestore databases create --location=us-central1 --project=gen-lang-client-0738932886
```

---

## Step 4: Add Your API Keys to Secret Manager (2 minutes)

### Get Your WhatsApp Access Token:
1. Go to: https://developers.facebook.com/apps
2. Select your app
3. WhatsApp > API Setup
4. Copy the "Temporary access token" or create a permanent one

### Add to Secret Manager:
```bash
# WhatsApp Access Token (REQUIRED)
echo -n "YOUR_ACTUAL_WHATSAPP_TOKEN_HERE" | \
  gcloud secrets create whatsapp_api_key \
  --data-file=- \
  --project=gen-lang-client-0738932886

# Google Maps API Key (OPTIONAL but recommended)
echo -n "YOUR_GOOGLE_MAPS_API_KEY" | \
  gcloud secrets create google-maps-api-key \
  --data-file=- \
  --project=gen-lang-client-0738932886

# OpenAI API Key (OPTIONAL)
echo -n "sk-YOUR_OPENAI_KEY" | \
  gcloud secrets create openai_api_key \
  --data-file=- \
  --project=gen-lang-client-0738932886
```

---

## Step 5: Deploy Main Webhook Service (5 minutes)

This will create your **REAL webhook URLs**!

```bash
cd /Users/jeanbosco/workspace/easymoai/backend/app

# Build the Docker image
gcloud builds submit \
  --tag gcr.io/gen-lang-client-0738932886/easymo-webhook \
  --project=gen-lang-client-0738932886

# Deploy to Cloud Run
gcloud run deploy easymo-webhook \
  --image gcr.io/gen-lang-client-0738932886/easymo-webhook \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --project=gen-lang-client-0738932886 \
  --set-env-vars=GCP_PROJECT=gen-lang-client-0738932886,WHATSAPP_VERIFY_TOKEN=easymo_verify_token_secure_123 \
  --update-secrets=WHATSAPP_API_KEY=whatsapp_api_key:latest,OPENAI_API_KEY=openai_api_key:latest
```

**After deployment, you'll see:**
```
Service URL: https://easymo-webhook-XXXXX-uc.a.run.app
```

**SAVE THIS URL!** This is your actual webhook URL.

---

## Step 6: Get Your WhatsApp Webhook URL

Your WhatsApp webhook URL will be:
```
https://easymo-webhook-XXXXX-uc.a.run.app/webhook/whatsapp
```

Replace `XXXXX` with the value from Step 5.

---

## Step 7: Configure WhatsApp Webhook (2 minutes)

1. Go to: https://developers.facebook.com/apps
2. Select your app
3. WhatsApp > Configuration
4. Click "Edit" on Callback URL
5. Enter:
   - **Callback URL**: `https://easymo-webhook-XXXXX-uc.a.run.app/webhook/whatsapp`
   - **Verify Token**: `easymo_verify_token_secure_123`
6. Click "Verify and Save"
7. Subscribe to "messages" field

---

## Step 8: Test Your WhatsApp Integration

Send a message to your WhatsApp Business number:

```
You: Hello
Bot: [Should respond with a message about EasyMo services]
```

Check logs:
```bash
gcloud run logs read easymo-webhook \
  --region=us-central1 \
  --project=gen-lang-client-0738932886 \
  --limit=50
```

---

## Step 9: Check Firestore Collections (Verify Data)

Go to: https://console.firebase.google.com/project/gen-lang-client-0738932886/firestore

You should see these collections being created automatically:

1. ✅ **call_sessions** - When messages are received
2. ✅ **whatsapp_messages** - All WhatsApp messages
3. ✅ **leads** - When leads are created
4. ✅ **callbacks** - When callbacks are scheduled
5. ✅ **agents** - AI agent configurations
6. ✅ **businesses** - Google Maps data (after indexing)
7. ✅ **brochure_queue** - Pending brochure sends

**Collections are created automatically when first data is written. They won't exist until you send your first WhatsApp message!**

---

## Step 10: Deploy Admin API (Optional - 3 minutes)

```bash
cd /Users/jeanbosco/workspace/easymoai/backend/admin_api

gcloud builds submit \
  --tag gcr.io/gen-lang-client-0738932886/easymo-admin-api \
  --project=gen-lang-client-0738932886

gcloud run deploy easymo-admin-api \
  --image gcr.io/gen-lang-client-0738932886/easymo-admin-api \
  --region us-central1 \
  --allow-unauthenticated \
  --project=gen-lang-client-0738932886 \
  --set-env-vars=GCP_PROJECT_ID=gen-lang-client-0738932886
```

You'll get an Admin API URL for analytics:
```
https://easymo-admin-api-XXXXX-uc.a.run.app
```

Test it:
```bash
curl https://easymo-admin-api-XXXXX-uc.a.run.app/analytics/whatsapp
```

---

## ✅ Verification Checklist

After deployment, verify everything:

- [ ] Main webhook deployed and URL obtained
- [ ] WhatsApp webhook configured in Meta console
- [ ] Test WhatsApp message sent and received response
- [ ] Firestore collections created (check after first message)
- [ ] Cloud Run logs show successful requests
- [ ] Admin API deployed (optional)

---

## 🔗 Your Actual URLs (Fill in after deployment)

```
Main Webhook:
https://easymo-webhook-________________-uc.a.run.app

WhatsApp Webhook:
https://easymo-webhook-________________-uc.a.run.app/webhook/whatsapp

Dialogflow Webhook:
https://easymo-webhook-________________-uc.a.run.app/webhook

Admin API:
https://easymo-admin-api-________________-uc.a.run.app
```

---

## 🆘 Troubleshooting

### Build fails:
```bash
# Check Cloud Build is enabled
gcloud services list --enabled --project=gen-lang-client-0738932886 | grep cloudbuild
```

### Deployment fails:
```bash
# Check Cloud Run is enabled
gcloud services list --enabled --project=gen-lang-client-0738932886 | grep run
```

### WhatsApp webhook verification fails:
```bash
# Test the endpoint manually
curl "https://YOUR-URL/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=easymo_verify_token_secure_123&hub.challenge=test123"
# Should return: test123
```

### No Firestore collections:
- **Normal!** Collections are created on first write
- Send a WhatsApp message first
- Then check Firestore console

---

## 📊 Expected Costs

With Firebase Spark (Free tier):
- Cloud Run: First 2 million requests/month FREE
- Firestore: First 1GB storage + 50k reads/day FREE
- Cloud Build: First 120 build-minutes/day FREE

You should stay in FREE tier for testing and low traffic.

---

**Ready? Run Step 1 now!** 🚀
