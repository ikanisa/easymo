#!/bin/bash
# Apply the icon update to Buy & Sell menu name
# Run this script to update the database directly

echo "🔄 Updating Buy & Sell menu name to include 🛒 emoji..."
echo ""

# Apply the migration
npx supabase db push --include 20251210065800_add_icon_to_buy_sell_name.sql

echo ""
echo "✅ Migration applied!"
echo ""
echo "The menu item name is now: '🛒 Buy and Sell'"
echo ""
echo "To verify, check the WhatsApp home menu - the emoji should appear before 'Buy and Sell'"
