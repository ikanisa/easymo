#!/usr/bin/env bash

#================================================================
# EasyMo WhatsApp Services - Complete Deployment Script
#================================================================
# Purpose: Deploy all WhatsApp webhook services with --no-verify-jwt
# Date: 2025-11-28
# Project: easyMO (lhbowpbcpwoiparwnwgt)
#================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project reference
PROJECT_REF="lhbowpbcpwoiparwnwgt"

# Log function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

#================================================================
# WhatsApp Webhook Services
#================================================================
WA_SERVICES=(
    "wa-webhook-core"
    "wa-webhook-jobs"
    "wa-webhook-marketplace"
    "wa-webhook-property"
    "wa-webhook-mobility"
    "wa-webhook-ai-agents"
    "wa-webhook-insurance"
    "wa-webhook-profile"
    # "wa-webhook-unified" # DELETED
)

#================================================================
# Supporting Services
#================================================================
SUPPORTING_SERVICES=(
    "dlq-processor"
    "session-cleanup"
    "notification-worker"
    "agent-runner"
    "tool-contact-owner-whatsapp"
    "tool-notify-user"
)

#================================================================
# Function to deploy a service
#================================================================
deploy_service() {
    local service=$1
    local service_path="supabase/functions/$service"
    
    # Check if service exists
    if [ ! -d "$service_path" ]; then
        warning "Service $service not found at $service_path - skipping"
        return 1
    fi
    
    log "Deploying $service..."
    
    # Deploy with --no-verify-jwt flag
    if supabase functions deploy "$service" \
        --project-ref "$PROJECT_REF" \
        --no-verify-jwt; then
        success "$service deployed successfully"
        return 0
    else
        error "Failed to deploy $service"
        return 1
    fi
}

#================================================================
# Deploy WhatsApp Services
#================================================================
deploy_wa_services() {
    log "===== DEPLOYING WHATSAPP WEBHOOK SERVICES ====="
    
    local success_count=0
    local fail_count=0
    local skip_count=0
    
    for service in "${WA_SERVICES[@]}"; do
        if deploy_service "$service"; then
            ((success_count++))
        elif [ $? -eq 1 ]; then
            ((skip_count++))
        else
            ((fail_count++))
        fi
        echo ""
    done
    
    log "===== WHATSAPP SERVICES SUMMARY ====="
    success "Deployed: $success_count"
    if [ $skip_count -gt 0 ]; then
        warning "Skipped: $skip_count"
    fi
    if [ $fail_count -gt 0 ]; then
        error "Failed: $fail_count"
    fi
    echo ""
}

#================================================================
# Deploy Supporting Services
#================================================================
deploy_supporting_services() {
    log "===== DEPLOYING SUPPORTING SERVICES ====="
    
    local success_count=0
    local fail_count=0
    local skip_count=0
    
    for service in "${SUPPORTING_SERVICES[@]}"; do
        if deploy_service "$service"; then
            ((success_count++))
        elif [ $? -eq 1 ]; then
            ((skip_count++))
        else
            ((fail_count++))
        fi
        echo ""
    done
    
    log "===== SUPPORTING SERVICES SUMMARY ====="
    success "Deployed: $success_count"
    if [ $skip_count -gt 0 ]; then
        warning "Skipped: $skip_count"
    fi
    if [ $fail_count -gt 0 ]; then
        error "Failed: $fail_count"
    fi
    echo ""
}

