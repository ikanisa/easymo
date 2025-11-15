#!/bin/bash
set -e

echo "🔍 Testing Insurance Admin Notification System"
echo "=============================================="
echo ""

# Check migration file
echo "✓ Checking migration file..."
if [ -f "supabase/migrations/20260502000000_insurance_admin_notifications.sql" ]; then
  echo "  ✓ Migration file exists"
  grep -q "insurance_admins" supabase/migrations/20260502000000_insurance_admin_notifications.sql && echo "  ✓ insurance_admins table defined"
  grep -q "250793094876" supabase/migrations/20260502000000_insurance_admin_notifications.sql && echo "  ✓ Admin numbers inserted"
else
  echo "  ✗ Migration file not found"
  exit 1
fi

echo ""
echo "✓ Checking admin notification module..."
if [ -f "supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts" ]; then
  echo "  ✓ ins_admin_notify.ts exists"
  grep -q "notifyInsuranceAdmins" supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts && echo "  ✓ notifyInsuranceAdmins function defined"
  grep -q "insurance_admins" supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts && echo "  ✓ Queries insurance_admins table"
  grep -q "wa.me" supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts && echo "  ✓ Includes WhatsApp contact link"
else
  echo "  ✗ Admin notification module not found"
  exit 1
fi

echo ""
echo "✓ Checking OCR processor integration..."
if grep -q "notifyInsuranceAdmins" supabase/functions/insurance-ocr/index.ts; then
  echo "  ✓ OCR processor imports notifyInsuranceAdmins"
  grep -A 10 "status: \"succeeded\"" supabase/functions/insurance-ocr/index.ts | grep -q "notifyInsuranceAdmins" && echo "  ✓ Admin notification called on success"
else
  echo "  ✗ OCR processor not integrated"
  exit 1
fi

echo ""
echo "✓ Checking handler integration..."
if grep -q "notifyInsuranceAdmins" supabase/functions/wa-webhook/domains/insurance/ins_handler.ts; then
  echo "  ✓ Handler imports notifyInsuranceAdmins"
  grep -A 5 "async function notifyAdmins" supabase/functions/wa-webhook/domains/insurance/ins_handler.ts | grep -q "notifyInsuranceAdmins" && echo "  ✓ Uses new admin notification system"
else
  echo "  ✗ Handler not integrated"
  exit 1
fi

echo ""
echo "✓ Checking TypeScript types..."
deno check supabase/functions/wa-webhook/domains/insurance/ins_admin_notify.ts 2>&1 | grep -q "error" && {
  echo "  ✗ Type errors found"
  exit 1
} || echo "  ✓ No type errors"

echo ""
echo "=============================================="
echo "✅ All checks passed!"
echo ""
echo "📋 Summary:"
echo "  • Migration creates insurance_admins table"
echo "  • Three admin numbers configured:"
echo "    - +250793094876 (Admin 1)"
echo "    - +250788767816 (Admin 2)"  
echo "    - +250795588248 (Admin 3)"
echo "  • Admin notifications include:"
echo "    - Full extracted certificate details"
echo "    - Customer WhatsApp contact link"
echo "    - Direct wa.me link for easy contact"
echo "  • Notifications sent via notifications table"
echo "  • Both OCR processor and handler integrated"
echo ""
echo "🚀 Next steps:"
echo "  1. Deploy migration: supabase db push"
echo "  2. Deploy functions: supabase functions deploy insurance-ocr"
echo "  3. Deploy functions: supabase functions deploy wa-webhook"
echo ""
