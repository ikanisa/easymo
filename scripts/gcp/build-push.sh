#!/bin/bash
# Build and push Docker image to Google Artifact Registry
set -e

REGION=${REGION:-europe-west1}
PROJECT_ID=${PROJECT_ID:-easymoai}
REPO=${REPO:-easymo-repo}

SERVICE_NAME=$1
DOCKERFILE_PATH=$2

if [ -z "$SERVICE_NAME" ] || [ -z "$DOCKERFILE_PATH" ]; then
  echo "Usage: ./scripts/gcp/build-push.sh <service-name> <dockerfile-path>"
  echo ""
  echo "Examples:"
  echo "  ./scripts/gcp/build-push.sh admin admin-app/Dockerfile"
  echo "  ./scripts/gcp/build-push.sh agent-core services/agent-core/Dockerfile"
  echo ""
  exit 1
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}:latest"
IMAGE_SHA="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}:$(git rev-parse --short HEAD 2>/dev/null || echo 'local')"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Building ${SERVICE_NAME}..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Dockerfile: ${DOCKERFILE_PATH}"
echo "Image: ${IMAGE}"
echo "SHA Image: ${IMAGE_SHA}"
echo ""

docker build -f ${DOCKERFILE_PATH} -t ${IMAGE} -t ${IMAGE_SHA} .

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Pushing to Artifact Registry..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker push ${IMAGE}
docker push ${IMAGE_SHA}

echo ""
echo "✅ ${SERVICE_NAME} built and pushed successfully!"
echo ""
echo "Images:"
echo "  - ${IMAGE}"
echo "  - ${IMAGE_SHA}"
echo ""
echo "Next: Deploy with:"
echo "  gcloud run deploy easymo-${SERVICE_NAME} --image ${IMAGE} --region ${REGION}"
