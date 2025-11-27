#!/bin/bash
# Deploy OCR jobs table fix
# Fixes: Could not find the table 'public.ocr_jobs' in the schema cache

set -e

echo "🔧 Deploying OCR Jobs Table Fix..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   brew install supabase/tap/supabase"
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")"

echo "📋 Migrations to apply:"
echo "  1. 20251123193200_create_ocr_jobs_table.sql"
echo "  2. 20251123193300_create_menu_upload_requests_table.sql"
echo ""

# Apply migrations
echo "🚀 Applying migrations..."
supabase db push

echo ""
echo "✅ Migrations applied successfully!"
echo ""
echo "🔍 Verifying tables..."

# Verify tables exist
supabase db execute --sql "
SELECT 
  tablename, 
  schemaname 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('ocr_jobs', 'menu_upload_requests')
ORDER BY tablename;
"

echo ""
echo "✨ OCR Jobs Table Fix deployment complete!"
echo ""
echo "The following features are now enabled:"
echo "  ✓ Vendor menu upload via WhatsApp"
echo "  ✓ Restaurant menu upload workflow"
echo "  ✓ OCR processing job queue"
echo ""
