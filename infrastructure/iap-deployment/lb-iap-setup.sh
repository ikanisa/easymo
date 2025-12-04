#!/bin/bash
set -euo pipefail

# EasyMO Admin App - Load Balancer + IAP Configuration
# =====================================================
# This script creates an HTTPS Load Balancer with IAP in front of Cloud Run

PROJECT_ID="${GCP_PROJECT_ID:-easymo-478117}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="admin-app-iap"
STATIC_IP_NAME="admin-app-ip"
NEG_NAME="admin-app-neg"
BACKEND_SERVICE_NAME="admin-app-backend"
URL_MAP_NAME="admin-app-url-map"
TARGET_PROXY_NAME="admin-app-https-proxy"
FORWARDING_RULE_NAME="admin-app-https-forwarding-rule"
SSL_CERT_NAME="admin-app-ssl-cert"

echo "========================================="
echo "Load Balancer + IAP Setup"
echo "========================================="
echo "Project: ${PROJECT_ID}"
echo ""

# Verify Cloud Run service exists
echo "🔍 Verifying Cloud Run service..."
if ! gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "❌ Error: Cloud Run service '${SERVICE_NAME}' not found in region '${REGION}'"
  echo "   Deploy the service first: gcloud builds submit --config=cloudbuild.iap.yaml"
  exit 1
fi
echo "✅ Cloud Run service found"

# Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")
echo "   Service URL: ${SERVICE_URL}"

# Step 1: Create serverless NEG
echo ""
echo "🔗 Creating Serverless Network Endpoint Group..."
if gcloud compute network-endpoint-groups describe "${NEG_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" &>/dev/null; then
  echo "  NEG already exists: ${NEG_NAME}"
else
  gcloud compute network-endpoint-groups create "${NEG_NAME}" \
    --region="${REGION}" \
    --network-endpoint-type=serverless \
    --cloud-run-service="${SERVICE_NAME}" \
    --project="${PROJECT_ID}"
  echo "✅ NEG created: ${NEG_NAME}"
fi

# Step 2: Create backend service
echo ""
echo "🔧 Creating backend service..."
if gcloud compute backend-services describe "${BACKEND_SERVICE_NAME}" \
  --global \
  --project="${PROJECT_ID}" &>/dev/null; then
  echo "  Backend service already exists: ${BACKEND_SERVICE_NAME}"
else
  gcloud compute backend-services create "${BACKEND_SERVICE_NAME}" \
    --global \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --protocol=HTTPS \
    --project="${PROJECT_ID}"
  
  gcloud compute backend-services add-backend "${BACKEND_SERVICE_NAME}" \
    --global \
    --network-endpoint-group="${NEG_NAME}" \
    --network-endpoint-group-region="${REGION}" \
    --project="${PROJECT_ID}"
  
  echo "✅ Backend service created: ${BACKEND_SERVICE_NAME}"
fi

# Step 3: Enable IAP on backend service
echo ""
echo "🔐 Enabling IAP on backend service..."
gcloud compute backend-services update "${BACKEND_SERVICE_NAME}" \
  --global \
  --iap=enabled \
  --project="${PROJECT_ID}" || true  # May fail if OAuth not configured yet

echo "  ⚠️  Configure OAuth consent screen:"
echo "     https://console.cloud.google.com/apis/credentials/consent?project=${PROJECT_ID}"
echo ""

# Step 4: Create URL map
echo ""
echo "🗺️  Creating URL map..."
if gcloud compute url-maps describe "${URL_MAP_NAME}" \
  --global \
  --project="${PROJECT_ID}" &>/dev/null; then
  echo "  URL map already exists: ${URL_MAP_NAME}"
else
  gcloud compute url-maps create "${URL_MAP_NAME}" \
    --default-service="${BACKEND_SERVICE_NAME}" \
    --global \
    --project="${PROJECT_ID}"
  echo "✅ URL map created: ${URL_MAP_NAME}"
fi

# Step 5: Create managed SSL certificate
echo ""
echo "🔒 Creating managed SSL certificate..."
echo "   Enter your domain (e.g., admin.easymo.com):"
read -r DOMAIN

if gcloud compute ssl-certificates describe "${SSL_CERT_NAME}" \
  --global \
  --project="${PROJECT_ID}" &>/dev/null; then
  echo "  SSL certificate already exists: ${SSL_CERT_NAME}"
else
  gcloud compute ssl-certificates create "${SSL_CERT_NAME}" \
    --domains="${DOMAIN}" \
    --global \
    --project="${PROJECT_ID}"
  echo "✅ SSL certificate created for: ${DOMAIN}"
  echo "   ⚠️  Certificate provisioning may take 15-60 minutes"
fi

# Step 6: Create HTTPS target proxy
echo ""
echo "🎯 Creating HTTPS target proxy..."
if gcloud compute target-https-proxies describe "${TARGET_PROXY_NAME}" \
  --global \
  --project="${PROJECT_ID}" &>/dev/null; then
  echo "  Target proxy already exists: ${TARGET_PROXY_NAME}"
else
  gcloud compute target-https-proxies create "${TARGET_PROXY_NAME}" \
    --ssl-certificates="${SSL_CERT_NAME}" \
    --url-map="${URL_MAP_NAME}" \
    --global \
    --project="${PROJECT_ID}"
  echo "✅ Target proxy created: ${TARGET_PROXY_NAME}"
fi

# Step 7: Create forwarding rule
echo ""
echo "📡 Creating global forwarding rule..."
STATIC_IP=$(gcloud compute addresses describe "${STATIC_IP_NAME}" \
  --global \
  --project="${PROJECT_ID}" \
  --format="get(address)")

if gcloud compute forwarding-rules describe "${FORWARDING_RULE_NAME}" \
  --global \
  --project="${PROJECT_ID}" &>/dev/null; then
  echo "  Forwarding rule already exists: ${FORWARDING_RULE_NAME}"
else
  gcloud compute forwarding-rules create "${FORWARDING_RULE_NAME}" \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --network-tier=PREMIUM \
    --address="${STATIC_IP_NAME}" \
    --target-https-proxy="${TARGET_PROXY_NAME}" \
    --ports=443 \
    --global \
    --project="${PROJECT_ID}"
  echo "✅ Forwarding rule created: ${FORWARDING_RULE_NAME}"
fi

# Final instructions
echo ""
echo "========================================="
echo "✅ Load Balancer + IAP Setup Complete!"
echo "========================================="
echo ""
echo "📋 DNS Configuration:"
echo "   Add an A record for ${DOMAIN} pointing to: ${STATIC_IP}"
echo ""
echo "🔐 IAP Configuration:"
echo "   1. Configure OAuth consent screen:"
echo "      https://console.cloud.google.com/apis/credentials/consent?project=${PROJECT_ID}"
echo ""
echo "   2. Enable IAP:"
echo "      https://console.cloud.google.com/security/iap?project=${PROJECT_ID}"
echo ""
echo "   3. Add authorized users:"
echo "      gcloud iap web add-iam-policy-binding \\"
echo "        --resource-type=backend-services \\"
echo "        --service=${BACKEND_SERVICE_NAME} \\"
echo "        --member='user:admin@yourdomain.com' \\"
echo "        --role='roles/iap.httpsResourceAccessor' \\"
echo "        --project=${PROJECT_ID}"
echo ""
echo "🌐 Access URL: https://${DOMAIN}"
echo "   (after DNS propagation and SSL certificate provisioning)"
echo ""
