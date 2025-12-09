#!/bin/bash

# SACCO SMS Integration - Manual Database Migration Script
# Run this if `supabase db push` is hanging

set -e

echo "============================================="
echo "SACCO SMS Integration - Database Migrations"
echo "============================================="
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed"
    echo "Install it with: brew install postgresql"
    exit 1
fi

# Prompt for database connection details
echo "Please provide your Supabase database connection details:"
echo "(You can find these in: https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/settings/database)"
echo ""

read -p "Database Password: " -s DB_PASSWORD
echo ""
echo ""

# Construct connection string
DB_URL="postgresql://postgres.lhbowpbcpwoiparwnwgt:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

echo "Testing connection..."
if ! psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Failed to connect to database"
    echo "Please check your password and try again"
    exit 1
fi

echo "✅ Connected successfully!"
echo ""

# Apply migrations
MIGRATIONS=(
    "20251209190000_create_app_schema_sacco_tables.sql"
    "20251209190001_add_sacco_webhook_support.sql"
    "20251209190002_sacco_payment_functions.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    echo "Applying: $migration"
    
    if psql "$DB_URL" -f "supabase/migrations/$migration" > /dev/null 2>&1; then
        echo "  ✅ Success"
    else
        echo "  ❌ Failed - trying to continue..."
    fi
    echo ""
done

echo "============================================="
echo "Migration Summary"
echo "============================================="
echo ""

# Verify tables
echo "Checking created tables..."
psql "$DB_URL" -c "
SELECT 
    schemaname,
    tablename
FROM pg_tables 
WHERE schemaname = 'app'
ORDER BY tablename;
" 2>/dev/null

echo ""
echo "Checking created functions..."
psql "$DB_URL" -c "
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'app'
AND routine_name LIKE '%sacco%'
ORDER BY routine_name;
" 2>/dev/null

echo ""
echo "============================================="
echo "✅ Migration Complete!"
echo "============================================="
echo ""
echo "Next steps:"
echo "1. Register SACCO webhook endpoint"
echo "2. Import member data with phone hashes"
echo "3. Test SMS payment matching"
echo ""
