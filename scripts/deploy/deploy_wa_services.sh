#!/bin/bash
#
# WhatsApp Microservices Deployment Script
# Ensures all services are deployed with correct JWT settings
#
# Usage: ./deploy_wa_services.sh [service_name | all]
#

set -e  # Exit on error

PROJECT_REF="lhbowpbcpwoiparwnwgt"
SERVICES=(
    "wa-webhook-core"
    "wa-webhook-jobs"
    "wa-webhook-marketplace"
    "wa-webhook-property"
    "wa-webhook-mobility"
    "wa-webhook-ai-agents"
    "wa-webhook-buy-sell"
    "wa-webhook-profile"
)

# Deprecated services (skip)
DEPRECATED_SERVICES=(
    "wa-webhook"  # Replaced by wa-webhook-core
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if service exists
service_exists() {
    local service=$1
    if [ -d "supabase/functions/$service" ]; then
        return 0
    else
        return 1
    fi
}

# Verify function.json has verify_jwt: false
check_jwt_config() {
    local service=$1
    local config_file="supabase/functions/$service/function.json"
    
    if [ ! -f "$config_file" ]; then
        log_warn "$service: No function.json found, will use default (JWT disabled via --no-verify-jwt)"
        return 0
    fi
    
    if grep -q '"verify_jwt".*:.*false' "$config_file"; then
        log_info "$service: ✅ JWT verification correctly disabled"
        return 0
    else
        log_warn "$service: ⚠️  JWT verification not explicitly disabled in function.json"
        return 1
    fi
}

# Deploy a single service
deploy_service() {
    local service=$1
    
    log_info "========================================="
    log_info "Deploying: $service"
    log_info "========================================="
    
    if ! service_exists "$service"; then
        log_error "$service does not exist. Skipping."
        return 1
    fi
    
    # Check JWT config
    check_jwt_config "$service"
    
    # Deploy with --no-verify-jwt flag
    log_info "Deploying $service..."
    
    if supabase functions deploy "$service" \
        --project-ref "$PROJECT_REF" \
        --no-verify-jwt 2>&1; then
        log_info "✅ $service deployed successfully"
        return 0
    else
        log_error "❌ Failed to deploy $service"
        return 1
    fi
}

# Verify deployment
verify_deployment() {
    local service=$1
    
    log_info "Verifying $service..."
    
    if supabase functions list --project-ref "$PROJECT_REF" 2>&1 | grep -q "$service.*ACTIVE"; then
        log_info "✅ $service is ACTIVE"
        return 0
    else
        log_error "❌ $service is not active"
        return 1
    fi
}

# Main deployment logic
main() {
    local target_service="${1:-all}"
    
    log_info "WhatsApp Microservices Deployment"
    log_info "Project: $PROJECT_REF (easyMO)"
    log_info "Target: $target_service"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -d "supabase/functions" ]; then
        log_error "Not in the correct directory. Please run from workspace/easymo"
        exit 1
    fi
    
    local deployed=0
    local failed=0
    
    if [ "$target_service" = "all" ]; then
        log_info "Deploying all WhatsApp services..."
        echo ""
        
        for service in "${SERVICES[@]}"; do
            if deploy_service "$service"; then
                ((deployed++))
            else
                ((failed++))
            fi
            echo ""
        done
    else
        # Deploy single service
        if deploy_service "$target_service"; then
            ((deployed++))
        else
            ((failed++))
        fi
    fi
    
    # Summary
    echo ""
    log_info "========================================="
    log_info "Deployment Summary"
    log_info "========================================="
    log_info "Deployed: $deployed"
    log_error "Failed: $failed"
    
    if [ $failed -eq 0 ]; then
        log_info "✅ All deployments successful!"
        
        if [ "$target_service" = "all" ]; then
            echo ""
            log_info "Verifying deployments..."
            for service in "${SERVICES[@]}"; do
                verify_deployment "$service"
            done
        fi
    else
        log_error "⚠️  Some deployments failed. Check logs above."
        exit 1
    fi
}

# Show usage
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [service_name | all]"
    echo ""
    echo "Available services:"
    for service in "${SERVICES[@]}"; do
        echo "  - $service"
    done
    echo ""
    echo "Examples:"
    echo "  $0 all                    # Deploy all services"
    echo "  $0 wa-webhook-jobs        # Deploy single service"
    exit 0
fi

main "$@"
