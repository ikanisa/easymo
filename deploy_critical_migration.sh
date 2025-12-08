#!/bin/bash
# Deploy critical mobility migration directly

echo "=========================================="
echo "Deploying Critical Mobility Migration"
echo "=========================================="
echo ""

# Display the SQL file location
echo "Migration SQL: /tmp/apply_mobility_fix.sql"
echo ""
echo "This migration will:"
echo "  ✓ Fix match_drivers_for_trip_v2 function"
echo "  ✓ Fix match_passengers_for_trip_v2 function"
echo "  ✓ Add calculate_distance_km helper"
echo "  ✓ Create spatial indexes"
echo "  ✓ Fix error 42703: column p.ref_code does not exist"
echo ""
echo "Copy the SQL content and paste it into Supabase SQL Editor:"
echo "https://supabase.com/dashboard/project/lhbowpbcpwoiparwnwgt/sql/new"
echo ""
echo "Press Enter to display the SQL..."
read

cat /tmp/apply_mobility_fix.sql

echo ""
echo "=========================================="
echo "Copy the SQL above and paste into Supabase"
echo "=========================================="
