#!/bin/bash
set -euo pipefail

# EasyMO Admin App - IAP Deployment Setup
# =========================================
# This script sets up Google Cloud infrastructure for deploying
# the admin app with Identity-Aware Proxy (IAP) for internal access only.

PROJECT_ID="${GCP_PROJECT_ID:-easymo-478117}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="admin-app-iap"
SERVICE_ACCOUNT="${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "========================================="
echo "EasyMO Admin App - IAP Setup"
echo "========================================="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Step 1: Enable required APIs
echo "📦 Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  compute.googleapis.com \
  iap.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  --project="${PROJECT_ID}" \
  --quiet

echo "✅ APIs enabled"

# Step 2: Create service account for Cloud Run
echo ""
echo "🔐 Creating service account..."
if gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "  Service account already exists: ${SERVICE_ACCOUNT}"
else
  gcloud iam service-accounts create "${SERVICE_NAME}-sa" \
    --display-name="Admin App IAP Service Account" \
    --description="Service account for admin-app with IAP access" \
    --project="${PROJECT_ID}"
  echo "✅ Service account created: ${SERVICE_ACCOUNT}"
fi

# Step 3: Grant necessary IAM roles
echo ""
echo "🔒 Granting IAM roles..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client" \
  --condition=None \
  --quiet

echo "✅ IAM roles granted"

# Step 4: Create secrets (if not exists)
echo ""
echo "🔑 Setting up Secret Manager..."

create_secret_if_not_exists() {
  local secret_name=$1
  local secret_description=$2
  
  if gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  Secret exists: ${secret_name}"
  else
    echo "  Creating secret: ${secret_name}"
    echo "PLACEHOLDER_UPDATE_ME" | gcloud secrets create "${secret_name}" \
      --data-file=- \
      --replication-policy="automatic" \
      --project="${PROJECT_ID}" \
      --labels=app=admin-app,environment=production
    echo "  ⚠️  Update secret value: gcloud secrets versions add ${secret_name} --data-file=-"
  fi
}

create_secret_if_not_exists "NEXT_PUBLIC_SUPABASE_URL" "Supabase project URL"
create_secret_if_not_exists "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Supabase anonymous key"
create_secret_if_not_exists "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key"
create_secret_if_not_exists "EASYMO_ADMIN_TOKEN" "Admin API token"
create_secret_if_not_exists "ADMIN_SESSION_SECRET" "Admin session secret (min 32 chars)"

echo "✅ Secrets configured"

# Step 5: Reserve static IP for Load Balancer
echo ""
echo "🌐 Reserving static IP address..."
if gcloud compute addresses describe admin-app-ip --global --project="${PROJECT_ID}" &>/dev/null; then
  STATIC_IP=$(gcloud compute addresses describe admin-app-ip --global --project="${PROJECT_ID}" --format="get(address)")
  echo "  Static IP already exists: ${STATIC_IP}"
else
  gcloud compute addresses create admin-app-ip \
    --global \
    --project="${PROJECT_ID}"
  STATIC_IP=$(gcloud compute addresses describe admin-app-ip --global --project="${PROJECT_ID}" --format="get(address)")
  echo "✅ Static IP reserved: ${STATIC_IP}"
fi

# Step 6: Create Network Endpoint Group (NEG) for Cloud Run
echo ""
echo "🔗 Creating Network Endpoint Group..."
if gcloud compute network-endpoint-groups describe admin-app-neg --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "  NEG already exists"
else
  # Note: NEG is created automatically when Cloud Run service is deployed
  # This is a placeholder - actual NEG creation happens after Cloud Run deployment
  echo "  NEG will be created automatically after Cloud Run deployment"
fi

# Step 7: Instructions for manual steps
echo ""
echo "========================================="
echo "✅ Infrastructure Setup Complete!"
echo "========================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Update Secret Manager secrets with real values:"
echo "   echo 'https://your-project.supabase.co' | gcloud secrets versions add NEXT_PUBLIC_SUPABASE_URL --data-file=-"
echo "   echo 'your-anon-key' | gcloud secrets versions add NEXT_PUBLIC_SUPABASE_ANON_KEY --data-file=-"
echo "   echo 'your-service-role-key' | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-"
echo "   echo 'your-admin-token' | gcloud secrets versions add EASYMO_ADMIN_TOKEN --data-file=-"
echo "   openssl rand -base64 32 | gcloud secrets versions add ADMIN_SESSION_SECRET --data-file=-"
echo ""
echo "2. Deploy Cloud Run service:"
echo "   cd admin-app"
echo "   gcloud builds submit --config=cloudbuild.iap.yaml --project=${PROJECT_ID}"
echo ""
echo "3. Configure Load Balancer + IAP (see: lb-iap-setup.sh)"
echo ""
echo "4. Add authorized users to IAP:"
echo "   gcloud iap web add-iam-policy-binding \\"
echo "     --member='user:admin@yourdomain.com' \\"
echo "     --role='roles/iap.httpsResourceAccessor' \\"
echo "     --project=${PROJECT_ID}"
echo ""
echo "Static IP: ${STATIC_IP}"
echo "Service Account: ${SERVICE_ACCOUNT}"
echo ""
