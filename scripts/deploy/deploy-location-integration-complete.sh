#!/usr/bin/env bash
#
# Complete Location Integration Deployment Script
# Deploys all remaining location integration components
#
# Usage:
#   ./deploy-location-integration-complete.sh [phase]
#
# Phases:
#   phase1  - AI Agents migration (1.5h)
#   phase2  - Cache integrations (2.5h)
#   phase3  - Unified service (1h)
#   all     - Deploy everything (default)
#

set -euo pipefail

# Configuration
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-}"
PHASE="${1:-all}"

# Colors
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

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v supabase &> /dev/null; then
        log_error "Supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
        exit 1
    fi
    
    if [ -z "$SUPABASE_PROJECT_ID" ]; then
        log_warn "SUPABASE_PROJECT_ID not set. Will use linked project."
    fi
    
    log_info "Prerequisites OK"
}

deploy_phase1_ai_agents() {
    log_info "========================================="
    log_info "PHASE 1: Core WhatsApp Migration"
    log_info "========================================="
    
    log_info "Deploying core WhatsApp function..."
    
    # Deploy wa-webhook-core Edge Function
    if [ -d "supabase/functions/wa-webhook-core" ]; then
        supabase functions deploy wa-webhook-core \
            --project-ref "$SUPABASE_PROJECT_ID" \
            --no-verify-jwt
        log_info "✅ Core WhatsApp function deployed"
    else
        log_warn "⚠️ wa-webhook-core directory not found"
    fi
    
    log_info "Phase 1 deployment complete!"
    log_info "Phase 1 deployment complete (wa-webhook-ai-agents removed)!"
}

deploy_phase2_cache_integrations() {
    log_info "========================================="
    log_info "PHASE 2: Cache Integrations"
    log_info "========================================="
    
    # Deploy Profile service
    if [ -d "supabase/functions/wa-webhook-profile" ]; then
        log_info "Deploying wa-webhook-profile..."
        supabase functions deploy wa-webhook-profile \
            --project-ref "$SUPABASE_PROJECT_ID" \
            --no-verify-jwt
        log_info "✅ Profile function deployed"
    else
        log_warn "⚠️ wa-webhook-profile directory not found"
    fi
    
    # Deploy Property service
    if [ -d "supabase/functions/wa-webhook-property" ]; then
        log_info "Deploying wa-webhook-property..."
        supabase functions deploy wa-webhook-property \
            --project-ref "$SUPABASE_PROJECT_ID" \
            --no-verify-jwt
        log_info "✅ Property function deployed"
    else
        log_warn "⚠️ wa-webhook-property directory not found"
    fi
    
    # Deploy Marketplace service
    if [ -d "supabase/functions/wa-webhook-marketplace" ]; then
        log_info "Deploying wa-webhook-marketplace..."
        supabase functions deploy wa-webhook-marketplace \
            --project-ref "$SUPABASE_PROJECT_ID" \
            --no-verify-jwt
        log_info "✅ Marketplace function deployed"
    else
        log_warn "⚠️ wa-webhook-marketplace directory not found"
    fi
    
    log_info "Phase 2 deployment complete!"
}

deploy_phase3_unified() {
    log_info "========================================="
    log_info "PHASE 3: Unified Service Cache"
    log_info "========================================="
    
    if [ -d "supabase/functions/wa-webhook-unified" ]; then
        log_info "Deploying wa-webhook-unified..."
        supabase functions deploy wa-webhook-unified \
            --project-ref "$SUPABASE_PROJECT_ID" \
            --no-verify-jwt
        log_info "✅ Unified function deployed"
    else
        log_warn "⚠️ wa-webhook-unified directory not found"
    fi
    
    log_info "Phase 3 deployment complete!"
}

deploy_migrations() {
    log_info "========================================="
    log_info "Deploying Database Migrations"
    log_info "========================================="
    
    if [ -d "supabase/migrations" ]; then
        log_info "Pushing migrations to database..."
        supabase db push --project-ref "$SUPABASE_PROJECT_ID"
        log_info "✅ Migrations applied"
    else
        log_warn "⚠️ Migrations directory not found"
    fi
}

verify_deployment() {
    log_info "========================================="
    log_info "Verifying Deployment"
    log_info "========================================="
    
    log_info "Checking deployed functions..."
    supabase functions list --project-ref "$SUPABASE_PROJECT_ID" || true
    
    log_info "Checking database..."
    log_info "Run verification queries manually or use test scripts"
}

main() {
    log_info "Location Integration Complete Deployment"
    log_info "Phase: $PHASE"
    echo ""
    
    check_prerequisites
    
    case "$PHASE" in
        phase1)
            deploy_migrations
            deploy_phase1_ai_agents
            ;;
        phase2)
            deploy_migrations
            deploy_phase2_cache_integrations
            ;;
        phase3)
            deploy_migrations
            deploy_phase3_unified
            ;;
        all)
            deploy_migrations
            deploy_phase1_ai_agents
            deploy_phase2_cache_integrations
            deploy_phase3_unified
            ;;
        *)
            log_error "Unknown phase: $PHASE"
            log_error "Valid phases: phase1, phase2, phase3, all"
            exit 1
            ;;
    esac
    
    verify_deployment
    
    echo ""
    log_info "========================================="
    log_info "✅ DEPLOYMENT COMPLETE"
    log_info "========================================="
    log_info "Next steps:"
    log_info "1. Test location sharing via WhatsApp"
    log_info "2. Verify GPS searches work"
    log_info "3. Check cache is being saved/read"
    log_info "4. Monitor logs for errors"
}

main "$@"
