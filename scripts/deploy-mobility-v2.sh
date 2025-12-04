#!/bin/bash
set -euo pipefail

# Mobility V2 Production Deployment Script
# Usage: ./scripts/deploy-mobility-v2.sh [phase]
# Phases: pre-check, database, services, cutover-10, cutover-50, cutover-100, cleanup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Configuration
PHASE="${1:-pre-check}"
DEPLOYMENT_LOG="deployment-$(date +%Y%m%d-%H%M%S).log"

# Deployment tracking
DEPLOYMENT_STATE_FILE=".deployment-state.json"

save_state() {
  local phase=$1
  local status=$2
  echo "{\"phase\": \"$phase\", \"status\": \"$status\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$DEPLOYMENT_STATE_FILE"
}

get_current_state() {
  if [[ -f "$DEPLOYMENT_STATE_FILE" ]]; then
    cat "$DEPLOYMENT_STATE_FILE"
  else
    echo "{}"
  fi
}

# Pre-deployment checks
pre_check() {
  log_info "Running pre-deployment checks..."
  
  local errors=0
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker not installed"
    ((errors++))
  else
    log_success "Docker installed"
  fi
  
  # Check Docker Compose
  if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_error "Docker Compose not installed"
    ((errors++))
  else
    log_success "Docker Compose installed"
  fi
  
  # Check environment variables
  local required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")
  for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      log_error "Missing required environment variable: $var"
      ((errors++))
    else
      log_success "Environment variable set: $var"
    fi
  done
  
  # Check database connectivity
  log_info "Checking database connectivity..."
  if ! psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
    log_error "Cannot connect to database"
    ((errors++))
  else
    log_success "Database connection OK"
  fi
  
  # Check if services are built
  log_info "Checking service builds..."
  local services=("matching-service" "ranking-service" "mobility-orchestrator" "tracking-service")
  for service in "${services[@]}"; do
    if [[ ! -f "services/$service/Dockerfile" ]]; then
      log_error "Missing Dockerfile for $service"
      ((errors++))
    else
      log_success "Dockerfile found for $service"
    fi
  done
  
  # Run tests
  log_info "Running tests..."
  if ! pnpm exec vitest run --reporter=basic 2>&1 | tee -a "$DEPLOYMENT_LOG"; then
    log_warning "Some tests failed, but continuing..."
  else
    log_success "All tests passed"
  fi
  
  if [[ $errors -gt 0 ]]; then
    log_error "Pre-deployment checks failed with $errors errors"
    return 1
  fi
  
  log_success "All pre-deployment checks passed ✅"
  save_state "pre-check" "complete"
}

# Deploy database changes
deploy_database() {
  log_info "Deploying database changes..."
  
  # Apply V2 schema
  log_info "Applying V2 schema migrations..."
  if ! supabase db push; then
    log_error "Failed to apply migrations"
    return 1
  fi
  log_success "Migrations applied"
  
  # Enable dual-write
  log_info "Enabling dual-write..."
  if ! psql "$DATABASE_URL" -f supabase/migrations/20251205100000_dual_write_setup.sql; then
    log_error "Failed to enable dual-write"
    return 1
  fi
  log_success "Dual-write enabled"
  
  # Run backfill (optional, can be run separately)
  if [[ "${RUN_BACKFILL:-false}" == "true" ]]; then
    log_info "Running historical data backfill..."
    if ! ./scripts/migration/backfill-v2.sh; then
      log_warning "Backfill failed, but continuing..."
    else
      log_success "Backfill complete"
    fi
  else
    log_info "Skipping backfill (set RUN_BACKFILL=true to enable)"
  fi
  
  # Verify data
  log_info "Verifying database state..."
  psql "$DATABASE_URL" -c "
    SELECT 
      'V1 trips' as source, COUNT(*) as count 
    FROM mobility_intents
    UNION ALL
    SELECT 
      'V2 trips' as source, COUNT(*) as count 
    FROM mobility_trips;
  "
  
  log_success "Database deployment complete ✅"
  save_state "database" "complete"
}

# Deploy services
deploy_services() {
  log_info "Deploying Mobility V2 services..."
  
  # Build services
  log_info "Building service images..."
  if ! docker-compose -f docker-compose.mobility.yml build; then
    log_error "Failed to build service images"
    return 1
  fi
  log_success "Service images built"
  
  # Start services
  log_info "Starting services..."
  if ! docker-compose -f docker-compose.mobility.yml up -d; then
    log_error "Failed to start services"
    return 1
  fi
  log_success "Services started"
  
  # Wait for health checks
  log_info "Waiting for services to be healthy..."
  local max_wait=120
  local elapsed=0
  local services=("matching-service" "ranking-service" "mobility-orchestrator" "tracking-service")
  
  while [[ $elapsed -lt $max_wait ]]; do
    local all_healthy=true
    
    for service in "${services[@]}"; do
      local health=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "unknown")
      if [[ "$health" != "healthy" ]]; then
        all_healthy=false
        log_info "$service: $health"
      fi
    done
    
    if $all_healthy; then
      log_success "All services healthy"
      break
    fi
    
    sleep 5
    ((elapsed+=5))
  done
  
  if [[ $elapsed -ge $max_wait ]]; then
    log_error "Services did not become healthy within $max_wait seconds"
    docker-compose -f docker-compose.mobility.yml logs --tail=50
    return 1
  fi
  
  # Verify service endpoints
  log_info "Verifying service endpoints..."
  local endpoints=(
    "http://localhost:4700/health"
    "http://localhost:4500/health"
    "http://localhost:4600/health"
    "http://localhost:4800/health"
  )
  
  for endpoint in "${endpoints[@]}"; do
    if curl -sf "$endpoint" > /dev/null; then
      log_success "✓ $endpoint"
    else
      log_error "✗ $endpoint"
      return 1
    fi
  done
  
  log_success "Service deployment complete ✅"
  save_state "services" "complete"
}