#================================================================
# Deploy ALL Edge Functions with --no-verify-jwt
#================================================================
deploy_all_functions() {
    log "===== DEPLOYING ALL EDGE FUNCTIONS ====="
    warning "This will deploy ALL functions in supabase/functions/"
    
    local success_count=0
    local fail_count=0
    local skip_count=0
    
    # Find all function directories
    for service_path in supabase/functions/*/; do
        # Extract service name
        service=$(basename "$service_path")
        
        # Skip _shared and hidden directories
        if [[ "$service" == "_shared" ]] || [[ "$service" == .* ]]; then
            continue
        fi
        
        # Skip if no index.ts exists
        if [ ! -f "$service_path/index.ts" ]; then
            continue
        fi
        
        log "Deploying $service..."
        
        if supabase functions deploy "$service" \
            --project-ref "$PROJECT_REF" \
            --no-verify-jwt; then
            success "$service deployed"
            ((success_count++))
        else
            error "Failed: $service"
            ((fail_count++))
        fi
        echo ""
    done
    
    log "===== ALL FUNCTIONS DEPLOYMENT SUMMARY ====="
    success "Deployed: $success_count"
    if [ $fail_count -gt 0 ]; then
        error "Failed: $fail_count"
    fi
    echo ""
}

#================================================================
# Verify Deployments
#================================================================
verify_deployments() {
    log "===== VERIFYING DEPLOYMENTS ====="
    
    log "Fetching function list..."
    supabase functions list --project-ref "$PROJECT_REF"
    
    echo ""
    log "Checking WhatsApp services health..."
    
    # Test wa-webhook-core health endpoint
    log "Testing wa-webhook-core health endpoint..."
    if curl -s "https://$PROJECT_REF.supabase.co/functions/v1/wa-webhook-core/health" | grep -q "healthy"; then
        success "wa-webhook-core is healthy"
    else
        warning "wa-webhook-core health check failed or service not responding"
    fi
}

#================================================================
# Link to Project (if not already linked)
#================================================================
link_project() {
    log "Linking to project $PROJECT_REF..."
    
    if supabase link --project-ref "$PROJECT_REF"; then
        success "Linked to project"
    else
        warning "Failed to link (may already be linked)"
    fi
    echo ""
}

#================================================================
# Main Menu
#================================================================
show_menu() {
    echo ""
    echo "========================================"
    echo "   EasyMo Deployment Script"
    echo "========================================"
    echo "1. Deploy WhatsApp Services Only"
    echo "2. Deploy Supporting Services Only"
    echo "3. Deploy All Functions"
    echo "4. Verify Deployments"
    echo "5. Link to Project"
    echo "6. Exit"
    echo "========================================"
    echo ""
}

#================================================================
# Main Execution
#================================================================
main() {
    cd /Users/jeanbosco/workspace/easymo || exit 1
    
    log "EasyMo WhatsApp Services Deployment"
    log "Project: easyMO ($PROJECT_REF)"
    echo ""
    
    # Check if mode specified via command line argument
    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Select option: " choice
            
            case $choice in
                1)
                    link_project
                    deploy_wa_services
                    verify_deployments
                    ;;
                2)
                    link_project
                    deploy_supporting_services
                    verify_deployments
                    ;;
                3)
                    link_project
                    deploy_all_functions
                    verify_deployments
                    ;;
                4)
                    verify_deployments
                    ;;
                5)
                    link_project
                    ;;
                6)
                    log "Exiting..."
                    exit 0
                    ;;
                *)
                    error "Invalid option"
                    ;;
            esac
            
            echo ""
            read -p "Press Enter to continue..."
        done
    else
        # Command line mode
        case "$1" in
            whatsapp)
                link_project
                deploy_wa_services
                verify_deployments
                ;;
            supporting)
                link_project
                deploy_supporting_services
                verify_deployments
                ;;
            all)
                link_project
                deploy_all_functions
                verify_deployments
                ;;
            verify)
                verify_deployments
                ;;
            link)
                link_project
                ;;
            *)
                echo "Usage: $0 {whatsapp|supporting|all|verify|link}"
                echo ""
                echo "Options:"
                echo "  whatsapp    - Deploy WhatsApp webhook services only"
                echo "  supporting  - Deploy supporting services only"
                echo "  all         - Deploy all Edge Functions"
                echo "  verify      - Verify current deployments"
                echo "  link        - Link to project"
                exit 1
                ;;
        esac
    fi
}

# Run main function
main "$@"
