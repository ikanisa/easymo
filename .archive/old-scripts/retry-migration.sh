#!/bin/bash
echo "=========================================="
echo "RETRY DATABASE MIGRATION"
echo "=========================================="
echo ""
echo "This will attempt to push all migrations to Supabase."
echo "Expected duration: 5-15 minutes"
echo ""
read -p "Press ENTER to continue, or Ctrl+C to cancel..."

echo ""
echo "Starting migration..."
supabase db push --include-all

echo ""
echo "Migration command completed."
echo ""
echo "To verify, run:"
echo "  ./verify-ai-agent-deployment.sh"
echo ""
echo "Or check Supabase Dashboard:"
echo "  https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/editor"
echo ""
