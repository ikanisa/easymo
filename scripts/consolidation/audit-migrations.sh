#!/bin/bash
# Migration Folder Audit Script
# Analyzes all migration folders and identifies duplicates, conflicts, and canonical set

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

AUDIT_DIR="$REPO_ROOT/.consolidation-audit/migrations-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$AUDIT_DIR"

echo "========================================"
echo "Migration Folder Audit"
echo "========================================"
echo "Audit directory: $AUDIT_DIR"
echo ""

# Find all migration folders
MIGRATION_FOLDERS=(
    "supabase/migrations"
    "supabase/migrations/ibimina"
    "supabase/migrations/phased"
    "supabase/migrations/_disabled"
    "supabase/migrations/backup_20251114_104454"
    "supabase/migrations-deleted"
    "supabase/migrations-fixed"
    "supabase/migrations__archive"
    "migrations"
)

echo "## Migration Folders Analysis" > "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"
echo "**Date:** $(date)" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

# Analyze each folder
for folder in "${MIGRATION_FOLDERS[@]}"; do
    if [ -d "$folder" ]; then
        echo "### $folder" >> "$AUDIT_DIR/audit-report.md"
        
        # Count SQL files
        sql_count=$(find "$folder" -name "*.sql" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "- **SQL files:** $sql_count" >> "$AUDIT_DIR/audit-report.md"
        
        # List files with sizes
        echo "- **Files:**" >> "$AUDIT_DIR/audit-report.md"
        find "$folder" -name "*.sql" -type f -exec ls -lh {} \; 2>/dev/null | \
            awk '{print "  - " $9 " (" $5 ")"}' >> "$AUDIT_DIR/audit-report.md" || true
        
        # Copy files to audit directory for comparison
        mkdir -p "$AUDIT_DIR/$(dirname "$folder")"
        cp -r "$folder" "$AUDIT_DIR/$folder" 2>/dev/null || true
        
        echo "" >> "$AUDIT_DIR/audit-report.md"
    else
        echo "### $folder" >> "$AUDIT_DIR/audit-report.md"
        echo "- **Status:** NOT FOUND" >> "$AUDIT_DIR/audit-report.md"
        echo "" >> "$AUDIT_DIR/audit-report.md"
    fi
done

# Find duplicate migration files (same name, different content)
echo "## Duplicate Analysis" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

find supabase/migrations* migrations/ -name "*.sql" -type f 2>/dev/null | \
    xargs -I {} basename {} | sort | uniq -d > "$AUDIT_DIR/duplicate-names.txt" || true

if [ -s "$AUDIT_DIR/duplicate-names.txt" ]; then
    echo "### Duplicate Migration Names" >> "$AUDIT_DIR/audit-report.md"
    while read -r filename; do
        echo "#### $filename" >> "$AUDIT_DIR/audit-report.md"
        find supabase/migrations* migrations/ -name "$filename" -type f 2>/dev/null | \
            while read -r filepath; do
                size=$(ls -lh "$filepath" | awk '{print $5}')
                md5=$(md5 -q "$filepath" 2>/dev/null || md5sum "$filepath" | awk '{print $1}')
                echo "- \`$filepath\` (Size: $size, MD5: ${md5:0:8}...)" >> "$AUDIT_DIR/audit-report.md"
            done
        echo "" >> "$AUDIT_DIR/audit-report.md"
    done < "$AUDIT_DIR/duplicate-names.txt"
else
    echo "✅ No duplicate migration names found" >> "$AUDIT_DIR/audit-report.md"
    echo "" >> "$AUDIT_DIR/audit-report.md"
fi

# Generate canonical migration list (from main folder)
echo "## Canonical Migration Set (supabase/migrations/)" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"
echo "**Total migrations:** $(find supabase/migrations -maxdepth 1 -name "*.sql" -type f | wc -l | tr -d ' ')" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

find supabase/migrations -maxdepth 1 -name "*.sql" -type f | sort | \
    while read -r filepath; do
        filename=$(basename "$filepath")
        size=$(ls -lh "$filepath" | awk '{print $5}')
        echo "- \`$filename\` ($size)" >> "$AUDIT_DIR/audit-report.md"
    done

echo "" >> "$AUDIT_DIR/audit-report.md"
echo "## Summary" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"
echo "- **Total migration folders:** ${#MIGRATION_FOLDERS[@]}" >> "$AUDIT_DIR/audit-report.md"
echo "- **Total SQL files:** $(find supabase/migrations* migrations/ -name "*.sql" -type f 2>/dev/null | wc -l | tr -d ' ')" >> "$AUDIT_DIR/audit-report.md"
echo "- **Canonical migrations:** $(find supabase/migrations -maxdepth 1 -name "*.sql" -type f | wc -l | tr -d ' ')" >> "$AUDIT_DIR/audit-report.md"
echo "" >> "$AUDIT_DIR/audit-report.md"

echo "✅ Audit complete!"
echo ""
echo "📊 Report: $AUDIT_DIR/audit-report.md"
echo "📁 Backup: $AUDIT_DIR/"
echo ""
echo "Next steps:"
echo "1. Review the audit report"
echo "2. Run: ./scripts/consolidation/consolidate-migrations.sh"
