#!/bin/bash
set -e

echo "🚀 Deploying mobility matching fix..."
echo ""
echo "Migration: 20251209090000_fix_mobility_trips_alignment.sql"
echo "Fixes: Column t.creator_user_id does not exist error"
echo ""

cd "$(dirname "$0")/.."

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install: npm i -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Run: supabase login"
    exit 1
fi

echo "📋 Current migration status:"
supabase migration list --linked 2>&1 | tail -10 || echo "Could not fetch remote migrations"

echo ""
echo "🔄 Pushing migration to remote database..."
supabase db push --linked

echo ""
echo "✅ Migration deployed successfully!"
echo ""
echo "🧪 Test the fix:"
echo "   1. Send WhatsApp location to trigger nearby driver search"
echo "   2. Check logs for 'column t.creator_user_id does not exist' error"
echo "   3. Verify matches are returned"
echo ""
