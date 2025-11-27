# Phase 3 & 4 Implementation Guide

**Status**: Ready to Execute
**Duration**: 33 hours total
**Priority Order**: P0 → P1 → P2

## 🚀 Quick Start

```bash
# 1. Verify current state
pnpm install
pnpm build:deps
pnpm lint 2>&1 | tee lint-baseline.txt

# 2. Run verification scripts
bash scripts/verify/workspace-deps.sh
bash scripts/audit/typescript-versions.sh
bash scripts/audit/test-frameworks.sh

# 3. Start with P0 tasks (blocking issues)
bash scripts/phase3/01-typescript-alignment.sh
bash scripts/phase3/02-workspace-deps-fix.sh
```

## Phase 3: Code Quality (22 hours)

### Task 3.1: TypeScript Version Alignment [P0 - 2h] ⚠️ BLOCKING

**Why P0**: Breaks builds, type checking failures across packages

**Current State:**
- Root: 5.5.4 (correct)
- Most packages: 5.5.4 (correct)
- bar-manager-app: May have incorrect version
- Need pnpm overrides enforcement

**Implementation:**

```bash
# Step 1: Create audit script
cat > scripts/audit/typescript-versions.sh << 'EOF'
#!/bin/bash
set -euo pipefail

echo "🔍 Auditing TypeScript versions..."

TARGET_VERSION="5.5.4"
PACKAGES=$(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.archive/*")

for pkg in $PACKAGES; do
  TS_VERSION=$(jq -r '.devDependencies.typescript // .dependencies.typescript // "none"' "$pkg")
  if [[ "$TS_VERSION" != "none" && "$TS_VERSION" != "$TARGET_VERSION" ]]; then
    echo "❌ $pkg: $TS_VERSION (should be $TARGET_VERSION)"
  fi
done
EOF

chmod +x scripts/audit/typescript-versions.sh

# Step 2: Run audit
bash scripts/audit/typescript-versions.sh

# Step 3: Fix bar-manager-app
cd bar-manager-app
npm install --save-dev typescript@5.5.4
cd ..

# Step 4: Add pnpm overrides to root package.json
# (Already exists, verify it's there)
```

**Expected Output:**
```
✅ All packages use TypeScript 5.5.4
```

**Verification:**
```bash
pnpm --filter @easymo/bar-manager-app run type-check
```

---

### Task 3.2: Workspace Dependencies [P0 - 2h] ⚠️ BLOCKING

**Why P0**: Breaks pnpm workspace protocol, causes dependency resolution issues

**Current State:**
- Some packages use `"*"` instead of `"workspace:*"`
- admin-app likely needs fixes
- Can break builds

**Implementation:**

```bash
# Step 1: Run verification (already created)
bash scripts/verify/workspace-deps.sh

# Step 2: Auto-fix all issues
bash scripts/verify/workspace-deps.sh --fix

# Step 3: Reinstall dependencies
pnpm install --frozen-lockfile

# Step 4: Rebuild shared packages
pnpm build:deps
```

**Expected Output:**
```
✅ Fixed 3 packages with incorrect internal dependencies

Next steps:
1. Run: pnpm install ✓
2. Run: pnpm build:deps ✓
3. Commit changes
```

**Verification:**
```bash
# Should show no errors
bash scripts/verify/workspace-deps.sh
```

---

### Task 3.3: Admin App Consolidation [P1 - 4h]

**Status:** admin-app-v2 already deprecated in pnpm-workspace.yaml ✅

**Remaining Steps:**

1. **Feature Comparison** (30min)
```bash
# Create comparison document
cat > docs/admin-app-comparison.md << 'EOF'
# Admin App Feature Comparison

## admin-app (PRIMARY)
- ✅ Next.js 15.1.6
- ✅ Tauri desktop support
- ✅ Shared packages (@easymo/commons, @va/shared)
- ✅ Sentry integration
- ✅ React Query persistence
- ✅ Comprehensive test suite

## admin-app-v2 (DEPRECATED)
- Next.js 15.1.6
- ❌ No Tauri
- ❌ No shared packages
- ❌ No Sentry
- ❌ Basic tests only

## Decision: Keep admin-app, fully deprecate admin-app-v2
EOF
```

2. **Archive admin-app-v2** (1h)
```bash
# Move to archive
mkdir -p .archive/deprecated-apps
mv admin-app-v2 .archive/deprecated-apps/admin-app-v2-archived-$(date +%Y%m%d)

# Remove from pnpm-workspace (already done)
# Add note to .archive
cat > .archive/deprecated-apps/README.md << 'EOF'
# Deprecated Applications

## admin-app-v2
Archived: 2025-11-27
Reason: Duplicate of admin-app with fewer features
Migration: All functionality exists in admin-app
EOF
```

