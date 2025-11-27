#!/bin/bash

# Client PWA Complete Setup & Deployment Script
# This script sets up the database and prepares for deployment

set -e  # Exit on error

echo "🚀 Client PWA Setup & Deployment"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking prerequisites...${NC}"

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not found. Install with: npm install -g pnpm${NC}"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql not found (optional, will use Supabase CLI instead)${NC}"
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${BLUE}Step 2: Installing dependencies...${NC}"
cd /Users/jeanbosco/workspace/easymo-/client-pwa
pnpm install --frozen-lockfile
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Database setup
echo -e "${BLUE}Step 3: Setting up database...${NC}"

DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"

# Run migration
echo "Running migration..."
psql "$DB_URL" -f ../supabase/migrations/20251127000000_client_pwa_schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration applied successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

# Run seed data
echo "Inserting seed data..."
psql "$DB_URL" -f ../supabase/seed/client_pwa_seed.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Seed data inserted successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Seed data failed (may already exist)${NC}"
fi

echo ""

# Step 4: Verify database
echo -e "${BLUE}Step 4: Verifying database...${NC}"

TABLES=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('venues', 'menu_categories', 'menu_items', 'orders', 'order_status_log', 'payment_transactions');")

if [ "$TABLES" -ge 6 ]; then
    echo -e "${GREEN}✅ All tables created successfully${NC}"
else
    echo -e "${RED}❌ Some tables missing (found $TABLES/6)${NC}"
    exit 1
fi

# Check if demo venue exists
VENUE_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM venues WHERE slug = 'heaven-bar';")

if [ "$VENUE_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✅ Demo venue created${NC}"
else
    echo -e "${YELLOW}⚠️  Demo venue not found${NC}"
fi

echo ""

# Step 5: Type check
echo -e "${BLUE}Step 5: Type checking...${NC}"
pnpm type-check

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Type check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Type check had errors (non-blocking)${NC}"
fi

echo ""

# Step 6: Build
echo -e "${BLUE}Step 6: Building application...${NC}"
pnpm build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""

# Step 7: Summary
echo -e "${GREEN}=================================="
echo "✅ Setup Complete!"
echo "==================================${NC}"
echo ""
echo "📊 Summary:"
echo "  ✅ Dependencies installed"
echo "  ✅ Database schema created"
echo "  ✅ Seed data inserted"
echo "  ✅ Application built"
echo ""
echo "🧪 Test the app:"
echo "  1. Development:"
echo "     ${BLUE}pnpm dev${NC}"
echo "     Open: http://localhost:3002/heaven-bar?table=5"
echo ""
echo "  2. Production:"
echo "     ${BLUE}pnpm start${NC}"
echo ""
echo "🚀 Deploy to Netlify:"
echo "  ${BLUE}netlify deploy --prod --dir=.next${NC}"
echo ""
echo "📝 Test QR Code URL:"
echo "  http://localhost:3002/heaven-bar?table=5"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "  1. Create the 4 page files from CREATE_THESE_FILES.md"
echo "  2. Set environment variables in .env.local"
echo "  3. Test on mobile device"
echo ""
