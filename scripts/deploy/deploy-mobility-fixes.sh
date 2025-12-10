#!/bin/bash
# Quick deployment script for mobility matching fixes
# Run this after fixing the wa-webhook import issue

set -e

echo "🚀 EasyMO Mobility Matching Fixes - Deployment Script"
echo "======================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Show migration files
echo -e "${YELLOW}📄 Migration files to deploy:${NC}"
echo "1. supabase/migrations/20251201082000_fix_trip_matching_and_intent_storage.sql"
echo "2. supabase/migrations/20251201082100_add_recommendation_functions.sql"
echo ""

# Step 2: Offer deployment options
echo -e "${YELLOW}Choose deployment method:${NC}"
echo "1) Via Supabase Dashboard (SQL Editor) - RECOMMENDED"
echo "2) Via psql (requires DATABASE_URL)"
echo "3) Show migration contents"
echo "4) Exit"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
  1)
    echo ""
    echo -e "${GREEN}✓ Dashboard Deployment Selected${NC}"
    echo ""
    echo "Steps:"
    echo "1. Open Supabase Dashboard → Your Project → SQL Editor"
    echo "2. Create new query and paste migration 1:"
    echo ""
    echo "   File: supabase/migrations/20251201082000_fix_trip_matching_and_intent_storage.sql"
    echo ""
    echo "3. Execute"
    echo "4. Create another query and paste migration 2:"
    echo ""
    echo "   File: supabase/migrations/20251201082100_add_recommendation_functions.sql"
    echo ""
    echo "5. Execute"
    echo ""
    read -p "Press Enter to show migration 1 contents (Ctrl+C to cancel)..."
    echo ""
    echo "==================== MIGRATION 1 START ===================="
    cat supabase/migrations/20251201082000_fix_trip_matching_and_intent_storage.sql
    echo "==================== MIGRATION 1 END ===================="
    echo ""
    read -p "Press Enter to show migration 2 contents..."
    echo ""
    echo "==================== MIGRATION 2 START ===================="
    cat supabase/migrations/20251201082100_add_recommendation_functions.sql
    echo "==================== MIGRATION 2 END ===================="
    echo ""
    ;;
    
  2)
    echo ""
    if [ -z "$DATABASE_URL" ]; then
      echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
      echo ""
      read -p "Enter your Supabase connection string: " db_url
      export DATABASE_URL="$db_url"
    fi
    
    echo -e "${GREEN}✓ Using DATABASE_URL${NC}"
    echo ""
    echo "Applying migration 1..."
    psql "$DATABASE_URL" -f supabase/migrations/20251201082000_fix_trip_matching_and_intent_storage.sql
    
    echo ""
    echo "Applying migration 2..."
    psql "$DATABASE_URL" -f supabase/migrations/20251201082100_add_recommendation_functions.sql
    
    echo ""
    echo -e "${GREEN}✓ Migrations applied successfully!${NC}"
    echo ""
    echo "Verifying..."
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as mobility_intents_exists FROM information_schema.tables WHERE table_name = 'mobility_intents';"
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as functions_created FROM pg_proc WHERE proname LIKE 'recommend_%';"
    ;;
    
  3)
    echo ""
    echo "==================== MIGRATION 1 ===================="
    cat supabase/migrations/20251201082000_fix_trip_matching_and_intent_storage.sql
    echo ""
    echo "==================== MIGRATION 2 ===================="
    cat supabase/migrations/20251201082100_add_recommendation_functions.sql
    ;;
    
  4)
    echo "Exiting..."
    exit 0
    ;;
    
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✅ Done!${NC}"
echo ""
echo "Next steps:"
echo "1. Fix wa-webhook/index.ts line 9 (broken import)"
echo "2. Deploy edge functions: supabase functions deploy wa-webhook wa-webhook-mobility"
echo "3. Monitor with queries in DEPLOYMENT_STATUS.md"
echo ""
