#!/bin/bash
MIGRATIONS=(
  "20251207000000_create_preferred_suppliers.sql"
  "20251207000000_omnichannel_notification_system.sql"
  "20251207000001_add_search_suppliers_tool.sql"
  "20251207000001_call_center_omnichannel_tools.sql"
  "20251207010000_omnichannel_sms_system.sql"
  "20251207120000_fix_full_name_to_display_name.sql"
  "20251207120000_qr_enhancements.sql"
  "20251207130000_add_missing_business_columns.sql"
  "20251207130000_fix_matching_display_name.sql"
  "20251207130001_fix_location_services_critical.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "$migration" ]; then
    echo "Applying $migration..."
    psql "$SUPABASE_DB_URL" -f "$migration" -v ON_ERROR_STOP=1 && echo "✓ Success" || echo "✗ Failed"
  fi
done
