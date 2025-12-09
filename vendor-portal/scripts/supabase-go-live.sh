#!/usr/bin/env bash
set -euo pipefail

# Trap errors for better debugging
trap 'echo "Error on line $LINENO. Exit code: $?" >&2' ERR

# Parse command line arguments
COMMAND=${1:-}
ENV_FILE=${SUPABASE_SECRETS_FILE:-supabase/.env.production}
PROJECT_REF=${SUPABASE_PROJECT_REF:-}

# List of edge functions to deploy
FUNCTIONS=(
  admin-reset-mfa
  analytics-forecast
  bootstrap-admin
  export-report
  export-statement
  gsm-maintenance
  payments-apply
  import-statement
  ingest-sms
  invite-user
  metrics-exporter
  parse-sms
  recon-exceptions
  reporting-summary
  reports-export
  scheduled-reconciliation
  secure-import-members
  settle-payment
  sms-ai-parse
  sms-inbox
  sms-review
)

# Usage information
usage() {
  cat <<USAGE
Usage: $0 <command>

Commands:
  bootstrap         Run migrations, set secrets (if file present), deploy functions
  migrate           Apply pending migrations to the linked project
  set-secrets       Run 'supabase secrets set --env-file ${ENV_FILE}'
  deploy-functions  Deploy all edge functions listed in this script

Environment variables:
  SUPABASE_PROJECT_REF   (required) project reference, e.g. vacltfdslodqybxojytc
  SUPABASE_SECRETS_FILE  path to secrets env file (default: supabase/.env.production)

Before running, ensure:
  - 'supabase login' has been executed with an access token
  - 'supabase link --project-ref \$SUPABASE_PROJECT_REF' has been run in this repo
  - You have the necessary permissions for the project

Examples:
  SUPABASE_PROJECT_REF=myproject $0 bootstrap
  SUPABASE_PROJECT_REF=myproject $0 migrate
  SUPABASE_SECRETS_FILE=.env.custom $0 set-secrets
USAGE
}

# Validate that project reference is set
require_project_ref() {
  if [[ -z "${PROJECT_REF}" ]]; then
    echo "Error: SUPABASE_PROJECT_REF environment variable is not set" >&2
    echo "Example: SUPABASE_PROJECT_REF=vacltfdslodqybxojytc $0 $COMMAND" >&2
    exit 1
  fi
}

# Check if supabase CLI is available
check_supabase_cli() {
  if ! command -v supabase >/dev/null 2>&1; then
    echo "Error: supabase CLI is not installed or not in PATH" >&2
    echo "Install it from: https://supabase.com/docs/guides/cli" >&2
    exit 1
  fi
}

# Apply database migrations
run_migrations() {
  echo "Applying database migrations..."
  if ! supabase migration up --linked --include-all --yes; then
    echo "Error: Migration failed" >&2
    return 1
  fi
  echo "Migrations applied successfully ✓"
}

# Set Supabase secrets from file
run_set_secrets() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Warning: Secrets file '${ENV_FILE}' not found. Skipping secrets configuration." >&2
    return 0
  fi
  
  echo "Setting Supabase secrets from ${ENV_FILE}..."
  if ! supabase secrets set --env-file "${ENV_FILE}"; then
    echo "Error: Failed to set secrets" >&2
    return 1
  fi
  echo "Secrets configured successfully ✓"
}

# Deploy all edge functions
deploy_functions() {
  echo "Deploying edge functions..."
  local failed_functions=()
  local deployed_count=0
  
  for fn in "${FUNCTIONS[@]}"; do
    echo "  Deploying: $fn"
    if supabase functions deploy "$fn"; then
      ((deployed_count++))
    else
      echo "  Warning: Failed to deploy $fn" >&2
      failed_functions+=("$fn")
    fi
  done
  
  echo ""
  echo "Deployment summary:"
  echo "  Successfully deployed: $deployed_count/${#FUNCTIONS[@]}"
  
  if [[ ${#failed_functions[@]} -gt 0 ]]; then
    echo "  Failed functions: ${failed_functions[*]}" >&2
    return 1
  fi
  
  echo "All functions deployed successfully ✓"
}

# Main command dispatcher
main() {
  # Validate command
  if [[ -z "$COMMAND" ]]; then
    usage
    exit 1
  fi
  
  # Check for supabase CLI
  check_supabase_cli
  
  case "${COMMAND}" in
    bootstrap)
      require_project_ref
      echo "Running full bootstrap for project: $PROJECT_REF"
      echo "This will apply migrations, set secrets, and deploy functions."
      echo ""
      run_migrations || exit 1
      run_set_secrets || exit 1
      deploy_functions || exit 1
      echo ""
      echo "Bootstrap completed successfully ✓"
      ;;
    migrate)
      require_project_ref
      run_migrations || exit 1
      ;;
    set-secrets)
      require_project_ref
      run_set_secrets || exit 1
      ;;
    deploy-functions)
      require_project_ref
      deploy_functions || exit 1
      ;;
    help|--help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown command: $COMMAND" >&2
      echo ""
      usage
      exit 1
      ;;
  esac
}

# Run main function
main