3. **Update CI/CD** (30min)
```bash
# Check .github/workflows for admin-app-v2 references
grep -r "admin-app-v2" .github/workflows/ || echo "No CI references found ✅"

# Update documentation
sed -i.bak 's/admin-app-v2/admin-app/g' README.md docs/*.md
```

4. **Verify** (1h)
```bash
pnpm install
pnpm --filter @easymo/admin-app build
pnpm --filter @easymo/admin-app test
```

---

### Task 3.4: Stray Files Relocation [P2 - 2h]

**Files to Relocate:**
- `services/audioUtils.ts` → `packages/media-utils/src/audio.ts`
- `services/gemini.ts` → `packages/ai-core/src/providers/gemini.ts`

**Implementation:**

```bash
# Step 1: Check if files exist
ls -la services/audioUtils.ts services/gemini.ts 2>&1 || echo "Files may already be moved"

# Step 2: If they exist, create new packages

# Create media-utils package
mkdir -p packages/media-utils/src
cat > packages/media-utils/package.json << 'EOF'
{
  "name": "@easymo/media-utils",
  "version": "1.0.0",
  "description": "Media processing utilities",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "5.5.4"
  }
}
EOF

# Create ai-core package (if doesn't exist)
mkdir -p packages/ai-core/src/providers

# Step 3: Move files
if [ -f services/audioUtils.ts ]; then
  mv services/audioUtils.ts packages/media-utils/src/audio.ts
fi

if [ -f services/gemini.ts ]; then
  mv services/gemini.ts packages/ai-core/src/providers/gemini.ts
fi

# Step 4: Update imports
# (Manual step - search for imports and update)
```

---

### Task 3.5: Jest → Vitest Migration [P2 - 8h]

**Target Services:**
1. wallet-service (3h)
2. profile-service (2h)
3. ranking-service (1h)
4. bar-manager-app tests (2h)

**Shared Setup** (1h):

```bash
# Create shared vitest config
cat > vitest.shared.ts << 'EOF'
import { defineConfig } from 'vitest/config';

export const nodeConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70
        }
      }
    }
  }
});
EOF
```

**Per-Service Migration** (example: wallet-service):

```bash
cd services/wallet-service

# 1. Install Vitest
pnpm add -D vitest @vitest/ui vite

# 2. Create vitest.config.ts
cat > vitest.config.ts << 'EOF'
import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared';
import path from 'path';

export default mergeConfig(nodeConfig, defineConfig({
  test: {
    root: __dirname,
    coverage: {
      thresholds: {
        global: {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90
        }
      }
    },
    testTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
}));
EOF

# 3. Update package.json scripts
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.test:coverage="vitest run --coverage"

# 4. Transform test files
find . -name "*.test.ts" -o -name "*.spec.ts" | while read file; do
  # Replace jest imports
  sed -i.bak 's/from ['\''"]jest['\''"]/from '\''vitest'\''/g' "$file"
  sed -i.bak 's/from ['\''"]@jest\/globals['\''"]/from '\''vitest'\''/g' "$file"
  
  # Replace jest.fn() with vi.fn()
  sed -i.bak 's/jest\.fn(/vi.fn(/g' "$file"
  sed -i.bak 's/jest\.mock(/vi.mock(/g' "$file"
  sed -i.bak 's/jest\.spyOn(/vi.spyOn(/g' "$file"
  
  # Add vitest import if needed
  if ! grep -q "from 'vitest'" "$file"; then
    sed -i.bak '1i\
import { vi, describe, it, expect, beforeEach, afterEach } from '\''vitest'\'';
' "$file"
  fi
  
  rm "${file}.bak"
done

# 5. Remove Jest
pnpm remove jest @types/jest ts-jest
rm jest.config.js 2>/dev/null || true

# 6. Test
pnpm test

cd ../..
```

**Repeat for:**
- services/profile
- services/ranking-service
- bar-manager-app

---

### Task 3.6: ESLint Zero Warnings [P2 - 6h]

**Breakdown:**
- Replace console.log (3h)
- Fix `any` types (2h)
- Add return types (1h)

**Step 1: Update ESLint Config** (30min)

```javascript
// eslint.config.mjs
export default [
  // ... existing config
  {
    rules: {
      // ERROR on console (was warning)
      'no-console': ['error', { allow: ['warn', 'error'] }],
      
      // ERROR on any
      '@typescript-eslint/no-explicit-any': 'error',
      
      // ERROR on missing return types
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true
      }]
    }
  }
];
```

**Step 2: Console.log Replacement** (2h 30min)

