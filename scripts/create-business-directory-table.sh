#!/bin/bash

# Business Directory Table Creation Script
# This script will guide you through creating the business_directory table

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║     Business Directory Table Creation                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

SQL_FILE="supabase/migrations/20251121153900_create_business_directory.sql"

echo "📋 This script will help you create the business_directory table."
echo ""
echo "Option 1: Via Supabase Dashboard (Easiest)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Open your Supabase Dashboard"
echo "2. Go to SQL Editor (left sidebar)"
echo "3. Click 'New Query'"
echo "4. Copy the contents of: $SQL_FILE"
echo "5. Paste into the editor"
echo "6. Click 'Run'"
echo ""
echo "The SQL is ready to copy here:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$SQL_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Option 2: Copy SQL to clipboard (macOS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if command -v pbcopy &> /dev/null; then
    cat "$SQL_FILE" | pbcopy
    echo "✅ SQL has been copied to your clipboard!"
    echo "   Just paste it into Supabase Dashboard SQL Editor and run."
else
    echo "⚠️  pbcopy not available. Please manually copy the SQL above."
fi
echo ""

echo "Option 3: Via psql (if you have database connection)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "If you have the DATABASE_URL environment variable set:"
echo ""
echo "  psql \$DATABASE_URL -f $SQL_FILE"
echo ""

echo "✨ After running the SQL, verify with:"
echo "   SELECT COUNT(*) FROM business_directory;"
echo ""
