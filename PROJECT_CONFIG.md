# 🎯 EasyMo AI - Project Configuration

## ✅ **Your Firebase/GCP Project Details**

### **Project Information**
- **Project Name**: easyMO
- **Project ID**: `gen-lang-client-0738932886`
- **Project Number**: `30164297098`
- **Environment**: Production
- **Support Email**: info@ikanisa.com

### **WhatsApp Business API**
- **Phone Number ID**: `561637583695258`
- **Business Account ID**: `552732297926796`
- **Verification Token**: `easymo_verify_token_secure_123`

---

## 📋 **Quick Configuration Checklist**

All code has been updated to use **your actual project**:

### ✅ Updated Files:
- [x] `backend/app/main.py` → Project ID updated
- [x] `backend/admin_api/main.py` → Project ID updated
- [x] `backend/indexer/main.py` → Project ID updated
- [x] `backend/terraform/main.tf` → Project ID updated
- [x] `backend/scripts/setup_gcp.sh` → Project ID updated
- [x] All documentation files → Project ID updated
- [x] `.env.example` → Complete project details

---

## 🚀 **Deployment Commands (Updated for Your Project)**

### **1. Authenticate with Your Project**
```bash
gcloud auth login
gcloud config set project gen-lang-client-0738932886
```

### **2. Enable Required APIs**
```bash
cd /Users/jeanbosco/workspace/easymoai
./backend/scripts/setup_gcp.sh
```

### **3. Deploy Infrastructure**
```bash
cd backend/terraform
terraform init
terraform apply -var="project_id=gen-lang-client-0738932886" -var="region=us-central1"
```

### **4. Configure Secrets**
```bash
# WhatsApp Access Token
echo -n "YOUR_WHATSAPP_TOKEN" | \
  gcloud secrets versions add whatsapp_api_key \
  --project=gen-lang-client-0738932886 \
  --data-file=-

# Google Maps API Key
echo -n "YOUR_MAPS_KEY" | \
  gcloud secrets versions add google-maps-api-key \
  --project=gen-lang-client-0738932886 \
  --data-file=-
```

### **5. Deploy Main Webhook**
```bash
cd backend/app

gcloud builds submit \
  --tag gcr.io/gen-lang-client-0738932886/easymo-webhook \
  --project=gen-lang-client-0738932886

gcloud run deploy easymo-webhook \
  --image gcr.io/gen-lang-client-0738932886/easymo-webhook \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --project=gen-lang-client-0738932886 \
  --set-env-vars=GCP_PROJECT=gen-lang-client-0738932886,WHATSAPP_VERIFY_TOKEN=easymo_verify_token_secure_123 \
  --update-secrets=WHATSAPP_API_KEY=whatsapp_api_key:latest,OPENAI_API_KEY=openai_api_key:latest
```

### **6. Deploy Admin API**
```bash
cd ../admin_api

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

### **7. Deploy Business Indexer**
```bash
cd ../indexer

gcloud builds submit \
  --tag gcr.io/gen-lang-client-0738932886/indexer-service \
  --project=gen-lang-client-0738932886

gcloud run deploy indexer-service \
  --image gcr.io/gen-lang-client-0738932886/indexer-service \
  --region us-central1 \
  --no-allow-unauthenticated \
  --project=gen-lang-client-0738932886 \
  --update-secrets=MAPS_API_KEY=google-maps-api-key:latest
```

---

## 🔗 **Your Project URLs**

### **Firebase Console**
```
https://console.firebase.google.com/project/gen-lang-client-0738932886
```

### **Google Cloud Console**
```
https://console.cloud.google.com/home/dashboard?project=gen-lang-client-0738932886
```

### **Firestore Database**
```
https://console.firebase.google.com/project/gen-lang-client-0738932886/firestore
```

### **Secret Manager**
```
https://console.cloud.google.com/security/secret-manager?project=gen-lang-client-0738932886
```

### **Cloud Run Services**
```
https://console.cloud.google.com/run?project=gen-lang-client-0738932886
```

### **BigQuery**
```
https://console.cloud.google.com/bigquery?project=gen-lang-client-0738932886
```

---

## 📊 **Service Endpoints (After Deployment)**

Once deployed, your services will be available at:

```
Main Webhook:   https://easymo-webhook-[HASH]-uc.a.run.app
Admin API:      https://easymo-admin-api-[HASH]-uc.a.run.app  
Indexer:        https://indexer-service-[HASH]-uc.a.run.app
```

**WhatsApp Webhook URL:**
```
https://easymo-webhook-[HASH]-uc.a.run.app/webhook/whatsapp
```

**Dialogflow Webhook URL:**
```
https://easymo-webhook-[HASH]-uc.a.run.app/webhook
```

---

## ✅ **Verification**

Check that everything is configured correctly:

```bash
cd /Users/jeanbosco/workspace/easymoai

# Run verification script
./verify_implementation.sh

# Check project ID in files
grep -r "gen-lang-client-0738932886" backend/app/main.py
```

Expected output: `PROJECT_ID = os.getenv("GCP_PROJECT", "gen-lang-client-0738932886")`

---

## 📝 **Next Steps**

1. ✅ **Project Updated** - All files now use your Firebase project
2. 🔑 **Get API Keys** - WhatsApp token, Google Maps key
3. 🚀 **Deploy** - Follow deployment commands above
4. 🧪 **Test** - Send WhatsApp message to verify

---

**Project**: easyMO  
**Project ID**: gen-lang-client-0738932886  
**Support**: info@ikanisa.com  
**Updated**: November 20, 2025
