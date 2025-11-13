#!/bin/bash

echo "════════════════════════════════════════════════════════════════"
echo "  PHASE 3: ADD MISSING COLUMNS"
echo "  Status: EXECUTING..."
echo "════════════════════════════════════════════════════════════════"
echo ""

# Execute Phase 3 SQL
psql "postgresql://postgres:sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
  -f supabase/migrations/20251113171400_phase3_add_missing_columns.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ PHASE 3 COMPLETED SUCCESSFULLY!"
  echo ""
  echo "Added missing columns to:"
  echo "  - waiter_conversations"
  echo "  - waiter_messages"
  echo "  - waiter_orders"
  echo "  - waiter_reservations"
  echo "  - businesses"
  echo "  - menu_items"
  echo "  - menu_categories"
  echo ""
else
  echo ""
  echo "❌ PHASE 3 FAILED"
  echo "Check errors above"
  echo ""
fi

