#!/bin/bash
# Create all required secrets in Google Secret Manager
set -e

# Check for .env.secrets file
if [ ! -f .env.secrets ]; then
  echo "❌ Error: .env.secrets file not found"
  echo ""
  echo "Create .env.secrets with actual secret values:"
  echo ""
  cat << 'EOF'
# .env.secrets (DO NOT COMMIT)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
OPENAI_API_KEY=sk-proj-...
WHATSAPP_ACCESS_TOKEN=EAAJ...
WHATSAPP_VERIFY_TOKEN=verify-token-123
WHATSAPP_WEBHOOK_SECRET=webhook-secret
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6380
EOF
  echo ""
  exit 1
fi

source .env.secrets

PROJECT_ID=${PROJECT_ID:-easymoai}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Creating GCP Secrets..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project: ${PROJECT_ID}"
echo ""

# Create secrets (ignore errors if already exist)
create_secret() {
  local NAME=$1
  local VALUE=$2
  
  if [ -z "$VALUE" ]; then
    echo "⚠️  Skipping ${NAME} (not set in .env.secrets)"
    return
  fi
  
  echo "Creating secret: ${NAME}..."
  echo -n "$VALUE" | gcloud secrets create ${NAME} \
    --project=${PROJECT_ID} \
    --replication-policy="automatic" \
    --data-file=- 2>/dev/null \
    && echo "✅ Created ${NAME}" \
    || echo "⚠️  ${NAME} already exists (use versions add to update)"
}

create_secret "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
create_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"
create_secret "WHATSAPP_ACCESS_TOKEN" "$WHATSAPP_ACCESS_TOKEN"
create_secret "WHATSAPP_VERIFY_TOKEN" "$WHATSAPP_VERIFY_TOKEN"
create_secret "WHATSAPP_WEBHOOK_SECRET" "$WHATSAPP_WEBHOOK_SECRET"
create_secret "DATABASE_URL" "$DATABASE_URL"
create_secret "REDIS_URL" "$REDIS_URL"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Granting Cloud Run access to secrets..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get Cloud Run service account
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Service Account: ${SERVICE_ACCOUNT}"
echo ""

# Grant access to all secrets
for SECRET in SUPABASE_SERVICE_ROLE_KEY OPENAI_API_KEY WHATSAPP_ACCESS_TOKEN WHATSAPP_VERIFY_TOKEN WHATSAPP_WEBHOOK_SECRET DATABASE_URL REDIS_URL; do
  # Check if secret exists
  if gcloud secrets describe ${SECRET} --project=${PROJECT_ID} &>/dev/null; then
    echo "Granting access to ${SECRET}..."
    gcloud secrets add-iam-policy-binding ${SECRET} \
      --project=${PROJECT_ID} \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/secretmanager.secretAccessor" \
      --quiet
    echo "✅ Granted"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Secrets configured!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "View secrets:"
echo "  gcloud secrets list --project=${PROJECT_ID}"
echo ""
echo "Use in Cloud Run deployment:"
echo "  --set-secrets \"SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest\""
