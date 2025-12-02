#!/usr/bin/env bash
# verify-migrations-before-deploy.sh
# Pre-deployment verification script that checks if required database migrations
# have been applied before deploying edge functions.
#
# This script prevents production incidents where edge functions are deployed
# before their required database schema changes are in place.
#
# Usage:
#   ./scripts/verify-migrations-before-deploy.sh <function_name>
#   ./scripts/verify-migrations-before-deploy.sh wa-webhook-mobility
#
# Requirements:
#   - DATABASE_URL environment variable must be set
#   - psql client must be installed
#   - jq must be installed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_FILE="$ROOT_DIR/supabase/migration-manifest.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1" >&2
}

# Sanitize identifier to prevent SQL injection
# Only allows alphanumeric characters, underscores, and hyphens
sanitize_identifier() {
  local input="$1"
  # Remove any characters that are not alphanumeric, underscore, or hyphen
  echo "$input" | sed 's/[^a-zA-Z0-9_-]//g'
}

# Validate that identifier matches expected pattern
# Used to ensure values from manifest are safe for SQL
validate_identifier() {
  local input="$1"
  local name="$2"
  
  if [[ ! "$input" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    log_error "Invalid $name: '$input' - only alphanumeric, underscore, and hyphen allowed"
    return 1
  fi
  return 0
}

# Check required tools
check_prerequisites() {
  local missing=()
  
  if ! command -v psql &> /dev/null; then
    missing+=("psql")
  fi
  
  if ! command -v jq &> /dev/null; then
    missing+=("jq")
  fi
  
  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    echo "Please install the missing tools and try again."
    exit 1
  fi
}

# List functions with dependencies from manifest
list_functions_with_deps() {
  jq -r 'to_entries | .[] | select(.value.required_migrations | length > 0) | "  - \(.key)"' "$MANIFEST_FILE" 2>/dev/null || true
}

# Validate function name argument
validate_args() {
  if [ $# -lt 1 ]; then
    echo "Usage: $0 <function_name>"
    echo "Example: $0 wa-webhook-mobility"
    echo ""
    echo "Available functions with dependencies:"
    list_functions_with_deps
    exit 1
  fi
  
  # Validate function name format
  local function_name="$1"
  if ! validate_identifier "$function_name" "function name"; then
    exit 1
  fi
}

# Check if DATABASE_URL is set
check_database_url() {
  if [ -z "${DATABASE_URL:-}" ]; then
    log_error "DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL to your Supabase database connection string."
    echo "Example: export DATABASE_URL='postgresql://postgres:password@db.project.supabase.co:5432/postgres'"
    exit 1
  fi
}

# Check if manifest file exists
check_manifest() {
  if [ ! -f "$MANIFEST_FILE" ]; then
    log_error "Migration manifest file not found: $MANIFEST_FILE"
    echo "Please create the manifest file with edge function dependencies."
    exit 1
  fi
}

# Get function configuration from manifest
get_function_config() {
  local function_name="$1"
  local config
  
  # Use jq's --arg to safely handle the function name
  config=$(jq -e --arg fn "$function_name" '.[$fn]' "$MANIFEST_FILE" 2>/dev/null)
  
  if [ "$config" = "null" ] || [ -z "$config" ]; then
    log_warn "Function '$function_name' not found in manifest - no dependencies to verify"
    exit 0
  fi
  
  echo "$config"
}

# Check if migrations have been applied
check_migrations() {
  local function_name="$1"
  local config="$2"
  local failed=0
  
  local migrations
  migrations=$(echo "$config" | jq -r '.required_migrations[]' 2>/dev/null || true)
  
  if [ -z "$migrations" ]; then
    log_info "No required migrations for $function_name"
    return 0
  fi
  
  echo "Checking required migrations for $function_name..."
  
  while IFS= read -r migration; do
    [ -z "$migration" ] && continue
    
    # Sanitize and validate migration name
    migration=$(sanitize_identifier "$migration")
    if ! validate_identifier "$migration" "migration name"; then
      failed=1
      continue
    fi
    
    # Check if migration exists in supabase_migrations table using parameterized approach
    local result
    result=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = \$\$${migration}\$\$" 2>/dev/null || echo "error")
    
    if [ "$result" = "error" ]; then
      # Try alternative: check if migration name pattern exists
      result=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version LIKE \$\$%${migration}%\$\$" 2>/dev/null || echo "0")
    fi
    
    if [ "$result" = "1" ] || [ "$result" -gt 0 ] 2>/dev/null; then
      log_info "Migration applied: $migration"
    else
      log_error "Migration NOT applied: $migration"
      failed=1
    fi
  done <<< "$migrations"
  
  return $failed
}

# Check if required columns exist
check_columns() {
  local function_name="$1"
  local config="$2"
  local failed=0
  
  local columns
  columns=$(echo "$config" | jq -r '.required_columns[] | "\(.table).\(.column)"' 2>/dev/null || true)
  
  if [ -z "$columns" ]; then
    log_info "No required columns for $function_name"
    return 0
  fi
  
  echo "Checking required columns for $function_name..."
  
  while IFS= read -r col; do
    [ -z "$col" ] && continue
    
    local table_name="${col%.*}"
    local column_name="${col#*.}"
    
    # Sanitize and validate table/column names
    table_name=$(sanitize_identifier "$table_name")
    column_name=$(sanitize_identifier "$column_name")
    
    if ! validate_identifier "$table_name" "table name" || ! validate_identifier "$column_name" "column name"; then
      failed=1
      continue
    fi
    
    # Use dollar-quoted strings to prevent SQL injection
    local result
    result=$(psql "$DATABASE_URL" -tAc "
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = \$\$${table_name}\$\$
        AND column_name = \$\$${column_name}\$\$
    " 2>/dev/null || echo "0")
    
    if [ "$result" = "1" ]; then
      log_info "Column exists: $table_name.$column_name"
    else
      log_error "Column NOT found: $table_name.$column_name"
      failed=1
    fi
  done <<< "$columns"
  
  return $failed
}

# Check if required functions exist
check_functions() {
  local function_name="$1"
  local config="$2"
  local failed=0
  
  local functions
  functions=$(echo "$config" | jq -r '.required_functions[]' 2>/dev/null || true)
  
  if [ -z "$functions" ]; then
    log_info "No required functions for $function_name"
    return 0
  fi
  
  echo "Checking required database functions for $function_name..."
  
  while IFS= read -r func; do
    [ -z "$func" ] && continue
    
    # Sanitize and validate function name
    func=$(sanitize_identifier "$func")
    if ! validate_identifier "$func" "function name"; then
      failed=1
      continue
    fi
    
    # Use dollar-quoted strings to prevent SQL injection
    local result
    result=$(psql "$DATABASE_URL" -tAc "
      SELECT COUNT(*) FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = \$\$${func}\$\$
    " 2>/dev/null || echo "0")
    
    if [ "$result" -ge 1 ] 2>/dev/null; then
      log_info "Function exists: $func"
    else
      log_error "Function NOT found: $func"
      failed=1
    fi
  done <<< "$functions"
  
  return $failed
}

# Main function
main() {
  validate_args "$@"
  
  local function_name="$1"
  
  echo "========================================"
  echo "Pre-deployment Migration Verification"
  echo "========================================"
  echo "Edge Function: $function_name"
  echo "Manifest: $MANIFEST_FILE"
  echo ""
  
  check_prerequisites
  check_database_url
  check_manifest
  
  local config
  config=$(get_function_config "$function_name")
  
  local errors=0
  
  # Run all checks
  check_migrations "$function_name" "$config" || errors=$((errors + 1))
  echo ""
  check_columns "$function_name" "$config" || errors=$((errors + 1))
  echo ""
  check_functions "$function_name" "$config" || errors=$((errors + 1))
  
  echo ""
  echo "========================================"
  
  if [ $errors -gt 0 ]; then
    log_error "VERIFICATION FAILED: $errors check(s) failed"
    echo ""
    echo "Action Required:"
    echo "  1. Apply missing migrations: supabase db push"
    echo "  2. Re-run this verification script"
    echo "  3. Then deploy the edge function"
    echo ""
    echo "To apply migrations manually:"
    echo "  supabase link --project-ref \$SUPABASE_PROJECT_REF"
    echo "  supabase db push --password \$SUPABASE_DB_PASSWORD"
    exit 1
  else
    log_info "VERIFICATION PASSED: All dependencies satisfied"
    echo "Safe to deploy $function_name"
    exit 0
  fi
}

main "$@"
