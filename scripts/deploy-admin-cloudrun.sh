#!/usr/bin/env bash
# Deploy Admin App to Google Cloud Run (Internal-Only)
# Region: europe-west1
# Project: easymoai

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="easymoai"
REGION="europe-west1"
SERVICE_NAME="easymo-admin-app"
IMAGE_REPO="europe-west1-docker.pkg.dev/easymoai/easymo-repo/admin"
CLOUD_BUILD_CONFIG="cloudbuild.admin.deploy.yaml"

# Required secrets in Secret Manager
REQUIRED_SECRETS=(
  "supabase-service-role"
  "easymo-admin-token"
  "admin-session-secret"
)

# Functions
print_step() {
  echo -e "${BLUE}==>${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

check_prerequisites() {
  print_step "Checking prerequisites..."
  
  # Check gcloud
  if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi
  print_success "gcloud CLI found"
  
  # Check current project
  CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
  if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    print_warning "Current project is '$CURRENT_PROJECT', switching to '$PROJECT_ID'"
    gcloud config set project "$PROJECT_ID"
  fi
  print_success "GCP project: $PROJECT_ID"
  
  # Check authentication
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    print_error "Not authenticated. Run: gcloud auth login"
    exit 1
  fi
  print_success "Authenticated"
}

check_secrets() {
  print_step "Verifying Secret Manager secrets..."
  
  local missing_secrets=()
  for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" --project="$PROJECT_ID" &> /dev/null; then
      missing_secrets+=("$secret")
    else
      print_success "Secret exists: $secret"
    fi
  done
  
  if [ ${#missing_secrets[@]} -gt 0 ]; then
    print_error "Missing secrets: ${missing_secrets[*]}"
    echo ""
    echo "Create secrets with:"
    for secret in "${missing_secrets[@]}"; do
      echo "  echo -n 'your-secret-value' | gcloud secrets create $secret --data-file=- --project=$PROJECT_ID"
    done
    exit 1
  fi
  
  print_success "All required secrets exist"
}

check_apis() {
  print_step "Checking required APIs..."
  
  local required_apis=(
    "cloudbuild.googleapis.com"
    "run.googleapis.com"
    "artifactregistry.googleapis.com"
    "secretmanager.googleapis.com"
  )
  
  local missing_apis=()
  for api in "${required_apis[@]}"; do
    if ! gcloud services list --enabled --project="$PROJECT_ID" --filter="name:$api" --format="value(name)" | grep -q "$api"; then
      missing_apis+=("$api")
    else
      print_success "API enabled: $api"
    fi
  done
  
  if [ ${#missing_apis[@]} -gt 0 ]; then
    print_warning "Enabling missing APIs: ${missing_apis[*]}"
    gcloud services enable "${missing_apis[@]}" --project="$PROJECT_ID"
    print_success "APIs enabled"
  fi
}

get_env_vars() {
  print_step "Environment variables needed for deployment:"
  echo ""
  
  # Check if env vars are provided
  if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
    print_warning "Environment variables not set. Please provide:"
    echo ""
    read -rp "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
    read -rp "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
    echo ""
  fi
  
  if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    print_error "Missing required environment variables"
    exit 1
  fi
  
  print_success "Environment variables configured"
}

build_and_deploy() {
  print_step "Building and deploying via Cloud Build..."
  echo ""
  
  gcloud builds submit \
    --config="$CLOUD_BUILD_CONFIG" \
    --substitutions="_SUPABASE_URL=$SUPABASE_URL,_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
    --project="$PROJECT_ID" \
    --region="$REGION"
  
  print_success "Build and deployment complete"
}

verify_deployment() {
  print_step "Verifying deployment..."
  
  # Get service URL
  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null || echo "")
  
  if [ -z "$SERVICE_URL" ]; then
    print_error "Service not found"
    exit 1
  fi
  
  print_success "Service deployed: $SERVICE_URL"
  
  # Check IAM policy
  AUTH_POLICY=$(gcloud run services get-iam-policy "$SERVICE_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(bindings.role)" 2>/dev/null || echo "")
  
  if echo "$AUTH_POLICY" | grep -q "roles/run.invoker.*allUsers"; then
    print_warning "Service is publicly accessible! This should be internal-only."
    echo "Run: gcloud run services remove-iam-policy-binding $SERVICE_NAME --region=$REGION --member=allUsers --role=roles/run.invoker"
  else
    print_success "Service is internal-only (no public access)"
  fi
}

print_summary() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  print_success "Admin App Deployment Complete"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Service:        $SERVICE_NAME"
  echo "Project:        $PROJECT_ID"
  echo "Region:         $REGION"
  echo "Image:          $IMAGE_REPO:latest"
  echo ""
  echo "View service:"
  echo "  gcloud run services describe $SERVICE_NAME --region=$REGION"
  echo ""
  echo "View logs:"
  echo "  gcloud run services logs tail $SERVICE_NAME --region=$REGION"
  echo ""
  echo "Configure IAP (Identity-Aware Proxy) for access control:"
  echo "  https://console.cloud.google.com/security/iap?project=$PROJECT_ID"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Main execution
main() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " EasyMO Admin App - Cloud Run Deployment"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  check_prerequisites
  check_apis
  check_secrets
  get_env_vars
  build_and_deploy
  verify_deployment
  print_summary
}

# Run
main "$@"
