#!/bin/bash
set -euo pipefail

# Jest to Vitest Migration Script
# Usage: ./scripts/migration/migrate-jest-to-vitest.sh <service-name>

SERVICE=${1:-}

if [ -z "$SERVICE" ]; then
  echo "Usage: $0 <service-name>"
  echo ""
  echo "Example: $0 wallet-service"
  echo ""
  echo "Available services to migrate:"
  for dir in services/*/; do
    service=$(basename "$dir")
    if grep -q '"jest"' "$dir/package.json" 2>/dev/null; then
      echo "  - $service"
    fi
  done
  exit 1
fi

SERVICE_DIR="services/$SERVICE"

if [ ! -d "$SERVICE_DIR" ]; then
  echo "❌ Service not found: $SERVICE_DIR"
  exit 1
fi

echo "🔄 Migrating $SERVICE from Jest to Vitest..."
echo ""

# Step 1: Check current state
echo "📋 Step 1: Analyzing current setup..."
if ! grep -q '"jest"' "$SERVICE_DIR/package.json"; then
  echo "   ⚠️  Service doesn't use Jest, skipping"
  exit 0
fi

# Step 2: Update package.json
echo "📦 Step 2: Updating package.json..."

# Read current package.json
PKG_JSON="$SERVICE_DIR/package.json"
TMP_JSON=$(mktemp)

# Use jq to update dependencies and scripts
jq '
  # Remove Jest dependencies
  .devDependencies |= with_entries(
    select(.key | test("^(jest|@types/jest|ts-jest|@jest/)") | not)
  ) |
  
  # Add Vitest dependencies
  .devDependencies["vitest"] = "^3.2.4" |
  .devDependencies["@vitejs/plugin-react"] = "^4.7.0" |
  
  # Update test scripts
  .scripts.test = "vitest run" |
  .scripts["test:watch"] = "vitest" |
  .scripts["test:coverage"] = "vitest run --coverage"
' "$PKG_JSON" > "$TMP_JSON"

mv "$TMP_JSON" "$PKG_JSON"
echo "   ✅ package.json updated"

# Step 3: Create vitest.config.ts
echo "⚙️  Step 3: Creating vitest.config.ts..."

cat > "$SERVICE_DIR/vitest.config.ts" << 'EOF'
import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared';
import path from 'path';

export default mergeConfig(nodeConfig, defineConfig({
  test: {
    root: __dirname,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      thresholds: {
        global: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}));
EOF

echo "   ✅ vitest.config.ts created"

# Step 4: Create test setup file if needed
if [ ! -f "$SERVICE_DIR/test/setup.ts" ]; then
  echo "📝 Step 4: Creating test setup..."
  mkdir -p "$SERVICE_DIR/test"
  
  cat > "$SERVICE_DIR/test/setup.ts" << 'EOF'
import { beforeAll, afterAll, afterEach } from 'vitest';

// Setup runs before all tests
beforeAll(() => {
  // Global setup
});

// Cleanup after all tests
afterAll(() => {
  // Global cleanup
});

// Cleanup after each test
afterEach(() => {
  // Per-test cleanup
});
EOF
  
  echo "   ✅ test/setup.ts created"
else
  echo "📝 Step 4: test/setup.ts already exists"
fi

# Step 5: Transform test files
echo "🔧 Step 5: Transforming test files..."

TEST_FILES=$(find "$SERVICE_DIR" -name "*.test.ts" -o -name "*.spec.ts" | grep -v node_modules)
COUNT=0

for file in $TEST_FILES; do
  echo "   📄 $file"
  
  # Transform Jest to Vitest
  sed -i '' \
    -e "s/from '@jest\/globals'/from 'vitest'/g" \
    -e "s/from 'jest'/from 'vitest'/g" \
    -e 's/jest\.fn/vi.fn/g' \
    -e 's/jest\.mock/vi.mock/g' \
    -e 's/jest\.spyOn/vi.spyOn/g' \
    -e 's/jest\.clearAllMocks/vi.clearAllMocks/g' \
    -e 's/jest\.resetAllMocks/vi.resetAllMocks/g' \
    -e 's/jest\.restoreAllMocks/vi.restoreAllMocks/g' \
    -e 's/jest\.useFakeTimers/vi.useFakeTimers/g' \
    -e 's/jest\.useRealTimers/vi.useRealTimers/g' \
    -e 's/jest\.advanceTimersByTime/vi.advanceTimersByTime/g' \
    -e 's/jest\.runAllTimers/vi.runAllTimers/g' \
    -e 's/jest\.requireActual/vi.importActual/g' \
    -e 's/jest\.requireMock/vi.importMock/g' \
    "$file"
  
  # Add vitest import if using vi. but no import
  if grep -q 'vi\.' "$file" && ! grep -q "from 'vitest'" "$file"; then
    # Add import at top
    echo "import { vi } from 'vitest';" | cat - "$file" > temp && mv temp "$file"
  fi
  
  COUNT=$((COUNT + 1))
done

echo "   ✅ Transformed $COUNT test files"

# Step 6: Remove jest.config.js if exists
if [ -f "$SERVICE_DIR/jest.config.js" ]; then
  echo "🗑️  Step 6: Removing jest.config.js..."
  rm "$SERVICE_DIR/jest.config.js"
  echo "   ✅ jest.config.js removed"
else
  echo "📋 Step 6: No jest.config.js to remove"
fi

# Step 7: Install dependencies
echo "📦 Step 7: Installing dependencies..."
(cd "$SERVICE_DIR" && pnpm install --prefer-offline) > /dev/null 2>&1
echo "   ✅ Dependencies installed"

# Step 8: Run tests
echo "🧪 Step 8: Running tests..."
if (cd "$SERVICE_DIR" && pnpm test); then
  echo "   ✅ Tests passing!"
else
  echo "   ⚠️  Tests failed - manual fixes may be needed"
  echo ""
  echo "Common issues:"
  echo "  - Mock syntax differences"
  echo "  - Setup/teardown timing"
  echo "  - Module mocking differences"
  echo ""
  echo "Review test output above and fix issues in:"
  echo "  $SERVICE_DIR"
fi

echo ""
echo "=========================================="
echo "✅ Migration complete for $SERVICE"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review changes: git diff $SERVICE_DIR"
echo "2. Fix any failing tests"
echo "3. Commit: git add $SERVICE_DIR && git commit -m 'chore($SERVICE): migrate from Jest to Vitest'"
