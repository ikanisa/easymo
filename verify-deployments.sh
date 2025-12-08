#!/bin/bash

echo "🔍 Checking deployed Supabase Edge Functions..."

# List all deployed functions
supabase functions list --project-ref lhbowpbcpwoiparwnwgt

echo ""
echo "📋 Local functions that should be deployed:"
ls -1 supabase/functions/ | grep "wa-webhook" | sort