```bash
# Create replacement script
cat > scripts/maintenance/replace-console-logs.sh << 'EOF'
#!/bin/bash
set -euo pipefail

echo "🔄 Replacing console.log with structured logging..."

# Find all console.log calls
FILES=$(grep -r "console\.log" --include="*.ts" --include="*.tsx" \
  services/ packages/ apps/ admin-app/ \
  --exclude-dir=node_modules --exclude-dir=dist -l)

for file in $FILES; do
  echo "Processing: $file"
  
  # Add logger import if not present
  if ! grep -q "from '@easymo/commons'" "$file"; then
    sed -i.bak '1i\
import { childLogger } from '\''@easymo/commons'\'';
const log = childLogger({ service: '\''${file##*/}'\'' });
' "$file"
  fi
  
  # Replace console.log with log.info
  sed -i.bak 's/console\.log(/log.info(/g' "$file"
  
  rm "${file}.bak"
done

echo "✅ Replacement complete"
EOF

chmod +x scripts/maintenance/replace-console-logs.sh

# Run it (dry-run first by copying to temp)
bash scripts/maintenance/replace-console-logs.sh
```

**Step 3: Fix `any` Types** (2h)

```bash
# Find all `any` usages
grep -rn ": any" services/ packages/ apps/ --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=dist > any-types-todo.txt

# Manual fixes needed - review any-types-todo.txt
# Common patterns:
# - Use `unknown` instead of `any`
# - Add proper interfaces
# - Use generics
```

**Step 4: Verify** (30min)

```bash
pnpm lint 2>&1 | tee lint-after-fixes.txt

# Should show:
# ✅ 0 errors
# ✅ 0 warnings (except allowed console.warn/error)
```

---

## Phase 4: Documentation & Cleanup (11 hours)

### Task 4.1: Root Directory Cleanup [P1 - 3h]

**Implementation:**

```bash
# Step 1: Create directory structure
mkdir -p docs/sessions docs/architecture/diagrams docs/roadmaps docs/archive
mkdir -p scripts/deploy scripts/verify scripts/test scripts/checks
mkdir -p .archive/orphaned .archive/old-scripts

# Step 2: Move session files
find . -maxdepth 1 -name "*_COMPLETE*.md" -exec mv {} docs/sessions/ \;
find . -maxdepth 1 -name "*_STATUS*.md" -exec mv {} docs/sessions/ \;
find . -maxdepth 1 -name "*_SUMMARY*.md" -exec mv {} docs/sessions/ \;
find . -maxdepth 1 -name "*_IMPLEMENTATION*.md" -exec mv {} docs/sessions/ \;

# Step 3: Move architecture diagrams
find . -maxdepth 1 -name "*_VISUAL*.txt" -exec mv {} docs/architecture/diagrams/ \;
find . -maxdepth 1 -name "*_ROADMAP*.md" -exec mv {} docs/roadmaps/ \;

# Step 4: Consolidate scripts
find . -maxdepth 1 -name "deploy-*.sh" -exec mv {} scripts/deploy/ \;
find . -maxdepth 1 -name "verify-*.sh" -exec mv {} scripts/verify/ \;
find . -maxdepth 1 -name "test-*.sh" -exec mv {} scripts/test/ \;
find . -maxdepth 1 -name "check-*.sh" -exec mv {} scripts/checks/ \;

# Step 5: Archive orphaned files
if [ -f App.tsx ]; then mv App.tsx .archive/orphaned/; fi
if [ -f index.tsx ]; then mv index.tsx .archive/orphaned/; fi
if [ -f types.ts ]; then mv types.ts .archive/orphaned/; fi

# Step 6: Update .gitignore
cat >> .gitignore << 'EOF'

# Session files
*_SESSION_*.md
*_TEMP_*.md
*_WIP_*.md
EOF

# Step 7: Create index
cat > docs/archive/INDEX.md << 'EOF'
# Archived Content Index

Generated: $(date)

## Session Notes
$(ls -1 docs/sessions/)

## Scripts
$(ls -1 .archive/old-scripts/)
EOF
```

**Expected Outcome:**
- Root directory contains only essential config files
- All documentation organized in docs/
- All scripts in scripts/ subdirectories

---

### Task 4.2: Observability Compliance [P1 - 5h]

**Create Compliance Checker:**

