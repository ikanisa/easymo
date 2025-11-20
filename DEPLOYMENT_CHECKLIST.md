# 🚀 EasyMo AI - Production Deployment Checklist

Use this checklist to deploy the EasyMo AI system to Google Cloud Platform.

---

## ✅ Pre-Deployment Checklist

### **1. Google Cloud Project Setup**
- [ ] Created GCP project (gen-lang-client-0738932886) or have access
- [ ] Billing enabled on the project
- [ ] `gcloud` CLI installed on your machine
- [ ] Authenticated: `gcloud auth login`
- [ ] Project set: `gcloud config set project gen-lang-client-0738932886`

### **2. API Keys & Credentials**
- [ ] WhatsApp Business account created
- [ ] WhatsApp access token obtained from Meta
- [ ] Phone Number ID noted: `561637583695258`
- [ ] Business Account ID noted: `552732297926796`
- [ ] Google Maps API key created (enable Places, Geocoding, Maps JS)
- [ ] (Optional) OpenAI API key for function calling
- [ ] (Optional) MTN SIP credentials for voice calls

### **3. Development Tools**
- [ ] `terraform` installed (>= 1.0)
- [ ] Docker installed (for local testing)
- [ ] `git` installed
- [ ] Python 3.11+ installed (for local testing)
- [ ] Node.js installed (for frontend)

---

## 🏗️ Infrastructure Deployment

### **Step 1: Enable Google Cloud APIs**
```bash
cd /Users/jeanbosco/workspace/easymoai
./backend/scripts/setup_gcp.sh
```

**Or manually:**
```bash
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

- [ ] APIs enabled successfully
- [ ] No errors in output

### **Step 2: Deploy Terraform Infrastructure**
```bash
cd backend/terraform
terraform init
terraform apply -var="project_id=gen-lang-client-0738932886" -var="region=us-central1"
```

**Verify outputs:**
- [ ] Firestore database created
- [ ] BigQuery dataset created
- [ ] Secret Manager secrets created
- [ ] Service account created
- [ ] Artifact Registry repository created

### **Step 3: Configure Secrets**
```bash
# WhatsApp Access Token
echo -n "YOUR_WHATSAPP_ACCESS_TOKEN" | \
  gcloud secrets versions add whatsapp_api_key --data-file=-

# Google Maps API Key
echo -n "YOUR_GOOGLE_MAPS_KEY" | \
  gcloud secrets versions add google-maps-api-key --data-file=-

# OpenAI API Key (optional)
echo -n "sk-YOUR_OPENAI_KEY" | \
  gcloud secrets versions add openai_api_key --data-file=-

# MTN SIP Credentials (optional)
echo -n "username:password" | \
  gcloud secrets versions add mtn_sip_creds --data-file=-
```

- [ ] All secrets added successfully
- [ ] Verify: `gcloud secrets list`

---

## 🐳 Service Deployment

### **Step 4: Build & Deploy Main Webhook**
```bash
cd backend/app

# Build Docker image
gcloud builds submit --tag gcr.io/gen-lang-client-0738932886/easymo-webhook

# Deploy to Cloud Run
gcloud run deploy easymo-webhook \
  --image gcr.io/gen-lang-client-0738932886/easymo-webhook \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT=gen-lang-client-0738932886,WHATSAPP_VERIFY_TOKEN=easymo_verify_token_secure_123 \
  --update-secrets=WHATSAPP_API_KEY=whatsapp_api_key:latest,OPENAI_API_KEY=openai_api_key:latest
```

- [ ] Build successful
- [ ] Deployment successful
- [ ] Service URL obtained: ___________________________________

**Test endpoint:**
```bash
curl https://easymo-webhook-[YOUR-ID].run.app/health
```
- [ ] Health check returns 200 OK

### **Step 5: Build & Deploy Admin API**
```bash
cd ../admin_api

gcloud builds submit --tag gcr.io/gen-lang-client-0738932886/easymo-admin-api

gcloud run deploy easymo-admin-api \
  --image gcr.io/gen-lang-client-0738932886/easymo-admin-api \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT_ID=gen-lang-client-0738932886
