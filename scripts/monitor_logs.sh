#!/bin/bash

# Log Monitoring Script
# Monitors Supabase logs for errors and issues

set -e

PROJECT_REF="${PROJECT_REF:-lhbowpbcpwoiparwnwgt}"
DURATION="${1:-300}" # Default 5 minutes

echo "📊 Monitoring WhatsApp Webhook Logs..."
echo "Duration: ${DURATION} seconds"
echo "Project: ${PROJECT_REF}"
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Monitor logs for errors
echo "Monitoring for errors..."
echo "Press Ctrl+C to stop"
echo ""

supabase functions logs --project-ref "${PROJECT_REF}" \
    --filter "wa-webhook" \
    --follow \
    --format json 2>/dev/null | while read -r line; do
    # Parse JSON log line
    level=$(echo "$line" | jq -r '.level // "info"' 2>/dev/null || echo "info")
    event=$(echo "$line" | jq -r '.event // "unknown"' 2>/dev/null || echo "unknown")
    error=$(echo "$line" | jq -r '.error // empty' 2>/dev/null || echo "")
    
    # Color coding
    if [ "$level" = "error" ]; then
        echo -e "\033[0;31m[ERROR]\033[0m $event"
        if [ -n "$error" ]; then
            echo "  Error: $error"
        fi
    elif [ "$level" = "warn" ]; then
        echo -e "\033[1;33m[WARN]\033[0m $event"
    elif [ "$level" = "info" ]; then
        echo -e "\033[0;32m[INFO]\033[0m $event"
    fi
done

