#!/bin/bash
# Complete GCP Deployment Script for EasyMO Services
# Deploys all services to Google Cloud Run

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
export PROJECT_ID="${GCP_PROJECT_ID:-easymoai}"
export REGION="${GCP_REGION:-europe-west1}"
export REPO_NAME="easymo-repo"
export IMAGE_BASE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME"

echo -e "${BLUE}🚀 EasyMO Google Cloud Run Deployment${NC}"
echo "======================================"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Registry: $IMAGE_BASE"
echo ""

# Check gcloud authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null 2>&1; then
  echo -e "${RED}❌ Not authenticated to Google Cloud${NC}"
  echo "Run: gcloud auth login"
  exit 1
fi

echo -e "${GREEN}✅ Authenticated to Google Cloud${NC}"

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo ""
echo -e "${BLUE}📋 Enabling required APIs...${NC}"
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  iap.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

echo -e "${GREEN}✅ APIs enabled${NC}"

# Create Artifact Registry repo if not exists
echo ""
echo -e "${BLUE}📦 Setting up Artifact Registry...${NC}"
if gcloud artifacts repositories describe $REPO_NAME --location=$REGION > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Repository '$REPO_NAME' already exists${NC}"
else
  gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker images for easyMO services"
  echo -e "${GREEN}✅ Repository '$REPO_NAME' created${NC}"
fi

# Configure Docker auth
echo ""
echo -e "${BLUE}🔐 Configuring Docker authentication...${NC}"
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet
echo -e "${GREEN}✅ Docker authenticated${NC}"

# Function to build and deploy
deploy_service() {
  local SERVICE_NAME=$1
  local SERVICE_DIR=$2
  local IMAGE_NAME=$3
  local PORT=$4
  local MEMORY=$5
  local CPU=$6
  local MAX_INSTANCES=$7
  local ALLOW_UNAUTH=$8
  local EXTRA_ARGS="${9:-}"

  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}🏗️  Building and deploying: $SERVICE_NAME${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
  
  cd "$SERVICE_DIR"
  
  # Build and push
  echo "Building Docker image..."
  gcloud builds submit --tag $IMAGE_BASE/$IMAGE_NAME:latest --quiet
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image built successfully${NC}"
  else
    echo -e "${RED}❌ Image build failed${NC}"
    return 1
  fi
  
  # Deploy to Cloud Run
  echo "Deploying to Cloud Run..."
  gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_BASE/$IMAGE_NAME:latest \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated=$ALLOW_UNAUTH \
    --memory $MEMORY \
    --cpu $CPU \
    --min-instances 0 \
    --max-instances $MAX_INSTANCES \
    --port $PORT \
    --set-env-vars "NODE_ENV=production" \
    $EXTRA_ARGS \
    --quiet
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ $SERVICE_NAME deployed successfully${NC}"
  else
    echo -e "${RED}❌ $SERVICE_NAME deployment failed${NC}"
    return 1
  fi
  
  cd - > /dev/null
}

# Deploy services
REPO_ROOT=$(pwd)

# 1. Admin PWA
deploy_service \
  "easymo-admin" \
  "$REPO_ROOT/admin-app" \
  "admin" \
  "3000" \
  "1Gi" \
  "1" \
  "10" \
  "false" \
  "--set-env-vars NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co"

# 2. Voice Bridge  
deploy_service \
  "easymo-voice-bridge" \
  "$REPO_ROOT/services/whatsapp-voice-bridge" \
  "voice-bridge" \
  "8080" \
  "512Mi" \
  "1" \
  "10" \
  "true" \
  "--timeout 300 --concurrency 80 --set-env-vars LOG_LEVEL=info,OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview,SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co"

# 3. Voice Gateway
deploy_service \
  "easymo-voice-gateway" \
  "$REPO_ROOT/services/voice-gateway" \
  "voice-gateway" \
  "8080" \
  "512Mi" \
  "1" \
  "10" \
  "true" \
  "--timeout 300 --concurrency 50 --set-env-vars SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co"

# 4. Vendor Service
deploy_service \
  "easymo-vendor-service" \
  "$REPO_ROOT/services/vendor-service" \
  "vendor-service" \
  "8080" \
  "256Mi" \
  "1" \
  "5" \
  "true" \
  "--set-env-vars SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co"

# Print service URLs
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""
echo "Service URLs:"
echo "============="
gcloud run services list --region $REGION --format="table(SERVICE:label=Service,URL:label=URL,LAST_DEPLOYED:label=Deployed)"

echo ""
echo -e "${YELLOW}⚠️  Next Steps:${NC}"
echo "1. Configure IAP for Admin Portal:"
echo "   - Go to: https://console.cloud.google.com/security/iap?project=$PROJECT_ID"
echo "   - Enable IAP for easymo-admin"
echo "   - Add authorized users/groups"
echo ""
echo "2. Set up secrets in Secret Manager:"
echo "   gcloud secrets create openai-api-key --replication-policy=automatic"
echo "   echo -n 'sk-...' | gcloud secrets versions add openai-api-key --data-file=-"
echo ""
echo "3. Update service environment variables with secrets:"
echo "   gcloud run services update easymo-voice-bridge \\"
echo "     --update-secrets OPENAI_API_KEY=openai-api-key:latest \\"
echo "     --region $REGION"
echo ""
echo "4. Test each service endpoint"
echo ""
echo -e "${GREEN}🎉 All services deployed successfully!${NC}"
