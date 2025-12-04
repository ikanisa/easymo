#!/bin/bash
set -euo pipefail

# EasyMO Admin App - Secret Configuration
# ========================================
# This script configures all required secrets in Secret Manager

PROJECT_ID="${GCP_PROJECT_ID:-easymo-478117}"

echo "========================================="
echo "Configuring Secrets"
echo "========================================="
echo "Project: ${PROJECT_ID}"
echo ""

# Supabase configuration (extracted from DB URL)
DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
SUPABASE_PROJECT_ID="lhbowpbcpwoiparwnwgt"
SUPABASE_URL="https://${SUPABASE_PROJECT_ID}.supabase.co"

# Service role key (PAT provided)
SERVICE_ROLE_KEY="sbp_500607f0d078e919aa24f179473291544003a035"

echo "📋 Detected Configuration:"
echo "  Supabase URL: ${SUPABASE_URL}"
echo "  Project ID: ${SUPABASE_PROJECT_ID}"
echo ""

# Function to create or update secret
upsert_secret() {
  local secret_name=$1
  local secret_value=$2
  
  if gcloud secrets describe "${secret_name}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "  Updating secret: ${secret_name}"
    echo -n "${secret_value}" | gcloud secrets versions add "${secret_name}" \
      --data-file=- \
      --project="${PROJECT_ID}"
  else
    echo "  Creating secret: ${secret_name}"
    echo -n "${secret_value}" | gcloud secrets create "${secret_name}" \
      --data-file=- \
      --replication-policy="automatic" \
      --project="${PROJECT_ID}" \
      --labels=app=admin-app,environment=production
  fi
}

echo "🔑 Configuring secrets..."
echo ""

# 1. Supabase URL (public)
upsert_secret "NEXT_PUBLIC_SUPABASE_URL" "${SUPABASE_URL}"

# 2. Supabase Anon Key (you'll need to get this from Supabase dashboard)
echo ""
echo "⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY required!"
echo "   Get it from: ${SUPABASE_URL}/project/default/settings/api"
echo "   Enter the 'anon public' key:"
read -r ANON_KEY
if [ -n "${ANON_KEY}" ]; then
  upsert_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${ANON_KEY}"
else
  echo "  Skipping NEXT_PUBLIC_SUPABASE_ANON_KEY (you must set it later)"
fi

# 3. Service Role Key
echo ""
upsert_secret "SUPABASE_SERVICE_ROLE_KEY" "${SERVICE_ROLE_KEY}"

# 4. Admin Token
echo ""
echo "Enter EASYMO_ADMIN_TOKEN (or press Enter to auto-generate):"
read -r ADMIN_TOKEN
if [ -z "${ADMIN_TOKEN}" ]; then
  ADMIN_TOKEN=$(openssl rand -hex 32)
  echo "  Generated: ${ADMIN_TOKEN}"
fi
upsert_secret "EASYMO_ADMIN_TOKEN" "${ADMIN_TOKEN}"

# 5. Session Secret
echo ""
SESSION_SECRET=$(openssl rand -base64 32)
echo "  Generating random session secret..."
upsert_secret "ADMIN_SESSION_SECRET" "${SESSION_SECRET}"

echo ""
echo "========================================="
echo "✅ Secrets Configured!"
echo "========================================="
echo ""
echo "Next step: Deploy the application"
echo "  cd ../../admin-app"
echo "  gcloud builds submit --config=cloudbuild.iap.yaml --project=${PROJECT_ID}"
echo ""