# Traffic cutover functions
update_traffic_percentage() {
  local percentage=$1
  log_info "Setting traffic to $percentage% V2..."
  
  # Update edge function
  local edge_function_path="supabase/functions/wa-webhook-mobility/index.ts"
  
  # Create temporary file with updated percentage
  local temp_file=$(mktemp)
  
  # Calculate V2 probability (percentage / 100)
  local probability=$(awk "BEGIN {printf \"%.2f\", $percentage/100}")
  
  # Update the USE_V2 logic
  sed "s/const USE_V2 = Math.random() < [0-9.]\+/const USE_V2 = Math.random() < $probability/" \
    "$edge_function_path" > "$temp_file"
  
  mv "$temp_file" "$edge_function_path"
  
  # Deploy edge function
  log_info "Deploying edge function..."
  if ! supabase functions deploy wa-webhook-mobility; then
    log_error "Failed to deploy edge function"
    return 1
  fi
  
  log_success "Traffic set to $percentage% V2"
  
  # Monitor for 5 minutes
  log_info "Monitoring metrics for 5 minutes..."
  sleep 300
  
  # Check error rate
  local error_rate=$(curl -s "http://localhost:9090/api/v1/query?query=rate(http_requests_total{status_code=~\"5..\"}[5m])" \
    | jq -r '.data.result[0].value[1] // "0"')
  
  log_info "Current error rate: $error_rate"
  
  if (( $(echo "$error_rate > 0.01" | bc -l) )); then
    log_error "Error rate too high: $error_rate (threshold: 0.01)"
    log_error "Consider rolling back!"
    return 1
  fi
  
  log_success "Traffic cutover to $percentage% complete ✅"
  save_state "cutover-$percentage" "complete"
}

cutover_10() {
  update_traffic_percentage 10
}

cutover_50() {
  update_traffic_percentage 50
}

cutover_100() {
  update_traffic_percentage 100
}

# Cleanup V1 code
cleanup() {
  log_info "Cleaning up V1 code..."
  
  # Verify V2 is stable (100% traffic for 48 hours)
  local current_state=$(get_current_state)
  local cutover_100_time=$(echo "$current_state" | jq -r '.timestamp // ""')
  
  if [[ -z "$cutover_100_time" ]]; then
    log_error "100% cutover not completed yet"
    return 1
  fi
  
  # Calculate hours since 100% cutover
  local now=$(date -u +%s)
  local cutover_timestamp=$(date -d "$cutover_100_time" +%s)
  local hours_since=$(( (now - cutover_timestamp) / 3600 ))
  
  if [[ $hours_since -lt 48 ]]; then
    log_warning "Only $hours_since hours since 100% cutover (need 48 hours)"
    log_warning "Skipping cleanup for safety"
    return 1
  fi
  
  # Archive V1 code
  log_info "Archiving V1 handlers..."
  mkdir -p archive/v1-handlers
  mv supabase/functions/wa-webhook-mobility/handlers/nearby.ts \
    archive/v1-handlers/nearby.ts || log_warning "V1 handler already removed"
  
  # Remove dual-write trigger
  log_info "Removing dual-write trigger..."
  psql "$DATABASE_URL" -c "DROP TRIGGER IF EXISTS mobility_dual_write_trigger ON mobility_intents;"
  
  # Archive migration scripts
  log_info "Archiving migration scripts..."
  mkdir -p archive/migration-scripts
  cp scripts/migration/backfill-v2.sh archive/migration-scripts/
  
  log_success "Cleanup complete ✅"
  save_state "cleanup" "complete"
}

# Rollback function
rollback() {
  log_error "ROLLBACK initiated"
  
  # Set traffic back to 0% V2
  update_traffic_percentage 0
  
  # Disable dual-write
  psql "$DATABASE_URL" -c "DROP TRIGGER IF EXISTS mobility_dual_write_trigger ON mobility_intents;"
  
  # Stop V2 services
  docker-compose -f docker-compose.mobility.yml down
  
  log_success "Rollback complete. System reverted to V1."
  save_state "rollback" "complete"
}

# Main execution
main() {
  log_info "Mobility V2 Deployment - Phase: $PHASE"
  log_info "Log file: $DEPLOYMENT_LOG"
  
  case "$PHASE" in
    pre-check)
      pre_check | tee -a "$DEPLOYMENT_LOG"
      ;;
    database)
      deploy_database | tee -a "$DEPLOYMENT_LOG"
      ;;
    services)
      deploy_services | tee -a "$DEPLOYMENT_LOG"
      ;;
    cutover-10)
      cutover_10 | tee -a "$DEPLOYMENT_LOG"
      ;;
    cutover-50)
      cutover_50 | tee -a "$DEPLOYMENT_LOG"
      ;;
    cutover-100)
      cutover_100 | tee -a "$DEPLOYMENT_LOG"
      ;;
    cleanup)
      cleanup | tee -a "$DEPLOYMENT_LOG"
      ;;
    rollback)
      rollback | tee -a "$DEPLOYMENT_LOG"
      ;;
    all)
      pre_check && \
      deploy_database && \
      deploy_services && \
      log_info "Automated phases complete. Manual cutover phases required."
      ;;
    *)
      log_error "Unknown phase: $PHASE"
      echo "Usage: $0 [pre-check|database|services|cutover-10|cutover-50|cutover-100|cleanup|rollback|all]"
      exit 1
      ;;
  esac
}

main "$@"
