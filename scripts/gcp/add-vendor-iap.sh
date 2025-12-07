#!/bin/bash
# Add user to IAP for Vendor Portal
set -e

VENDOR_EMAIL=$1

if [ -z "$VENDOR_EMAIL" ]; then
  echo "Usage: ./scripts/gcp/add-vendor-iap.sh vendor@gmail.com"
  exit 1
fi

REGION=${REGION:-europe-west1}
SERVICE=${SERVICE:-easymo-vendor}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Adding ${VENDOR_EMAIL} to Vendor Portal IAP..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=${SERVICE} \
  --region=${REGION} \
  --member="user:${VENDOR_EMAIL}" \
  --role="roles/iap.httpsResourceAccessor"

SERVICE_URL=$(gcloud run services describe ${SERVICE} --region ${REGION} --format="value(status.url)")

echo ""
echo "✅ ${VENDOR_EMAIL} can now access Vendor Portal"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Send onboarding email:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Subject: Welcome to easyMO Vendor Portal"
echo ""
echo "Hi [Vendor Name],"
echo ""
echo "Your vendor account is ready!"
echo ""
echo "1. Visit: ${SERVICE_URL}"
echo "2. Sign in with: ${VENDOR_EMAIL}"
echo "3. Complete your business profile"
echo ""
echo "Support: support@easymo.rw"
echo ""
