#!/bin/bash
# =====================================================================
# DEPLOY ALL 8 AI AGENTS - Complete Refactoring
# =====================================================================
# Deploys all agent framework migrations to Supabase
# 
# Usage:
#   ./deploy-all-agents.sh [staging|production]
#
# Created: 2025-11-22
# =====================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-staging}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="deploy_agents_${TIMESTAMP}.log"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   EasyMO AI Agent Framework Deployment                    ║${NC}"
echo -e "${BLUE}║   Environment: ${ENVIRONMENT}                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to log messages
log() {
  echo -e "$1" | tee -a "$LOG_FILE"
}

# Function to run migration
run_migration() {
  local migration_file=$1
  local migration_name=$(basename "$migration_file" .sql)
  
  log "${YELLOW}▶ Applying: $migration_name${NC}"
  
  if psql "$DATABASE_URL" -f "$migration_file" >> "$LOG_FILE" 2>&1; then
    log "${GREEN}✅ Success: $migration_name${NC}"
    return 0
  else
    log "${RED}❌ Failed: $migration_name${NC}"
    return 1
  fi
}

# Check DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  log "${RED}❌ ERROR: DATABASE_URL not set${NC}"
  log "${YELLOW}Set it with: export DATABASE_URL='postgresql://...'${NC}"
  exit 1
fi

log "${GREEN}✅ DATABASE_URL is set${NC}"
log ""

# Confirm deployment
log "${YELLOW}This will deploy ALL agent migrations to: $ENVIRONMENT${NC}"
log "${YELLOW}Continue? (yes/no)${NC}"
read -r confirmation

if [ "$confirmation" != "yes" ]; then
  log "${RED}Deployment cancelled${NC}"
  exit 0
fi

log ""
log "${BLUE}════════════════════════════════════════════════════════════${NC}"
log "${BLUE}STEP 1: Core Framework Migrations${NC}"
log "${BLUE}════════════════════════════════════════════════════════════${NC}"

CORE_MIGRATIONS=(
  "supabase/migrations/20251122073000_ai_agent_ecosystem_schema.sql"
  "supabase/migrations/20251122073100_seed_ai_agents_complete.sql"
  "supabase/migrations/20251122073534_align_home_menu_with_ai_agents.sql"
  "supabase/migrations/20251122080000_add_location_update_rpc.sql"
  "supabase/migrations/20251122081500_add_search_rpc.sql"
)

for migration in "${CORE_MIGRATIONS[@]}"; do
  if [ -f "$migration" ]; then
    run_migration "$migration" || {
      log "${RED}Core migration failed. Aborting.${NC}"
      exit 1
    }
  else
    log "${YELLOW}⚠ Migration not found: $migration (skipping)${NC}"
  fi
done

log ""
log "${BLUE}════════════════════════════════════════════════════════════${NC}"
log "${BLUE}STEP 2: Apply Intent Functions (8 Agents)${NC}"
log "${BLUE}════════════════════════════════════════════════════════════${NC}"

AGENT_MIGRATIONS=(
  "supabase/migrations/20251122082500_apply_intent_waiter.sql"
  "supabase/migrations/20251122084500_apply_intent_rides.sql"
  "supabase/migrations/20251122085000_apply_intent_jobs.sql"
  "supabase/migrations/20251122090000_apply_intent_business_broker.sql"
  "supabase/migrations/20251122110000_apply_intent_farmer.sql"
  "supabase/migrations/20251122111000_apply_intent_real_estate.sql"
  "supabase/migrations/20251122112000_apply_intent_sales_sdr.sql"
  "supabase/migrations/20251122113000_apply_intent_insurance.sql"
)

AGENT_COUNT=0
for migration in "${AGENT_MIGRATIONS[@]}"; do
  if [ -f "$migration" ]; then
    run_migration "$migration" || {
      log "${RED}Agent migration failed: $migration${NC}"
      log "${YELLOW}Continue anyway? (yes/no)${NC}"
      read -r continue_confirmation
      if [ "$continue_confirmation" != "yes" ]; then
        exit 1
      fi
    }
    AGENT_COUNT=$((AGENT_COUNT + 1))
  else
    log "${YELLOW}⚠ Migration not found: $migration (skipping)${NC}"
  fi
done

log ""
log "${BLUE}════════════════════════════════════════════════════════════${NC}"
log "${BLUE}STEP 3: Profile & Wallet${NC}"
log "${BLUE}════════════════════════════════════════════════════════════${NC}"

PROFILE_MIGRATION="supabase/migrations/20251122100000_wallet_system_config.sql"
if [ -f "$PROFILE_MIGRATION" ]; then
  run_migration "$PROFILE_MIGRATION"
else
  log "${YELLOW}⚠ Profile migration not found (skipping)${NC}"
fi

log ""
log "${BLUE}════════════════════════════════════════════════════════════${NC}"
log "${BLUE}STEP 4: Verification${NC}"
log "${BLUE}════════════════════════════════════════════════════════════${NC}"

log "${YELLOW}▶ Checking agents table...${NC}"
psql "$DATABASE_URL" -c "SELECT slug, name, is_active FROM ai_agents ORDER BY slug;" >> "$LOG_FILE" 2>&1 || {
  log "${RED}❌ Failed to query agents table${NC}"
}

log "${YELLOW}▶ Checking apply_intent functions...${NC}"
FUNCTIONS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'apply_intent_%';" 2>/dev/null || echo "0")
log "${GREEN}Found $FUNCTIONS_COUNT apply_intent functions${NC}"

if [ "$FUNCTIONS_COUNT" -ge 8 ]; then
  log "${GREEN}✅ All expected functions found${NC}"
else
  log "${YELLOW}⚠ Expected 8+ functions, found $FUNCTIONS_COUNT${NC}"
fi

log ""
log "${BLUE}════════════════════════════════════════════════════════════${NC}"
log "${BLUE}DEPLOYMENT SUMMARY${NC}"
log "${BLUE}════════════════════════════════════════════════════════════${NC}"

log ""
log "${GREEN}✅ Deployment Complete!${NC}"
log ""
log "Environment: ${ENVIRONMENT}"
log "Agents Deployed: ${AGENT_COUNT}/8"
log "Functions Found: ${FUNCTIONS_COUNT}"
log "Log File: ${LOG_FILE}"
log ""
log "${YELLOW}Next Steps:${NC}"
log "  1. Test each agent manually"
log "  2. Run integration tests: ./test-all-agents.sh"
log "  3. Check logs: tail -f ${LOG_FILE}"
log "  4. Enable feature flags if needed"
log ""
log "${BLUE}════════════════════════════════════════════════════════════${NC}"

# Save deployment metadata
cat > "deployment_metadata_${TIMESTAMP}.json" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "agents_deployed": ${AGENT_COUNT},
  "functions_count": ${FUNCTIONS_COUNT},
  "log_file": "${LOG_FILE}",
  "status": "complete"
}
EOF

log "${GREEN}Deployment metadata saved to: deployment_metadata_${TIMESTAMP}.json${NC}"
log ""
