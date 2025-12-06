#!/bin/bash
#
# Bar Menu Upload Helper - Interactive Script
# Makes uploading bar menu items super easy!
#

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Bar Menu Items Upload Helper${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}⚠️  Python 3 not found. Please install Python 3.${NC}"
    exit 1
fi

echo -e "${GREEN}Step 1: Prepare Your CSV Data${NC}"
echo "Your CSV should have these columns:"
echo "  bar name,bar_id,item name,price,category"
echo ""
echo "Options:"
echo "  1) I have a CSV file ready"
echo "  2) I'll paste CSV data directly into the Python script"
echo ""
read -p "Choose option (1 or 2): " option

if [ "$option" == "1" ]; then
    read -p "Enter path to your CSV file: " csv_file
    
    if [ ! -f "$csv_file" ]; then
        echo -e "${YELLOW}⚠️  File not found: $csv_file${NC}"
        exit 1
    fi
    
    # Count lines
    line_count=$(wc -l < "$csv_file")
    echo -e "${GREEN}✓ Found CSV with $line_count lines${NC}"
    
    # Generate SQL
    echo ""
    echo -e "${GREEN}Step 2: Generating SQL migration...${NC}"
    
    python3 <<EOFPYTHON > supabase/migrations/20251206170000_upload_bar_menu_items.sql
import csv
import sys

print("""-- =====================================================
-- BAR MENU ITEMS UPLOAD
-- Generated: 2025-12-06
-- =====================================================

BEGIN;

INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)
VALUES""")

with open('$csv_file', 'r') as f:
    reader = csv.DictReader(f)
    values = []
    for row in reader:
        bar_id = row['bar_id'].strip()
        bar_name = row['bar name'].strip().replace("'", "''")
        item_name = row['item name'].strip().replace("'", "''")
        price = row['price'].strip()
        category = row['category'].strip().replace("'", "''")
        values.append(f"('{bar_id}', '{bar_name}', '{item_name}', {price}, '{category}', true)")
    
    print(',\n'.join(values))

print("""
ON CONFLICT (bar_id, item_name, category) 
DO UPDATE SET 
    price = EXCLUDED.price,
    bar_name = EXCLUDED.bar_name,
    is_available = EXCLUDED.is_available,
    updated_at = timezone('utc', now());

COMMIT;""")
EOFPYTHON

    echo -e "${GREEN}✓ SQL migration generated${NC}"
    
elif [ "$option" == "2" ]; then
    echo ""
    echo -e "${YELLOW}Please edit the file: complete_menu_upload.py${NC}"
    echo "  1. Open: nano complete_menu_upload.py"
    echo "  2. Find FULL_CSV_DATA variable"
    echo "  3. Replace with your complete CSV data"
    echo "  4. Save and exit"
    echo ""
    read -p "Press Enter when ready to generate SQL..."
    
    # Generate SQL
    python3 complete_menu_upload.py > supabase/migrations/20251206170000_upload_bar_menu_items.sql
    echo -e "${GREEN}✓ SQL migration generated${NC}"
else
    echo -e "${YELLOW}Invalid option${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 3: Review Generated SQL${NC}"
echo "Migration file: supabase/migrations/20251206170000_upload_bar_menu_items.sql"
read -p "View first 20 lines? (y/n): " view_sql

if [ "$view_sql" == "y" ]; then
    head -20 supabase/migrations/20251206170000_upload_bar_menu_items.sql
    echo "..."
    echo "(File has more lines)"
    echo ""
fi

echo ""
echo -e "${GREEN}Step 4: Apply to Database${NC}"
echo "Choose deployment method:"
echo "  1) Use Supabase CLI (recommended)"
echo "  2) Use psql directly"
echo "  3) Skip for now (I'll apply manually)"
echo ""
read -p "Choose option (1, 2, or 3): " deploy_option

if [ "$deploy_option" == "1" ]; then
    echo ""
    echo "Setting up Supabase CLI..."
    export SUPABASE_DB_PASSWORD=Pq0jyevTlfoa376P
    export SUPABASE_ACCESS_TOKEN=sbp_500607f0d078e919aa24f179473291544003a035
    
    echo "Running: supabase db push"
    supabase db push
    
    echo -e "${GREEN}✓ Migration applied!${NC}"
    
elif [ "$deploy_option" == "2" ]; then
    echo ""
    DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
    
    if command -v psql &> /dev/null; then
        echo "Running: psql ... -f migration.sql"
        psql "$DB_URL" -f supabase/migrations/20251206170000_upload_bar_menu_items.sql
        echo -e "${GREEN}✓ Migration applied!${NC}"
    else
        echo -e "${YELLOW}⚠️  psql not found. Please install PostgreSQL client.${NC}"
        echo "Or run manually:"
        echo "  psql \"$DB_URL\" -f supabase/migrations/20251206170000_upload_bar_menu_items.sql"
        exit 1
    fi
    
elif [ "$deploy_option" == "3" ]; then
    echo ""
    echo "To apply manually later, run:"
    echo "  psql \"postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres\" \\"
    echo "       -f supabase/migrations/20251206170000_upload_bar_menu_items.sql"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ All Done!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "  - Verify data in Supabase dashboard"
echo "  - Run test queries (see BAR_MENU_QUICKSTART.md)"
echo "  - Integrate with your WhatsApp bot"
echo ""
echo "Documentation:"
echo "  - Quick Start: BAR_MENU_QUICKSTART.md"
echo "  - Full Guide: BAR_MENU_UPLOAD_GUIDE.md"
echo "  - Summary: BAR_MENU_ITEMS_SUMMARY.md"
echo ""