```bash
cat > scripts/audit/observability-compliance.ts << 'EOF'
#!/usr/bin/env tsx
import { glob } from 'glob';
import fs from 'fs/promises';

interface ComplianceIssue {
  file: string;
  line: number;
  issue: string;
  severity: 'error' | 'warning';
}

const issues: ComplianceIssue[] = [];

async function checkFile(file: string) {
  const content = await fs.readFile(file, 'utf-8');
  const lines = content.split('\n');
  
  let hasStructuredLogging = false;
  let hasCorrelationId = false;
  
  lines.forEach((line, idx) => {
    // Check for structured logging
    if (line.includes('logStructuredEvent') || line.includes('childLogger')) {
      hasStructuredLogging = true;
    }
    
    // Check for correlation IDs
    if (line.match(/correlationId|correlation[_-]id|x-correlation-id/i)) {
      hasCorrelationId = true;
    }
    
    // Check for console.log (should be gone)
    if (line.includes('console.log(')) {
      issues.push({
        file,
        line: idx + 1,
        issue: 'console.log found - use structured logging',
        severity: 'error'
      });
    }
    
    // Check for PII logging
    if (line.match(/log.*password|log.*ssn|log.*credit/i)) {
      issues.push({
        file,
        line: idx + 1,
        issue: 'Potential PII in logs',
        severity: 'warning'
      });
    }
  });
  
  // File-level checks
  if (file.includes('services/') && !hasStructuredLogging) {
    issues.push({
      file,
      line: 1,
      issue: 'No structured logging found',
      severity: 'error'
    });
  }
  
  if (file.includes('services/') && !hasCorrelationId) {
    issues.push({
      file,
      line: 1,
      issue: 'No correlation ID handling',
      severity: 'warning'
    });
  }
}

async function main() {
  const files = await glob('services/**/*.ts', { ignore: ['**/node_modules/**', '**/dist/**'] });
  
  for (const file of files) {
    await checkFile(file);
  }
  
  console.log(`\n🔍 Observability Compliance Report\n`);
  console.log(`Total files checked: ${files.length}`);
  console.log(`Total issues: ${issues.length}\n`);
  
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  
  if (errors.length > 0) {
    console.log(`❌ Errors (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e.file}:${e.line} - ${e.issue}`));
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(w => console.log(`  ${w.file}:${w.line} - ${w.issue}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All files compliant!');
  }
  
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
EOF

chmod +x scripts/audit/observability-compliance.ts

# Run compliance check
npx tsx scripts/audit/observability-compliance.ts > compliance-report.txt
```

---

### Task 4.3: CI/CD Enhancements [P2 - 3h]

**Add to .github/workflows/ci.yml:**

```yaml
      - name: Check Workspace Dependencies
        run: bash scripts/verify/workspace-deps.sh
      
      - name: Check TypeScript Versions
        run: bash scripts/audit/typescript-versions.sh
      
      - name: Observability Compliance
        run: npx tsx scripts/audit/observability-compliance.ts
      
      - name: No Console.log
        run: |
          if grep -r "console\.log(" services/ packages/ --include="*.ts" --exclude-dir=node_modules; then
            echo "❌ Found console.log statements"
            exit 1
          fi
```

---

## Execution Checklist

### Week 1: Critical Fixes (4h)
- [ ] Task 3.1: TypeScript alignment (2h)
- [ ] Task 3.2: Workspace deps (2h)
- [ ] Commit: "fix(deps): align TypeScript 5.5.4 and workspace protocol"

### Week 1-2: Code Quality (18h)
- [ ] Task 3.3: Admin app consolidation (4h)
- [ ] Task 3.4: Stray files (2h)
- [ ] Task 3.5: Jest → Vitest (8h)
- [ ] Task 3.6: ESLint zero warnings (6h)
- [ ] Commit: "refactor: standardize testing and code quality"

### Week 2-3: Documentation (11h)
- [ ] Task 4.1: Root cleanup (3h)
- [ ] Task 4.2: Observability compliance (5h)
- [ ] Task 4.3: CI/CD enhancements (3h)
- [ ] Commit: "docs: restructure and add compliance checks"

---

## Success Criteria

✅ **All tasks complete when:**

1. **Builds succeed:**
   ```bash
   pnpm install --frozen-lockfile
   pnpm build:deps
   pnpm build
   # Exit code 0
   ```

2. **Tests pass:**
   ```bash
   pnpm test
   # All tests passing
   ```

3. **Zero lint warnings:**
   ```bash
   pnpm lint
   # 0 errors, 0 warnings
   ```

4. **CI passes:**
   ```bash
   # All GitHub Actions green
   ```

5. **Compliance checks pass:**
   ```bash
   bash scripts/verify/workspace-deps.sh
   bash scripts/audit/typescript-versions.sh
   npx tsx scripts/audit/observability-compliance.ts
   # All exit 0
   ```

---

## Rollback Plan

If any task causes issues:

```bash
# Restore from git
git restore .

# Or revert specific changes
git revert <commit-hash>

# Reinstall clean
rm -rf node_modules pnpm-lock.yaml
pnpm install --frozen-lockfile
```

---

## Next Steps After Completion

1. **Deploy to staging** (2h)
2. **Run integration tests** (2h)
3. **Performance audit** (3h)
4. **Security scan** (2h)
5. **Production deployment** (2h)

**Total additional: 11 hours**

---

## Questions?

Contact: Development Team
Documentation: docs/GROUND_RULES.md
