#!/bin/bash
#
# Bar Menu Items Upload Script
# This script uploads menu items from CSV to Supabase
# 
# Usage:
#   1. Save your CSV data to: bar_menu_items_full.csv
#   2. Run: ./upload_menu_to_supabase.sh
#

set -e

# Database connection details
DB_URL="postgresql://postgres:Pq0jyevTlfoa376P@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
MIGRATION_FILE="supabase/migrations/20251206170000_upload_bar_menu_items.sql"

echo "==================================================================="
echo "Bar Menu Items Upload Script"
echo "==================================================================="
echo ""

# Step 1: Generate SQL from CSV
echo "[1/3] Generating SQL migration from CSV data..."
python3 <<'EOFPYTHON' > "$MIGRATION_FILE"
import csv
import sys

# Read CSV from file (you'll create this file with your full data)
csv_file = "bar_menu_items_full.csv"

print("""-- =====================================================
-- UPLOAD BAR MENU ITEMS FROM CSV  
-- Created: 2025-12-06
-- =====================================================

BEGIN;

INSERT INTO public.bar_menu_items (bar_id, bar_name, item_name, price, category, is_available)
VALUES""")

try:
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        values = []
        count = 0
        
        for row in reader:
            bar_id = row['bar_id'].strip()
            bar_name = row['bar name'].strip().replace("'", "''")
            item_name = row['item name'].strip().replace("'", "''")
            price = row['price'].strip()
            category = row['category'].strip().replace("'", "''")
            
            value = f"('{bar_id}', '{bar_name}', '{item_name}', {price}, '{category}', true)"
            values.append(value)
            count += 1
        
        print(',\n'.join(values))
        print(f"""
ON CONFLICT (bar_id, item_name, category) 
DO UPDATE SET 
    price = EXCLUDED.price,
    bar_name = EXCLUDED.bar_name,
    is_available = EXCLUDED.is_available,
    updated_at = timezone('utc', now());

COMMIT;""")
        
        print(f"-- Total items processed: {count}", file=sys.stderr)
        
except FileNotFoundError:
    print(f"ERROR: File '{csv_file}' not found!", file=sys.stderr)
    print("Please create the file with your CSV data (with header: bar name,bar_id,item name,price,category)", file=sys.stderr)
    sys.exit(1)
EOFPYTHON

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to generate SQL migration"
    exit 1
fi

echo "✓ SQL migration generated: $MIGRATION_FILE"
echo ""

# Step 2: Apply migration using Supabase CLI
echo "[2/3] Applying migration to Supabase..."
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    supabase db push
else
    echo "Supabase CLI not found, using psql..."
    if command -v psql &> /dev/null; then
        psql "$DB_URL" -f "$MIGRATION_FILE"
    else
        echo "ERROR: Neither supabase CLI nor psql found!"
        echo "Please install one of them or run the migration manually."
        exit 1
    fi
fi

echo "✓ Migration applied successfully"
echo ""

# Step 3: Verify upload
echo "[3/3] Verifying upload..."
psql "$DB_URL" -c "SELECT bar_name, COUNT(*) as items FROM bar_menu_items GROUP BY bar_name ORDER BY bar_name;" 2>/dev/null || echo "Note: Could not verify (psql not available)"

echo ""
echo "==================================================================="
echo "✓ Upload complete!"
echo "==================================================================="
echo ""
echo "Next steps:"
echo "  - Review the migration file: $MIGRATION_FILE"
echo "  - Query menu items: SELECT * FROM bar_menu_items LIMIT 10;"
echo "  - Use helper functions: SELECT * FROM get_bar_menu_items('<bar_id>');"
