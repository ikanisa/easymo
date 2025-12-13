#!/bin/bash
# ============================================================================
# MOBILITY TABLES BACKUP SCRIPT
# ============================================================================
# Purpose: Backup all mobility-related tables before consolidation
# Run this BEFORE running any migration
# ============================================================================

set -e  # Exit on error

BACKUP_DIR="./backups/mobility_consolidation_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "============================================================================"
echo "MOBILITY TABLES BACKUP"
echo "============================================================================"
echo ""
echo "Backup directory: $BACKUP_DIR"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable not set"
  echo "Please set it and try again:"
  echo "  export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
  exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# List of tables to backup
TABLES=(
  "trips"
  "rides_trips"
  "mobility_trips"
  "mobility_matches"
  "mobility_trip_matches"
  "ride_notifications"
  "trip_payment_requests"
  "trip_status_audit"
  "recurring_trips"
  "mobility_intents"
  "mobility_driver_metrics"
  "mobility_passenger_metrics"
  "mobility_pricing_config"
)

echo "Backing up tables..."
echo ""

BACKED_UP=0
SKIPPED=0

for table in "${TABLES[@]}"; do
  # Check if table exists
  EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$table';" 2>/dev/null || echo "0")
  
  if [ "$EXISTS" -eq 1 ]; then
    echo "  → Backing up $table..."
    
    # Backup table structure
    pg_dump "$DATABASE_URL" \
      --schema-only \
      --table="public.$table" \
      --no-owner \
      --no-privileges \
      > "$BACKUP_DIR/${table}_schema.sql" 2>/dev/null || {
        echo "    ✗ Failed to backup schema for $table"
        continue
      }
    
    # Backup table data
    pg_dump "$DATABASE_URL" \
      --data-only \
      --table="public.$table" \
      --no-owner \
      --no-privileges \
      > "$BACKUP_DIR/${table}_data.sql" 2>/dev/null || {
        echo "    ✗ Failed to backup data for $table"
        continue
      }
    
    # Get row count
    ROW_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM public.$table;" 2>/dev/null || echo "0")
    echo "    ✓ Backed up $table ($ROW_COUNT rows)"
    
    BACKED_UP=$((BACKED_UP + 1))
  else
    echo "  ⊘ Skipping $table (not found)"
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "============================================================================"
echo "BACKUP SUMMARY"
echo "============================================================================"
echo "  Tables backed up: $BACKED_UP"
echo "  Tables skipped: $SKIPPED"
echo "  Backup location: $BACKUP_DIR"
echo ""

# Create manifest file
cat > "$BACKUP_DIR/MANIFEST.txt" << EOF
MOBILITY TABLES BACKUP
======================
Date: $(date)
Database: $DATABASE_URL
Tables backed up: $BACKED_UP
Tables skipped: $SKIPPED

Files:
EOF

ls -lh "$BACKUP_DIR"/*.sql >> "$BACKUP_DIR/MANIFEST.txt" 2>/dev/null || true

echo "Manifest created: $BACKUP_DIR/MANIFEST.txt"
echo ""

# Create restore script
cat > "$BACKUP_DIR/RESTORE.sh" << 'EOF'
#!/bin/bash
# Restore script for mobility tables backup

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

echo "WARNING: This will restore backed up tables"
echo "Current tables will be DROPPED if they exist!"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for schema_file in "$SCRIPT_DIR"/*_schema.sql; do
  if [ -f "$schema_file" ]; then
    TABLE_NAME=$(basename "$schema_file" _schema.sql)
    DATA_FILE="$SCRIPT_DIR/${TABLE_NAME}_data.sql"
    
    echo "Restoring $TABLE_NAME..."
    
    # Drop existing table
    psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS public.$TABLE_NAME CASCADE;" 2>/dev/null || true
    
    # Restore schema
    psql "$DATABASE_URL" -f "$schema_file" || {
      echo "Failed to restore schema for $TABLE_NAME"
      continue
    }
    
    # Restore data if exists
    if [ -f "$DATA_FILE" ]; then
      psql "$DATABASE_URL" -f "$DATA_FILE" || {
        echo "Failed to restore data for $TABLE_NAME"
        continue
      }
    fi
    
    echo "✓ Restored $TABLE_NAME"
  fi
done

echo "Restore complete!"
EOF

chmod +x "$BACKUP_DIR/RESTORE.sh"
echo "Restore script created: $BACKUP_DIR/RESTORE.sh"
echo ""

# Calculate total backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "Total backup size: $BACKUP_SIZE"
echo ""

echo "============================================================================"
echo "BACKUP COMPLETE ✓"
echo ""
echo "To restore from backup:"
echo "  cd $BACKUP_DIR"
echo "  ./RESTORE.sh"
echo ""
echo "Next step: Review assessment report, then run consolidation migration"
echo "============================================================================"
