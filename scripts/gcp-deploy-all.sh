#!/bin/bash
# ============================================================================
# GCP Deploy All Services - easyMO
# ============================================================================
# Automates the complete deployment of easyMO services to Google Cloud Run
# 
# Prerequisites:
# - gcloud CLI installed and authenticated
# - Project ID: easymoai
# - Artifact Registry repository created
# - Required secrets in Secret Manager
#
# Usage:
#   ./scripts/gcp-deploy-all.sh [--phase PHASE_NUMBER]
#   ./scripts/gcp-deploy-all.sh --phase 1  # Deploy Phase 1 only
#   ./scripts/gcp-deploy-all.sh            # Deploy all phases
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# ============================================================================
# Configuration
# ============================================================================
PROJECT_ID="${GCP_PROJECT_ID:-easymoai}"
REGION="${GCP_REGION:-europe-west1}"
REGISTRY="${REGION}-docker.pkg.dev"
REPO_NAME="easymo-repo"
REGISTRY_URL="${REGISTRY}/${PROJECT_ID}/${REPO_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

log_error() {
    echo -e "${RED}❌ ${1}${NC}"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  ${1}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ============================================================================
# Preflight Checks
# ============================================================================

preflight_checks() {
    log_section "Preflight Checks"
    
    # Check gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    log_success "gcloud CLI installed"
    
    # Check authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
        log_error "Not authenticated with gcloud. Run: gcloud auth login"
        exit 1
    fi
    log_success "Authenticated with gcloud"
    
    # Set project
    gcloud config set project "${PROJECT_ID}" --quiet
    log_success "Project set to: ${PROJECT_ID}"
    
    # Check Docker authentication
    if ! gcloud auth configure-docker "${REGISTRY}" --quiet; then
        log_error "Failed to configure Docker authentication"
        exit 1
    fi
    log_success "Docker authenticated to Artifact Registry"
    
    # Check if Artifact Registry exists
    if ! gcloud artifacts repositories describe "${REPO_NAME}" \
         --location="${REGION}" &> /dev/null; then
        log_warning "Artifact Registry repository not found. Creating..."
        gcloud artifacts repositories create "${REPO_NAME}" \
            --repository-format=docker \
            --location="${REGION}" \
            --description="Docker images for easyMO services"
        log_success "Artifact Registry repository created"
    else
        log_success "Artifact Registry repository exists"
    fi
}

# ============================================================================
# Enable Required APIs
# ============================================================================

enable_apis() {
    log_section "Enabling Required GCP APIs"
    
    local apis=(
        "artifactregistry.googleapis.com"
        "cloudbuild.googleapis.com"
        "run.googleapis.com"
        "iap.googleapis.com"
        "secretmanager.googleapis.com"
        "logging.googleapis.com"
        "monitoring.googleapis.com"
    )
    
    for api in "${apis[@]}"; do
        log_info "Enabling ${api}..."
        gcloud services enable "${api}" --quiet
    done
    
    log_success "All required APIs enabled"
}

# ============================================================================
# Build and Push Image
# ============================================================================

build_and_push() {
    local service_name=$1
    local dockerfile_path=$2
    local context_dir=${3:-'.'}
    
    log_info "Building ${service_name}..."
    
    # Check if git is available and we're in a git repository
    local git_sha=""
    if command -v git &> /dev/null && git rev-parse --git-dir &> /dev/null 2>&1; then
        git_sha=$(git rev-parse --short HEAD)
    else
        git_sha="latest"
        log_warning "Git not available or not in a git repository. Using 'latest' as tag."
    fi
    
    local image_tag="${REGISTRY_URL}/${service_name}:latest"
    local sha_tag="${REGISTRY_URL}/${service_name}:${git_sha}"
    
    # Build using Cloud Build (faster, cached)
    if gcloud builds submit \
        --tag "${sha_tag}" \
        --dockerfile "${dockerfile_path}" \
        "${context_dir}" \
        --quiet; then
        
        # Tag as latest (if different from sha tag)
        if [ "${sha_tag}" != "${image_tag}" ]; then
            if ! gcloud artifacts docker tags add \
                "${sha_tag}" \
                "${image_tag}" \
                --quiet 2>/dev/null; then
                log_warning "Failed to tag ${service_name} as latest, but build succeeded"
            fi
        fi
        
        log_success "Built and pushed: ${service_name}"
        echo "${image_tag}"
    else
        log_error "Failed to build ${service_name}"
        return 1
    fi
}

# ============================================================================
# Deploy to Cloud Run
# ============================================================================

deploy_to_cloud_run() {
    local service_name=$1
    local image_url=$2
    shift 2
    local extra_args=("$@")
    
    log_info "Deploying ${service_name} to Cloud Run..."
    
    if gcloud run deploy "${service_name}" \
        --image "${image_url}" \
        --region "${REGION}" \
        --platform managed \
        --quiet \
        "${extra_args[@]}"; then
        
        local service_url=$(gcloud run services describe "${service_name}" \
            --region="${REGION}" \
            --format="value(status.url)")
        
        log_success "Deployed: ${service_name}"
        log_info "URL: ${service_url}"
        echo "${service_url}"
    else
        log_error "Failed to deploy ${service_name}"
        return 1
    fi
}

# ============================================================================
# Phase 1: Core Services
# ============================================================================

deploy_phase1() {
    log_section "Phase 1: Core Services (Admin, Voice, Vendor)"
    
    # 1. Admin PWA
    log_info "Deploying Admin PWA..."
    local admin_image=$(build_and_push "admin" "admin-app/Dockerfile" "admin-app")
    deploy_to_cloud_run "easymo-admin" "${admin_image}" \
        --allow-unauthenticated=false \
        --memory 1Gi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10 \
        --port 3000 \
        --timeout 300 \
        --set-env-vars "NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1"
    
    # 2. Voice Bridge
    log_info "Deploying Voice Bridge..."
    local voice_bridge_image=$(build_and_push "voice-bridge" "services/whatsapp-voice-bridge/Dockerfile" "services/whatsapp-voice-bridge")
    deploy_to_cloud_run "easymo-voice-bridge" "${voice_bridge_image}" \
        --allow-unauthenticated \
        --memory 512Mi \
        --cpu 1 \
        --timeout 300 \
        --concurrency 80 \
        --min-instances 0 \
        --max-instances 10 \
        --port 8080 \
        --set-env-vars "NODE_ENV=production,LOG_LEVEL=info,OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview"
    
    # 3. Voice Gateway
    log_info "Deploying Voice Gateway..."
    local voice_gateway_image=$(build_and_push "voice-gateway" "services/voice-gateway/Dockerfile" "services/voice-gateway")
    deploy_to_cloud_run "easymo-voice-gateway" "${voice_gateway_image}" \
        --allow-unauthenticated \
        --memory 512Mi \
        --cpu 1 \
        --timeout 300 \
        --concurrency 50 \
        --min-instances 0 \
        --max-instances 10 \
        --port 8080 \
        --set-env-vars "NODE_ENV=production"
    
    # 4. Vendor Service
    log_info "Deploying Vendor Service..."
    local vendor_service_image=$(build_and_push "vendor-service" "services/vendor-service/Dockerfile" "services/vendor-service")
    deploy_to_cloud_run "easymo-vendor-service" "${vendor_service_image}" \
        --allow-unauthenticated \
        --memory 256Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 5 \
        --port 8080 \
        --set-env-vars "NODE_ENV=production"
    
    log_success "Phase 1 deployment complete!"
}

# ============================================================================
# Phase 2: Voice & Media Services
# ============================================================================

deploy_phase2() {
    log_section "Phase 2: Voice & Media Services"
    
    # Check if Dockerfiles exist before deploying
    local services=(
        "voice-media-server:services/voice-media-server/Dockerfile"
        "voice-media-bridge:services/voice-media-bridge/Dockerfile"
        "webrtc-media-bridge:services/webrtc-media-bridge/Dockerfile"
    )
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service_name dockerfile <<< "${service_info}"
        
        if [[ -f "${dockerfile}" ]]; then
            log_info "Deploying ${service_name}..."
            local service_dir=$(dirname "${dockerfile}")
            local image=$(build_and_push "${service_name}" "${dockerfile}" "${service_dir}")
            deploy_to_cloud_run "easymo-${service_name}" "${image}" \
                --allow-unauthenticated \
                --memory 512Mi \
                --cpu 1 \
                --min-instances 0 \
                --max-instances 10 \
                --port 8080 \
                --set-env-vars "NODE_ENV=production"
        else
            log_warning "Dockerfile not found: ${dockerfile} - Skipping ${service_name}"
        fi
    done
    
    log_success "Phase 2 deployment complete!"
}

# ============================================================================
# Phase 3: Supporting Services
# ============================================================================

deploy_phase3() {
    log_section "Phase 3: Supporting Services (Orchestrators, Workers)"
    
    local services=(
        "mobility-orchestrator:services/mobility-orchestrator/Dockerfile"
        "ranking-service:services/ranking-service/Dockerfile"
        "wallet-service:services/wallet-service/Dockerfile"
        "buyer-service:services/buyer-service/Dockerfile"
        "profile:services/profile/Dockerfile"
        "tracking-service:services/tracking-service/Dockerfile"
        "attribution-service:services/attribution-service/Dockerfile"
        "broker-orchestrator:services/broker-orchestrator/Dockerfile"
        "video-orchestrator:services/video-orchestrator/Dockerfile"
    )
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service_name dockerfile <<< "${service_info}"
        
        if [[ -f "${dockerfile}" ]]; then
            log_info "Deploying ${service_name}..."
            local service_dir=$(dirname "${dockerfile}")
            local image=$(build_and_push "${service_name}" "${dockerfile}" "${service_dir}")
            deploy_to_cloud_run "easymo-${service_name}" "${image}" \
                --allow-unauthenticated \
                --memory 256Mi \
                --cpu 1 \
                --min-instances 0 \
                --max-instances 5 \
                --port 8080 \
                --set-env-vars "NODE_ENV=production"
        else
            log_warning "Dockerfile not found: ${dockerfile} - Skipping ${service_name}"
        fi
    done
    
    log_success "Phase 3 deployment complete!"
}

# ============================================================================
# Print Summary
# ============================================================================

print_summary() {
    log_section "Deployment Summary"
    
    log_info "Listing all easymo Cloud Run services..."
    gcloud run services list \
        --region="${REGION}" \
        --filter="metadata.name:easymo-*" \
        --format="table(metadata.name,status.url,status.conditions[0].status)"
    
    echo ""
    log_success "Deployment complete! 🎉"
    echo ""
    log_info "Next steps:"
    echo "  1. Configure IAP for admin and vendor services"
    echo "  2. Add authorized users to IAP"
    echo "  3. Set up monitoring and alerts"
    echo "  4. Update environment variables and secrets"
    echo ""
    log_info "Documentation: docs/gcp/README.md"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    local phase=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --phase)
                phase="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [--phase PHASE_NUMBER]"
                echo ""
                echo "Options:"
                echo "  --phase 1    Deploy Phase 1 only (Core Services)"
                echo "  --phase 2    Deploy Phase 2 only (Voice & Media)"
                echo "  --phase 3    Deploy Phase 3 only (Supporting Services)"
                echo "  --help       Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0                # Deploy all phases"
                echo "  $0 --phase 1      # Deploy Phase 1 only"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Run with --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Banner
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  easyMO - Google Cloud Run Deployment Automation    ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Run preflight checks
    preflight_checks
    enable_apis
    
    # Deploy based on phase
    if [[ -z "${phase}" ]]; then
        # Deploy all phases
        deploy_phase1
        deploy_phase2
        deploy_phase3
    else
        case "${phase}" in
            1)
                deploy_phase1
                ;;
            2)
                deploy_phase2
                ;;
            3)
                deploy_phase3
                ;;
            *)
                log_error "Invalid phase: ${phase}. Must be 1, 2, or 3"
                exit 1
                ;;
        esac
    fi
    
    # Print summary
    print_summary
}

# Run main function
main "$@"
