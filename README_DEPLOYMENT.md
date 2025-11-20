# 🎯 Quick Start - EasyMo AI Deployment

**Complete deployment in 15 minutes!**

## Prerequisites
- Google Cloud Project (easymo-478117)
- WhatsApp Business account with API access
- Google Maps API key

## 5-Step Deployment

### 1️⃣ Setup Infrastructure (5 min)
```bash
cd /Users/jeanbosco/workspace/easymoai
./backend/scripts/setup_gcp.sh
```

### 2️⃣ Configure Secrets (2 min)
```bash
echo -n "YOUR_WHATSAPP_TOKEN" | gcloud secrets versions add whatsapp_api_key --data-file=-
echo -n "YOUR_MAPS_KEY" | gcloud secrets versions add google-maps-api-key --data-file=-
```

### 3️⃣ Deploy Services (5 min)
```bash
# Main Webhook
cd backend/app
gcloud builds submit --tag gcr.io/easymo-478117/easymo-webhook
gcloud run deploy easymo-webhook --image gcr.io/easymo-478117/easymo-webhook \
  --region us-central1 --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT=easymo-478117,WHATSAPP_VERIFY_TOKEN=easymo_verify_token_secure_123 \
  --update-secrets=WHATSAPP_API_KEY=whatsapp_api_key:latest

# Admin API
cd ../admin_api
gcloud builds submit --tag gcr.io/easymo-478117/easymo-admin-api
gcloud run deploy easymo-admin-api --image gcr.io/easymo-478117/easymo-admin-api \
  --region us-central1 --allow-unauthenticated --set-env-vars=GCP_PROJECT_ID=easymo-478117
```

### 4️⃣ Configure WhatsApp (2 min)
1. Go to https://developers.facebook.com/apps
2. WhatsApp > Configuration > Edit Webhook
3. URL: `https://YOUR-CLOUD-RUN-URL/webhook/whatsapp`
4. Token: `easymo_verify_token_secure_123`
5. Subscribe to `messages`

### 5️⃣ Test (1 min)
Send a WhatsApp message to your business number:
```
You: Muraho
Bot: [Kinyarwanda response about EasyMo services]
```

## ✅ Verification
```bash
./verify_implementation.sh
# Should show: 🎉 All checks passed!
```

## 📚 Full Documentation
- Detailed guide: `DEPLOYMENT_CHECKLIST.md`
- WhatsApp setup: `WHATSAPP_SETUP.md`
- Complete status: `IMPLEMENTATION_STATUS.md`

## 🎉 Done!
Your EasyMo AI agent is now live and ready to handle customers!
