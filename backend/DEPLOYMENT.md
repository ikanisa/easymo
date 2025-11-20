# Deployment Guide: EasyMo Cold Caller AI Agent

This guide connects the Terraform infrastructure, Python backend, and Dialogflow CX agent.

## Prerequisites
1.  Google Cloud Project with Billing Enabled (**Project ID: easymo-478117**).
2.  `gcloud` CLI installed and authenticated.
3.  `terraform` installed.
4.  An MTN SIP Trunk account (credentials).

## Phase 1: Infrastructure (Terraform)

1.  Navigate to the terraform directory:
    ```bash
    cd backend/terraform
    ```
2.  Initialize and apply:
    ```bash
    terraform init
    terraform apply -var="project_id=easymo-478117" -var="region=us-central1"
    ```
    *This will create the Cloud Run service, Firestore DB, Service Accounts, and Secret Manager entries.*

## Phase 2: Secrets Management

1.  Store your API keys in Google Secret Manager:
    ```bash
    # OpenAI API Key (for function calling tool)
    echo -n "sk-..." | gcloud secrets versions add openai_api_key --project=easymo-478117 --data-file=-

    # MTN SIP Credentials (if needed by webhook, otherwise configured in Dialogflow Gateway)
    echo -n "user:pass" | gcloud secrets versions add mtn_sip_creds --project=easymo-478117 --data-file=-
    ```

## Phase 3: Deploy Backend (Cloud Run)

1.  Build and Deploy the Main Webhook:
    ```bash
    cd backend/app
    gcloud builds submit --tag gcr.io/easymo-478117/easymo-webhook --project=easymo-478117
    gcloud run deploy easymo-webhook \
        --image gcr.io/easymo-478117/easymo-webhook \
        --platform managed \
        --region us-central1 \
        --project=easymo-478117 \
        --allow-unauthenticated # Secure this via Dialogflow settings in prod
    ```
2.  **Copy the Service URL** returned (e.g., `https://easymo-webhook-xyz.a.run.app`).

## Phase 4: Dialogflow CX Configuration

1.  **Create Agent:** Go to Dialogflow CX Console -> Create Agent -> Select "Vertex AI Conversation" or standard "Chat/Voice".
2.  **Webhooks:**
    *   Go to **Manage** -> **Webhooks**.
    *   Create new webhook: `EasymoLogic`.
    *   URL: `[YOUR_CLOUD_RUN_URL]/webhook` (from Phase 3).
3.  **Import Flow:**
    *   Use the structure defined in `backend/dialogflow/flow_map.md` to build the pages.
    *   Set the **Default Start Flow** to trigger the `EasymoLogic` webhook on entry.
4.  **Telephony:**
    *   Go to **Manage** -> **Integrations** -> **Avaya / AudioCodes / Genesys** (depending on how MTN SIP connects).
    *   Or use **Dialogflow Gateway** for direct SIP trunking.

## Phase 5: Admin Panel

1.  Deploy the Admin API:
    ```bash
    cd backend/admin_api
    gcloud run deploy easymo-admin-api \
        --source . \
        --region us-central1 \
        --project=easymo-478117
    ```
2.  Connect the React Frontend:
    *   Update the frontend `config` to point to the Admin API URL for dashboard data.
    *   In `components/Dashboard.tsx`, replace mock data fetch with `fetch('/analytics/call_summary')`.

## Validation

1.  **Test Call:** Call the SIP number provisioned.
2.  **Monitor:**
    *   Check Cloud Run logs for "Received Request".
    *   Check Firestore `call_sessions` for the new document.
    *   After the call, check BigQuery `easymo_analytics.cold_call_logs` for the record.