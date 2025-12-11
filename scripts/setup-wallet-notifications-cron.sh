#!/bin/bash

# Setup Wallet Notifications Cron Job
# This script helps configure a cron job to process wallet notifications every minute
# 
# IMPORTANT: Supabase hosted platform doesn't support pg_cron extension
# You need to use an external cron service or Supabase Edge Functions with webhooks

set -e

echo "🔧 Wallet Notifications Cron Job Setup"
echo "======================================="
echo ""

# Get project details
PROJECT_REF=$(grep 'SUPABASE_URL' .env 2>/dev/null | cut -d'/' -f3 | cut -d'.' -f1 || echo "lhbowpbcpwoiparwnwgt")
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
SERVICE_ROLE_KEY=$(grep 'SUPABASE_SERVICE_ROLE_KEY' .env 2>/dev/null | cut -d'=' -f2 || echo "")

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env"
    echo ""
    echo "Please create .env file with:"
    echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
    exit 1
fi

echo "Project URL: $SUPABASE_URL"
echo "Function: $SUPABASE_URL/functions/v1/wallet-notifications"
echo ""

# Method 1: Using GitHub Actions (recommended for this repo)
echo "📋 METHOD 1: GitHub Actions (Recommended)"
echo "==========================================="
echo ""
echo "Add this to .github/workflows/cron-wallet-notifications.yml:"
echo ""
cat << 'YAML'
name: Process Wallet Notifications

on:
  schedule:
    - cron: '* * * * *'  # Every minute
  workflow_dispatch:      # Manual trigger

jobs:
  process-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Call wallet-notifications function
        run: |
          curl -X POST \
            https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wallet-notifications \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
YAML
echo ""
echo "⚠️  NOTE: GitHub Actions cron runs at most every 5 minutes, not every minute."
echo ""

# Method 2: Using External Cron Service
echo "📋 METHOD 2: External Cron Service (e.g., cron-job.org, EasyCron)"
echo "=================================================================="
echo ""
echo "1. Go to https://cron-job.org or https://www.easycron.com"
echo "2. Create a new cron job with these settings:"
echo "   - URL: $SUPABASE_URL/functions/v1/wallet-notifications"
echo "   - Method: POST"
echo "   - Headers:"
echo "     * Authorization: Bearer $SERVICE_ROLE_KEY"
echo "     * Content-Type: application/json"
echo "   - Schedule: Every 1 minute"
echo "   - Body: {}"
echo ""

# Method 3: Using Render.com Cron Job
echo "📋 METHOD 3: Render.com Cron Job (Free)"
echo "========================================"
echo ""
echo "1. Go to https://dashboard.render.com"
echo "2. Click 'New +' → 'Cron Job'"
echo "3. Configure:"
echo "   - Name: wallet-notifications-processor"
echo "   - Command: curl -X POST '$SUPABASE_URL/functions/v1/wallet-notifications' \\"
echo "             -H 'Authorization: Bearer $SERVICE_ROLE_KEY' \\"
echo "             -H 'Content-Type: application/json' \\"
echo "             -d '{}'"
echo "   - Schedule: */1 * * * * (every minute)"
echo ""

# Method 4: Manual Setup Script (for development)
echo "📋 METHOD 4: Local Development (Manual)"
echo "========================================"
echo ""
echo "Run this command in a separate terminal:"
echo ""
echo "watch -n 60 'curl -X POST \"$SUPABASE_URL/functions/v1/wallet-notifications\" \\"
echo "  -H \"Authorization: Bearer $SERVICE_ROLE_KEY\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d \"{}\"'"
echo ""

# Test the function
echo "🧪 Testing wallet-notifications function..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$SUPABASE_URL/functions/v1/wallet-notifications" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Function is working correctly!"
    echo "Response: $BODY"
else
    echo "❌ Function returned HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi

echo ""
echo "📊 Check pending notifications:"
echo ""
echo "Run this SQL query in Supabase SQL Editor:"
echo ""
echo "SELECT COUNT(*) as pending_count"
echo "FROM wallet_notification_queue"
echo "WHERE sent_at IS NULL;"
echo ""

# Create a simple cron script for local development
CRON_SCRIPT="scripts/cron-wallet-notifications.sh"
mkdir -p scripts

cat > "$CRON_SCRIPT" << 'SCRIPT'
#!/bin/bash
# Local development cron job for wallet notifications
# Run this in background: ./scripts/cron-wallet-notifications.sh &

SUPABASE_URL="${SUPABASE_URL:-https://lhbowpbcpwoiparwnwgt.supabase.co}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "Error: SUPABASE_SERVICE_ROLE_KEY not set"
    exit 1
fi

echo "Starting wallet notifications processor (every 60 seconds)..."

while true; do
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$TIMESTAMP] Processing wallet notifications..."
    
    RESPONSE=$(curl -s -X POST \
        "$SUPABASE_URL/functions/v1/wallet-notifications" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d '{}')
    
    echo "Response: $RESPONSE"
    echo ""
    
    sleep 60
done
SCRIPT

chmod +x "$CRON_SCRIPT"

echo "✅ Created local cron script: $CRON_SCRIPT"
echo ""
echo "To run locally (development only):"
echo "  export SUPABASE_SERVICE_ROLE_KEY='$SERVICE_ROLE_KEY'"
echo "  ./$CRON_SCRIPT"
echo ""
echo "🎉 Setup complete! Choose your preferred method above."