```

- [ ] Build successful
- [ ] Deployment successful
- [ ] Service URL obtained: ___________________________________

### **Step 6: Build & Deploy Business Indexer**
```bash
cd ../indexer

gcloud builds submit --tag gcr.io/gen-lang-client-0738932886/indexer-service

gcloud run deploy indexer-service \
  --image gcr.io/gen-lang-client-0738932886/indexer-service \
  --region us-central1 \
  --no-allow-unauthenticated \
  --set-env-vars=GCP_PROJECT_ID=gen-lang-client-0738932886 \
  --update-secrets=MAPS_API_KEY=google-maps-api-key:latest
```

- [ ] Build successful
- [ ] Deployment successful
- [ ] Service URL obtained: ___________________________________

### **Step 7: Build & Deploy Frontend (Optional)**
```bash
cd ../../..

gcloud builds submit --tag gcr.io/gen-lang-client-0738932886/easymo-frontend .

gcloud run deploy easymo-frontend \
  --image gcr.io/gen-lang-client-0738932886/easymo-frontend \
  --region us-central1 \
  --allow-unauthenticated
```

- [ ] Build successful
- [ ] Deployment successful
- [ ] Service URL obtained: ___________________________________

---

## 📱 WhatsApp Configuration

### **Step 8: Configure WhatsApp Webhook**

1. Go to Meta Developers Console
   - URL: https://developers.facebook.com/apps
   - [ ] Logged in

2. Select your app
   - [ ] App selected

3. Navigate to WhatsApp > Configuration
   - [ ] Configuration page open

4. Edit Webhook
   - **Callback URL**: `https://easymo-webhook-[YOUR-ID].run.app/webhook/whatsapp`
   - **Verify Token**: `easymo_verify_token_secure_123`
   - [ ] Webhook verified successfully

5. Subscribe to fields
   - [ ] `messages` field subscribed
   - [ ] Webhook active

**Test WhatsApp:**
```bash
# Send test message from your phone to the WhatsApp Business number
# Expected: AI agent responds
```
- [ ] Test message received
- [ ] AI response sent
- [ ] Message logged in Firestore

---

## 🗣️ Dialogflow CX Configuration

### **Step 9: Configure Dialogflow Webhook**

1. Go to Dialogflow CX Console
   - URL: https://dialogflow.cloud.google.com
   - [ ] Logged in

2. Create or select agent
   - [ ] Agent selected

3. Go to Manage > Webhooks
   - [ ] Webhooks page open

4. Create new webhook
   - **Display Name**: `EasymoLogic`
   - **Webhook URL**: `https://easymo-webhook-[YOUR-ID].run.app/webhook`
   - [ ] Webhook created

5. Build flows (reference: `backend/dialogflow/flow_map.md`)
   - [ ] Default Start Flow created
   - [ ] Gateway Page created
   - [ ] Conversation Loop Page created
   - [ ] End Session Page created
   - [ ] Webhook tags configured

**Test Voice Call:**
```bash
# Call the SIP number or test in simulator
```
- [ ] Call connects
- [ ] Agent responds
- [ ] Session logged in Firestore

---

## ✅ Verification & Testing

### **Step 10: Verify All Integrations**

**Run automated verification:**
```bash
cd /Users/jeanbosco/workspace/easymoai
./verify_implementation.sh
```
- [ ] All 28 checks passed

**Test WhatsApp flow:**
1. [ ] Send "Muraho" → Receives Kinyarwanda response
2. [ ] Send "Hello" → Receives English response
3. [ ] Ask about insurance → Receives relevant info
4. [ ] Request callback → Callback scheduled in Firestore

**Test Dialogflow:**
1. [ ] Initiate call → Opening greeting
2. [ ] Ask questions → Contextual responses
3. [ ] Request information → Tools executed
4. [ ] End call → Session finalized

**Check Firestore:**
```bash
# View collections in Firebase Console
https://console.firebase.google.com/project/gen-lang-client-0738932886/firestore
```
- [ ] `call_sessions` populated
- [ ] `whatsapp_messages` populated
- [ ] `leads` created (if applicable)

**Check BigQuery:**
```bash
# Query analytics
gcloud bigquery query --use_legacy_sql=false \
  'SELECT * FROM `gen-lang-client-0738932886.easymo_analytics.cold_call_logs` LIMIT 10'
```
- [ ] Analytics data present

