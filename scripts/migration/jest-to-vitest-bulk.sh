#!/bin/bash
set -euo pipefail

echo "🔄 Bulk Migration: Jest → Vitest"
echo "================================"

# Services still using Jest
SERVICES=(
  "agent-core"
  "attribution-service"
  "broker-orchestrator"
  "buyer-service"
  "ranking-service"
  "vendor-service"
  "whatsapp-webhook-worker"
)

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "⚠️  DRY RUN MODE - No files will be modified"
fi

migrate_service() {
  local service=$1
  local service_dir="services/$service"
  
  if [ ! -d "$service_dir" ]; then
    echo "❌ Service not found: $service_dir"
    return 1
  fi
  
  echo ""
  echo "📦 Migrating: $service"
  echo "-----------------------------------"
  
  # 1. Update package.json
  if [ -f "$service_dir/package.json" ]; then
    if [ "$DRY_RUN" = false ]; then
      # Remove jest, add vitest
      jq '
        .devDependencies = (.devDependencies // {} | 
          del(.jest, ."@types/jest", ."ts-jest") |
          . + {"vitest": "^3.2.4", "@vitest/coverage-v8": "^3.2.4"}
        ) |
        .scripts = (.scripts // {} |
          .test = "vitest run" |
          ."test:watch" = "vitest" |
          ."test:coverage" = "vitest run --coverage"
        )
      ' "$service_dir/package.json" > "$service_dir/package.json.tmp"
      mv "$service_dir/package.json.tmp" "$service_dir/package.json"
      echo "  ✅ Updated package.json"
    else
      echo "  📋 Would update package.json"
    fi
  fi
  
  # 2. Create vitest.config.ts
  if [ ! -f "$service_dir/vitest.config.ts" ]; then
    if [ "$DRY_RUN" = false ]; then
      cat > "$service_dir/vitest.config.ts" << 'EOF'
import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared';
import path from 'path';

export default mergeConfig(nodeConfig, defineConfig({
  test: {
    root: __dirname,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}));
EOF
      echo "  ✅ Created vitest.config.ts"
    else
      echo "  📋 Would create vitest.config.ts"
    fi
  fi
  
  # 3. Remove jest.config.js
  if [ -f "$service_dir/jest.config.js" ]; then
    if [ "$DRY_RUN" = false ]; then
      rm "$service_dir/jest.config.js"
      echo "  ✅ Removed jest.config.js"
    else
      echo "  📋 Would remove jest.config.js"
    fi
  fi
  
  # 4. Transform test files
  local test_count=$(find "$service_dir" -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
  if [ "$test_count" -gt 0 ]; then
    if [ "$DRY_RUN" = false ]; then
      find "$service_dir" -name "*.test.ts" -o -name "*.spec.ts" | while read -r file; do
        # Simple replacements
        sed -i '' 's/jest\.fn(/vi.fn(/g' "$file"
        sed -i '' 's/jest\.mock(/vi.mock(/g' "$file"
        sed -i '' 's/jest\.spyOn(/vi.spyOn(/g' "$file"
        sed -i '' "s/from '@jest\/globals'/from 'vitest'/g" "$file"
        
        # Add vitest import if not present
        if ! grep -q "from 'vitest'" "$file"; then
          sed -i '' "1s/^/import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';\n/" "$file"
        fi
      done
      echo "  ✅ Transformed $test_count test files"
    else
      echo "  📋 Would transform $test_count test files"
    fi
  fi
  
  echo "  ✅ Migration complete: $service"
}

# Main execution
echo ""
for service in "${SERVICES[@]}"; do
  migrate_service "$service" || echo "  ⚠️  Failed to migrate $service"
done

echo ""
echo "================================"
echo "✅ Bulk Migration Complete"
echo "================================"

if [ "$DRY_RUN" = false ]; then
  echo ""
  echo "📝 Next steps:"
  echo "1. Run: pnpm install (to install vitest deps)"
  echo "2. Test each service: pnpm --filter @easymo/<service> test"
  echo "3. Fix any failing tests"
  echo "4. Commit changes"
else
  echo ""
  echo "Run without --dry-run to apply changes"
fi
