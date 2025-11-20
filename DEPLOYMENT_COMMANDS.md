# EasyMo Full Stack Deployment Commands

Copy and paste these commands into your terminal (Cloud Shell recommended).

## 1. Setup Environment Variables
```bash
export PROJECT_ID="easymo-478117"
export REGION="us-central1"
export WHATSAPP_TOKEN="easymo_verify_token_secure_123"

# Authenticate and Set Project
gcloud auth login
gcloud config set project $PROJECT_ID
```

## 2. Enable Required APIs
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

## 3. Infrastructure (Terraform)
```bash
cd backend/terraform

# Initialize Terraform
terraform init

# Apply Infrastructure (Type 'yes' when prompted)
terraform apply \
  -var="project_id=$PROJECT_ID" \
  -var="region=$REGION"

cd ../..
```

## 4. Configure Secrets
Replace the placeholder values with your actual API keys.
```bash
# OpenAI API Key (for tools)
echo -n "sk-YOUR_OPENAI_KEY" | gcloud secrets versions add openai_api_key --data-file=-

# Google Maps API Key (for Business Directory Indexer)
echo -n "YOUR_GOOGLE_MAPS_KEY" | gcloud secrets versions add google-maps-api-key --data-file=-

# WhatsApp API Key (System User Token from Meta)
echo -n "YOUR_WHATSAPP_ACCESS_TOKEN" | gcloud secrets versions add whatsapp_api_key --data-file=-

# MTN SIP Credentials (Format: username:password)
echo -n "admin:password123" | gcloud secrets versions add mtn_sip_creds --data-file=-
```

## 5. Deploy Backend Services

### A. Indexer Service (Google Maps Scraper)
```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/indexer-service backend/indexer

gcloud run deploy indexer-service \
  --image gcr.io/$PROJECT_ID/indexer-service \
  --region $REGION \
  --platform managed \
  --no-allow-unauthenticated \
  --update-secrets=MAPS_API_KEY=google-maps-api-key:latest
```

### B. Admin API (Dashboard Backend)
```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/admin-api backend/admin_api

gcloud run deploy admin-api \
  --image gcr.io/$PROJECT_ID/admin-api \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT_ID=$PROJECT_ID
```

### C. Core Webhook (Dialogflow & WhatsApp)
```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/easymo-webhook backend/app

gcloud run deploy easymo-webhook \
  --image gcr.io/$PROJECT_ID/easymo-webhook \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT=$PROJECT_ID,WHATSAPP_VERIFY_TOKEN=$WHATSAPP_TOKEN \
  --update-secrets=OPENAI_API_KEY=openai_api_key:latest,WHATSAPP_API_KEY=whatsapp_api_key:latest
```

**IMPORTANT:** Copy the URL of `easymo-webhook` (e.g., `https://easymo-webhook-xyz.run.app`).
- **Dialogflow Webhook URL:** `https://[URL]/webhook`
- **WhatsApp Callback URL:** `https://[URL]/webhook/whatsapp`

## 6. Deploy Frontend (React PWA)

```bash
# Build the Docker image
gcloud builds submit --tag gcr.io/$PROJECT_ID/easymo-frontend .

# Deploy to Cloud Run
gcloud run deploy easymo-frontend \
  --image gcr.io/$PROJECT_ID/easymo-frontend \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated
```

## 7. Post-Deployment Configuration

1.  **Meta Developers Console:**
    *   Go to **WhatsApp** > **Configuration**.
    *   Edit Webhook.
    *   **Callback URL:** Paste the `easymo-webhook` URL appended with `/webhook/whatsapp`.
    *   **Verify Token:** `easymo_verify_token_secure_123`
    *   Subscribe to `messages` field.

2.  **Dialogflow CX:**
    *   Go to **Manage** > **Webhooks**.
    *   Update the webhook URL to the `easymo-webhook` URL appended with `/webhook`.

3.  **Frontend:**
    *   Open the `easymo-frontend` URL in your browser.
    *   The Dashboard and Agent Manager should now be live.