**Check Cloud Run Logs:**
```bash
gcloud run logs read easymo-webhook --region=us-central1 --limit=50
```
- [ ] No error messages
- [ ] Requests logging correctly

---

## 📊 Monitoring & Alerts

### **Step 11: Set Up Monitoring**

**Cloud Monitoring:**
1. Go to Cloud Console > Monitoring
   - [ ] Monitoring workspace created

2. Create uptime checks
   - [ ] easymo-webhook health check
   - [ ] easymo-admin-api health check

3. Create alert policies
   - [ ] Alert on service errors (>5% error rate)
   - [ ] Alert on high latency (>2s p95)
   - [ ] Alert on service down

**Log-based metrics:**
```bash
# Create log-based metric for WhatsApp messages
# Metric name: whatsapp_messages_received
# Filter: resource.type="cloud_run_revision" AND jsonPayload.message="WhatsApp webhook received"
```
- [ ] Metrics created

---

## 🔒 Security Hardening

### **Step 12: Security Configuration**

**Cloud Run:**
- [ ] Review IAM permissions (least privilege)
- [ ] Enable Cloud Run ingress settings (if needed)
- [ ] Consider adding Cloud Armor for DDoS protection

**Secrets:**
- [ ] Review secret access logs
- [ ] Set up automatic secret rotation (60 days)
- [ ] Document secret recovery process

**Firestore:**
- [ ] Review security rules
- [ ] Enable audit logging
- [ ] Set up daily backups

**Rate Limiting:**
```python
# Consider adding to main.py
# from slowapi import Limiter
# limiter = Limiter(key_func=get_remote_address)
# @limiter.limit("100/minute")
```
- [ ] Rate limiting implemented (optional)

---

## 📝 Documentation

### **Step 13: Update Documentation**

**Record service URLs:**
```
Main Webhook:   _______________________________________
Admin API:      _______________________________________
Business Index: _______________________________________
Frontend:       _______________________________________
```

**Document access:**
- [ ] Service account emails recorded
- [ ] Project IAM reviewed
- [ ] Team access granted

**Create runbook:**
- [ ] Incident response procedures
- [ ] Common troubleshooting steps
- [ ] Escalation contacts

---

## 🎉 Go Live!

### **Step 14: Production Launch**

**Final checks:**
- [ ] All services deployed and healthy
- [ ] WhatsApp receiving and responding
- [ ] Dialogflow calls working
- [ ] Analytics flowing to BigQuery
- [ ] Monitoring and alerts active
- [ ] Team trained on system
- [ ] Support process defined

**Launch:**
- [ ] Enable WhatsApp Business number for customers
- [ ] Announce service availability
- [ ] Monitor closely for first 24 hours

---

## 🐛 Troubleshooting

### Common Issues

**WhatsApp webhook not verified:**
- Check verify token matches exactly
- Ensure Cloud Run allows unauthenticated requests
- View logs: `gcloud run logs read easymo-webhook`

**Messages not sending:**
- Verify access token in Secret Manager
- Check phone number approval status
- Review WhatsApp API error responses

**Dialogflow not responding:**
- Verify webhook URL is correct
- Check webhook tags match flow configuration
- Test webhook directly with curl

**Firestore not saving:**
- Check service account has datastore.user role
- Verify Firestore database exists
- Review Cloud Run logs for permission errors

**AI responses incorrect:**
- Check system instruction in main.py
- Verify conversation history is loading
- Test Gemini API directly

---

## 📞 Support Contacts

**Google Cloud Support:**
- Console: https://console.cloud.google.com/support
- Documentation: https://cloud.google.com/docs

**Meta/WhatsApp Support:**
- Developer Docs: https://developers.facebook.com/docs/whatsapp
- Support: https://business.facebook.com/business/help

**Internal Team:**
- DevOps: ___________________________
- Backend: __________________________
- AI/ML: ____________________________

---

## ✅ Deployment Complete!

**Date Completed**: _______________  
**Deployed By**: __________________  
**Production URL**: _______________

🎉 **Congratulations! EasyMo AI is now live in production.**

---

**Checklist Version**: 1.0  
**Last Updated**: November 20, 2025
