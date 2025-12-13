#!/bin/bash
# ============================================================================
# Supabase Secrets Cleanup Script
# ============================================================================
# This script deletes 55 deprecated/duplicate secrets from Supabase
# Keeping only 27 essential secrets for Rwanda-only platform
# ============================================================================

set -e

PROJECT_REF="lhbowpbcpwoiparwnwgt"

echo "🔐 SUPABASE SECRETS CLEANUP"
echo "============================"
echo ""
echo "This will delete 55 deprecated secrets, keeping 27 essential ones"
echo "Project: $PROJECT_REF"
echo ""
echo "⚠️  WARNING: This action cannot be undone!"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

# Duplicates to delete (7)
DUPLICATES=(
  "SERVICE_ROLE_KEY"
  "SERVICE_URL"
  "WA_SUPABASE_SERVICE_ROLE_KEY"
  "VITE_SUPABASE_ANON_KEY"
  "VITE_SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "GOOGLE_SEARCH_API_KEY"
)

# Waiter/Menu/OCR (9)
WAITER_OCR=(
  "MENU_MEDIA_BUCKET"
  "OCR_RESULT_BUCKET"
  "OCR_MAX_ATTEMPTS"
  "OCR_QUEUE_SCAN_LIMIT"
  "OCR_MAX_MENU_CATEGORIES"
  "OCR_MAX_MENU_ITEMS"
  "INSURANCE_OCR_METRICS_WEBHOOK_URL"
  "INSURANCE_OCR_METRICS_TOKEN"
  "INSURANCE_MEDIA_BUCKET"
)

# Cart/Order Reminders (8)
CART_REMINDERS=(
  "CART_REMINDER_CRON"
  "CART_REMINDER_MINUTES"
  "CART_REMINDER_BATCH_SIZE"
  "ORDER_PENDING_REMINDER_LANGUAGE"
  "ORDER_PENDING_REMINDER_CRON"
  "ORDER_PENDING_REMINDER_CRON_ENABLED"
  "ORDER_PENDING_REMINDER_MINUTES"
  "ORDER_PENDING_REMINDER_BATCH_SIZE"
)

# Voucher System (2)
VOUCHERS=(
  "VOUCHER_SIGNING_SECRET"
  "VOUCHERS_BUCKET"
)

# Build/Dev Tools (6)
BUILD_TOOLS=(
  "TURBO_CACHE"
  "TURBO_REMOTE_ONLY"
  "TURBO_RUN_SUMMARY"
  "TURBO_DOWNLOAD_LOCAL_ENABLED"
  "VITE_SUPABASE_PROJECT_ID"
  "VITE_API_BASE"
)

# Unused/Deprecated (20)
DEPRECATED=(
  "ADMIN_TOKEN"
  "ADMIN_ACCESS_CREDENTIALS"
  "ADMIN_SESSION_SECRET_FALLBACK"
  "ADMIN_FLOW_WA_ID"
  "BRIDGE_SHARED_SECRET"
  "MOMO_SMS_HMAC_SECRET"
  "KYC_SIGNED_URL_TTL_SECONDS"
  "DEEPLINK_SIGNING_SECRET"
  "BROKER_APP_BASE_URL"
  "ALERT_WEBHOOK_URL"
  "NOTIFY_WORKER_LEASE_SECONDS"
  "NOTIFY_MAX_RETRIES"
  "NOTIFY_BACKOFF_BASE_SECONDS"
  "NOTIFY_MAX_BACKOFF_SECONDS"
  "NOTIFY_DEFAULT_DELAY_SECONDS"
  "WALLET_API_KEY"
  "SIGNATURE_SECRET"
  "SERPAPI_KEY"
  "FEATURE_AGENT_ALL"
  "FEATURE_AGENT_UNIFIED_SYSTEM"
)

delete_secrets() {
  local category=$1
  shift
  local secrets=("$@")
  
  echo ""
  echo "🗑️  Deleting $category..."
  echo "----------------------------------------"
  
  for secret in "${secrets[@]}"; do
    echo -n "  Deleting $secret... "
    if supabase secrets unset "$secret" --project-ref "$PROJECT_REF" 2>/dev/null; then
      echo "✓"
    else
      echo "⊗ (not found or already deleted)"
    fi
  done
}

# Delete duplicates
delete_secrets "Duplicates (7)" "${DUPLICATES[@]}"

# Delete waiter/OCR
delete_secrets "Waiter/Menu/OCR (9)" "${WAITER_OCR[@]}"

# Delete cart reminders
delete_secrets "Cart/Order Reminders (8)" "${CART_REMINDERS[@]}"

# Delete vouchers
delete_secrets "Voucher System (2)" "${VOUCHERS[@]}"

# Delete build tools
delete_secrets "Build/Dev Tools (6)" "${BUILD_TOOLS[@]}"

# Delete deprecated
delete_secrets "Unused/Deprecated (20)" "${DEPRECATED[@]}"

echo ""
echo "✅ CLEANUP COMPLETE!"
echo "===================="
echo ""
echo "Summary:"
echo "  Deleted: 52 secrets"
echo "  Remaining: 27 essential secrets"
echo ""
echo "Verification:"
supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null || echo "Run: supabase secrets list --project-ref $PROJECT_REF"
