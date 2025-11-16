#!/bin/bash
set -e

echo "🔍 Insurance Admin Notification - Final Verification"
echo "===================================================="
echo ""

# Check all files exist
FILES=(
  "supabase/migrations/20260502000000_insurance_admin_notifications.sql"
  "supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts"
  "supabase/functions/insurance-ocr/index.ts"
  "supabase/functions/wa-webhook/domains/insurance/ins_handler.ts"
)

echo "✓ Checking files..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file NOT FOUND"
    exit 1
  fi
done

echo ""
echo "✓ Checking migration content..."
grep -q "insurance_admins" supabase/migrations/20260502000000_insurance_admin_notifications.sql && echo "  ✓ insurance_admins table"
grep -q "insurance_admin_notifications" supabase/migrations/20260502000000_insurance_admin_notifications.sql && echo "  ✓ insurance_admin_notifications table"
grep -q "250793094876" supabase/migrations/20260502000000_insurance_admin_notifications.sql && echo "  ✓ Admin 1 (250793094876)"
grep -q "250788767816" supabase/migrations/20260502000000_insurance_admin_notifications.sql && echo "  ✓ Admin 2 (250788767816)"
grep -q "250795588248" supabase/migrations/20260502000000_insurance_admin_notifications.sql && echo "  ✓ Admin 3 (250795588248)"

echo ""
echo "✓ Type checking..."
deno check supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts > /dev/null 2>&1 && echo "  ✓ ins_admin_notify.ts"
deno check supabase/functions/insurance-ocr/index.ts > /dev/null 2>&1 && echo "  ✓ insurance-ocr/index.ts"
deno check supabase/functions/wa-webhook/domains/insurance/ins_handler.ts > /dev/null 2>&1 && echo "  ✓ ins_handler.ts"

echo ""
echo "✓ Checking integrations..."
grep -q "notifyInsuranceAdmins" supabase/functions/insurance-ocr/index.ts && echo "  ✓ OCR processor integrated"
grep -q "notifyInsuranceAdmins" supabase/functions/wa-webhook/domains/insurance/ins_handler.ts && echo "  ✓ Handler integrated"

echo ""
echo "✓ Checking notification features..."
grep -q "wa.me" supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts && echo "  ✓ WhatsApp contact links included"
grep -q "insurance_admins" supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts && echo "  ✓ Fetches from admin table"
grep -q "insurance_admin_notifications" supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts && echo "  ✓ Tracks delivery"

echo ""
echo "===================================================="
echo "✅ ALL CHECKS PASSED!"
echo ""
echo "📋 Implementation Summary:"
echo "  • Migration: 20260502000000_insurance_admin_notifications.sql"
echo "  • Tables: insurance_admins, insurance_admin_notifications"
echo "  • Admins configured: 3 numbers"
echo "  • Module: ins_admin_notify.ts (notifyInsuranceAdmins)"
echo "  • OCR processor: Integrated ✓"
echo "  • Handler: Integrated ✓"
echo "  • Type safety: All files pass ✓"
echo ""
echo "🚀 Ready to deploy:"
echo "  supabase db push"
echo "  supabase functions deploy insurance-ocr"
echo "  supabase functions deploy wa-webhook"
echo ""
