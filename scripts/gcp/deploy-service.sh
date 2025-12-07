#!/bin/bash
# Deploy service to Google Cloud Run
set -e

SERVICE_NAME=$1
IMAGE_NAME=$2
ALLOW_UNAUTH=${3:-false}
MEMORY=${4:-512Mi}
CPU=${5:-1}
MIN_INSTANCES=${6:-0}
MAX_INSTANCES=${7:-5}

if [ -z "$SERVICE_NAME" ] || [ -z "$IMAGE_NAME" ]; then
  echo "Usage: ./scripts/gcp/deploy-service.sh <service-name> <image-name> [allow-unauth] [memory] [cpu] [min] [max]"
  echo ""
  echo "Examples:"
  echo "  ./scripts/gcp/deploy-service.sh easymo-admin admin false 512Mi 1 0 5"
  echo "  ./scripts/gcp/deploy-service.sh easymo-client client true 512Mi 1 1 50"
  echo "  ./scripts/gcp/deploy-service.sh easymo-voice-bridge voice-bridge true 1Gi 2 1 10"
  echo ""
  exit 1
fi

REGION=${REGION:-europe-west1}
PROJECT_ID=${PROJECT_ID:-easymoai}
REPO=${REPO:-easymo-repo}

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE_NAME}:latest"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deploying ${SERVICE_NAME} to Cloud Run..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Image: ${IMAGE}"
echo "Region: ${REGION}"
echo "Allow Unauthenticated: ${ALLOW_UNAUTH}"
echo "Memory: ${MEMORY}, CPU: ${CPU}"
echo "Instances: ${MIN_INSTANCES} - ${MAX_INSTANCES}"
echo ""

gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated=${ALLOW_UNAUTH} \
  --memory ${MEMORY} \
  --cpu ${CPU} \
  --min-instances ${MIN_INSTANCES} \
  --max-instances ${MAX_INSTANCES} \
  --port 8080 \
  --timeout 300

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ${SERVICE_NAME} deployed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format="value(status.url)")
echo ""
echo "Service URL: ${SERVICE_URL}"
echo ""

if [ "${ALLOW_UNAUTH}" = "false" ]; then
  echo "⚠️  Service requires authentication. Enable IAP or add IAM members:"
  echo "   gcloud iap web add-iam-policy-binding \\"
  echo "     --resource-type=cloud-run \\"
  echo "     --service=${SERVICE_NAME} \\"
  echo "     --region=${REGION} \\"
  echo "     --member=\"user:EMAIL\" \\"
  echo "     --role=\"roles/iap.httpsResourceAccessor\""
fi
