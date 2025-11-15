#!/bin/bash
# Complete Deployment Script for Geolocation Features
# This script will guide you through the entire deployment process

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║    EasyMo Platform - Geolocation Deployment Script        ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check if running in correct directory
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}ERROR: Please run this script from the workspace/easymo- directory${NC}"
    exit 1
fi

echo -e "${YELLOW}This script will:${NC}"
echo "  1. Check prerequisites"
echo "  2. Apply database migration"
echo "  3. Deploy geocoding Edge Function"
echo "  4. Set up environment variables"
echo "  5. Run initial geocoding"
echo "  6. Verify the installation"
echo ""
read -p "Do you want to continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# ===============================================
# STEP 1: Check Prerequisites
# ===============================================
echo ""
echo -e "${BLUE}═══ Step 1: Checking Prerequisites ═══${NC}"
echo ""

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    echo "Install it with: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✓ Supabase CLI installed${NC}"

# Check psql (optional but recommended)
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL client (psql) available${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL client (psql) not found (optional)${NC}"
fi

# Check Google Maps API Key
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo -e "${YELLOW}⚠ GOOGLE_MAPS_API_KEY not set in environment${NC}"
    echo "Checking .env file..."
    if grep -q "GOOGLE_MAPS_API_KEY" .env 2>/dev/null; then
        echo -e "${GREEN}✓ Found in .env file${NC}"
        export GOOGLE_MAPS_API_KEY=$(grep "GOOGLE_MAPS_API_KEY" .env | cut -d '=' -f2)
    else
        echo -e "${RED}✗ GOOGLE_MAPS_API_KEY not configured${NC}"
        echo "Please add it to your .env file or export it:"
        echo "export GOOGLE_MAPS_API_KEY=AIzaSyB8B8N2scJAWMs05f-xGRVzQAb4MQIuNEU"
        exit 1
    fi
else
    echo -e "${GREEN}✓ GOOGLE_MAPS_API_KEY found in environment${NC}"
fi

# ===============================================
# STEP 2: Apply Database Migration
# ===============================================
echo ""
echo -e "${BLUE}═══ Step 2: Applying Database Migration ═══${NC}"
echo ""
echo "This will add latitude/longitude columns and distance functions..."
echo ""

read -p "Apply migration now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running: supabase db push"
    if supabase db push; then
        echo -e "${GREEN}✓ Migration applied successfully${NC}"
    else
        echo -e "${RED}✗ Migration failed${NC}"
        echo "Please check the error above and try again."
        exit 1
    fi
else
    echo -e "${YELLOW}Skipping migration (you can run 'supabase db push' manually)${NC}"
fi

# ===============================================
# STEP 3: Deploy Edge Function
# ===============================================
echo ""
echo -e "${BLUE}═══ Step 3: Deploying Geocoding Edge Function ═══${NC}"
echo ""

read -p "Deploy geocode-locations function? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running: supabase functions deploy geocode-locations"
    cd supabase
    if supabase functions deploy geocode-locations --no-verify-jwt; then
        echo -e "${GREEN}✓ Edge Function deployed successfully${NC}"
    else
        echo -e "${RED}✗ Function deployment failed${NC}"
        exit 1
    fi
    cd ..
else
    echo -e "${YELLOW}Skipping function deployment${NC}"
fi

# ===============================================
# STEP 4: Set Environment Variables
# ===============================================
echo ""
echo -e "${BLUE}═══ Step 4: Setting Up Supabase Secrets ═══${NC}"
echo ""
echo "The Edge Function needs access to GOOGLE_MAPS_API_KEY..."
echo ""

read -p "Set GOOGLE_MAPS_API_KEY in Supabase secrets? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
        echo "Running: supabase secrets set GOOGLE_MAPS_API_KEY=..."
        if supabase secrets set GOOGLE_MAPS_API_KEY="$GOOGLE_MAPS_API_KEY"; then
            echo -e "${GREEN}✓ API key configured in Supabase${NC}"
        else
            echo -e "${RED}✗ Failed to set secret${NC}"
            echo "You can set it manually with:"
            echo "supabase secrets set GOOGLE_MAPS_API_KEY=your-key-here"
        fi
    else
        echo -e "${RED}✗ GOOGLE_MAPS_API_KEY not available${NC}"
    fi
else
    echo -e "${YELLOW}Skipping secret configuration${NC}"
    echo "Remember to set it manually with:"
    echo "supabase secrets set GOOGLE_MAPS_API_KEY=your-key-here"
fi

# ===============================================
# STEP 5: Run Initial Geocoding
# ===============================================
echo ""
echo -e "${BLUE}═══ Step 5: Running Initial Geocoding ═══${NC}"
echo ""
echo "This will geocode all bars and businesses..."
echo "Estimated time: 2-3 minutes for ~150 records"
echo ""

read -p "Run geocoding now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -x "./scripts/geocode-data.sh" ]; then
        ./scripts/geocode-data.sh all 50
    else
        echo "Running geocoding via Supabase CLI..."
        cd supabase
        supabase functions invoke geocode-locations \
            --body '{"table":"all","batch_size":50}'
        cd ..
    fi
else
    echo -e "${YELLOW}Skipping geocoding${NC}"
    echo "You can run it later with: ./scripts/geocode-data.sh all 50"
fi

# ===============================================
# STEP 6: Verification
# ===============================================
echo ""
echo -e "${BLUE}═══ Step 6: Verification ═══${NC}"
echo ""

if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
    echo "Running verification queries..."
    echo ""
    
    echo "Checking geocoding status..."
    psql "$DATABASE_URL" -c "
        SELECT 
            table_name,
            geocode_status,
            COUNT(*) as count
        FROM geocoding_queue
        GROUP BY table_name, geocode_status
        ORDER BY table_name, geocode_status;
    " 2>/dev/null || echo "Could not connect to database"
    
    echo ""
    echo "Testing distance calculation..."
    psql "$DATABASE_URL" -c "
        SELECT 
            'Kigali to Nairobi' as route,
            ROUND(calculate_distance_km(-1.9442, 30.0619, -1.2864, 36.8172)::numeric, 1) as distance_km;
    " 2>/dev/null || echo "Could not test distance function"
else
    echo -e "${YELLOW}⚠ Cannot run automated verification${NC}"
    echo "Please verify manually using the SQL queries in:"
    echo "  supabase/migrations/verify_geolocation_setup.sql"
fi

# ===============================================
# COMPLETION
# ===============================================
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║              Deployment Complete! 🎉                       ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Check geocoding results:"
echo "   ${BLUE}SELECT * FROM geocoding_queue;${NC}"
echo ""
echo "2. Test distance functions:"
echo "   ${BLUE}SELECT * FROM nearby_bars(-1.9442, 30.0619, 5.0, 10);${NC}"
echo ""
echo "3. View documentation:"
echo "   - Quick Start: ${BLUE}GEOLOCATION_QUICKSTART.md${NC}"
echo "   - Full Guide: ${BLUE}GEOLOCATION_IMPLEMENTATION.md${NC}"
echo "   - Review Report: ${BLUE}GEOLOCATION_REVIEW_REPORT.md${NC}"
echo ""
echo "4. Integrate in your app:"
echo "   See examples in the documentation files above"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
echo ""
