#!/bin/bash
# Remove KE (Kenya) and UG (Uganda) from entire repository
# Date: 2025-11-27
# Supported countries: RW (Rwanda), CD (DRC), BI (Burundi), TZ (Tanzania)

set -e

echo "🔍 Removing KE and UG from repository..."

# Function to update country arrays in SQL files
update_sql_files() {
    echo "📝 Updating SQL migrations..."
    
    # Find all SQL files with KE or UG in arrays
    find supabase/migrations -name "*.sql" -type f | while read file; do
        if grep -q "KE\|UG" "$file" 2>/dev/null; then
            echo "  Updating: $file"
            
            # Remove KE and UG from country arrays, handle various formats
            sed -i.bak -E "s/ARRAY\['RW', 'KE', 'TZ', 'UG', 'BI', 'CD'\]/ARRAY['RW', 'CD', 'BI', 'TZ']/g" "$file"
            sed -i.bak -E "s/ARRAY\['KE', 'RW', 'TZ', 'UG', 'BI', 'CD'\]/ARRAY['RW', 'CD', 'BI', 'TZ']/g" "$file"
            sed -i.bak -E "s/ARRAY\['RW', 'KE', 'TZ', 'UG'\]/ARRAY['RW', 'TZ']/g" "$file"
            sed -i.bak -E "s/ARRAY\['RW', 'UG', 'TZ'\]/ARRAY['RW', 'TZ']/g" "$file"
            sed -i.bak -E "s/, 'KE'//g" "$file"
            sed -i.bak -E "s/, 'UG'//g" "$file"
            sed -i.bak -E "s/'KE', //g" "$file"
            sed -i.bak -E "s/'UG', //g" "$file"
            
            # Remove backup file
            rm -f "$file.bak"
        fi
    done
}

# Function to update TypeScript files
update_typescript_files() {
    echo "📝 Updating TypeScript files..."
    
    find supabase/functions -name "*.ts" -type f | while read file; do
        if grep -q "'KE'\|'UG'\|\"KE\"\|\"UG\"" "$file" 2>/dev/null; then
            echo "  Updating: $file"
            
            # Remove from arrays
            sed -i.bak -E "s/'KE', //g" "$file"
            sed -i.bak -E "s/'UG', //g" "$file"
            sed -i.bak -E "s/, 'KE'//g" "$file"
            sed -i.bak -E "s/, 'UG'//g" "$file"
            sed -i.bak -E 's/"KE", //g' "$file"
            sed -i.bak -E 's/"UG", //g' "$file"
            sed -i.bak -E 's/, "KE"//g' "$file"
            sed -i.bak -E 's/, "UG"//g' "$file"
            
            rm -f "$file.bak"
        fi
    done
}

# Function to update latest migration
update_latest_migration() {
    echo "📝 Updating latest dynamic menu migration..."
    
    local migration="supabase/migrations/20251127074300_dynamic_profile_menu_system.sql"
    if [ -f "$migration" ]; then
        echo "  Updating: $migration"
        
        # Update default country arrays
        sed -i.bak "s/ARRAY\['RW', 'KE', 'TZ', 'UG', 'BI', 'CD'\]/ARRAY['RW', 'CD', 'BI', 'TZ']/g" "$migration"
        sed -i.bak "s/ARRAY\['RW', 'KE', 'TZ', 'UG'\]/ARRAY['RW', 'TZ']/g" "$migration"
        sed -i.bak "s/ARRAY\['RW', 'UG', 'TZ'\]/ARRAY['RW', 'TZ']/g" "$migration"
        sed -i.bak "s/ARRAY\['RW', 'KE'\]/ARRAY['RW']/g" "$migration"
        
        rm -f "$migration.bak"
    fi
}

# Main execution
echo "Starting cleanup..."
update_sql_files
update_typescript_files
update_latest_migration

echo "✅ Cleanup complete!"
echo ""
echo "Summary:"
echo "  ❌ Removed: KE (Kenya), UG (Uganda)"
echo "  ✅ Supported: RW (Rwanda), CD (DRC), BI (Burundi), TZ (Tanzania)"
echo ""
echo "Please review changes with: git diff"
