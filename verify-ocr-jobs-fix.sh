#!/bin/bash
# Quick verification script for OCR jobs fix
# Checks if the required tables exist in the database

set -e

echo "🔍 Verifying OCR Jobs Fix..."
echo ""

# Check tables
echo "Checking for required tables..."
echo ""

# Query to check table existence
QUERY="
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'ocr_jobs' THEN '✅ OCR processing queue'
    WHEN table_name = 'menu_upload_requests' THEN '✅ Menu upload workflow'
    ELSE '✅ Found'
  END as description
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('ocr_jobs', 'menu_upload_requests', 'bars', 'bar_managers')
ORDER BY table_name;
"

if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    supabase db execute --sql "$QUERY"
else
    echo "⚠️  Supabase CLI not found. Please verify manually."
    echo ""
    echo "Expected tables:"
    echo "  - ocr_jobs"
    echo "  - menu_upload_requests"
    echo "  - bars (dependency)"
    echo "  - bar_managers (dependency)"
fi

echo ""
echo "📊 Table schema check:"
echo ""

# Check ocr_jobs columns
COLUMN_QUERY="
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('ocr_jobs', 'menu_upload_requests')
ORDER BY table_name, ordinal_position;
"

if command -v supabase &> /dev/null; then
    supabase db execute --sql "$COLUMN_QUERY" || echo "Table structure query failed (tables may not exist yet)"
fi

echo ""
echo "✅ Verification complete!"
