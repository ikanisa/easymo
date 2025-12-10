# Phase 3: Package Consolidation Plan

**Status:** 🚀 Ready to Execute  
**Branch:** `consolidation-phase3-packages`  
**Complexity:** MEDIUM  
**Estimated Time:** 2-3 weeks  
**Risk:** MEDIUM (requires import updates)

---

## 🎯 Objective

Consolidate duplicate packages identified in the executive summary to reduce maintenance overhead, eliminate inconsistencies, and simplify dependency management.

**Target:** 32 packages → ~20 packages (-37%)

---

## 📊 Current Package Analysis

### Total Packages Found: 32

### Duplicate Categories Identified

#### 1. UI Packages (3 packages → 1)
- `packages/ui/` - Generic UI components
- `packages/ibimina-ui/` - Ibimina-specific UI (DUPLICATE)
- `packages/vendor-admin-core/` - Vendor admin UI (if exists)

**Consolidation:** Merge all into `packages/ui/`

#### 2. Localization Packages (3 packages → 1)
- `packages/locales/` - General locales
- `packages/ibimina-locales/` - Ibimina-specific locales (DUPLICATE)
- `packages/localization/` - Another localization (if exists)

**Consolidation:** Merge all into `packages/locales/`

#### 3. Configuration Packages (4 packages → 2)
- `packages/flags/` - General feature flags
- `packages/ibimina-flags/` - Ibimina flags (DUPLICATE)
- `packages/agent-config/` - Agent configuration (KEEP separate)
- `packages/ibimina-config/` - Ibimina config (MERGE with flags)

**Consolidation:** Merge flags, keep agent-config separate

#### 4. Schema Packages (2 packages → 1)
- `packages/supabase-schemas/` - General schemas (if exists)
- `packages/ibimina-supabase-schemas/` - Ibimina schemas (DUPLICATE)

**Consolidation:** Merge into single schema package

---

## 🔍 Detailed Package Audit

### Step 1: Audit All Packages

```bash
cd /Users/jeanbosco/workspace/easymo

# List all packages with details
for pkg in packages/*/; do
  echo "Package: $(basename $pkg)"
  if [ -f "$pkg/package.json" ]; then
    echo "  Name: $(jq -r .name "$pkg/package.json" 2>/dev/null || echo 'N/A')"
    echo "  Files: $(find "$pkg" -type f | wc -l | tr -d ' ')"
    echo "  Size: $(du -sh "$pkg" | cut -f1)"
  fi
  echo ""
done
```

### Step 2: Analyze Dependencies

```bash
# Find all imports of duplicate packages
grep -r "from '@.*ibimina-ui" . --include="*.ts" --include="*.tsx" | wc -l
grep -r "from '@.*ibimina-locales" . --include="*.ts" --include="*.tsx" | wc -l
grep -r "from '@.*ibimina-flags" . --include="*.ts" --include="*.tsx" | wc -l
grep -r "from '@.*ibimina-supabase-schemas" . --include="*.ts" --include="*.tsx" | wc -l
```

---

## 🚀 Execution Plan

### Phase 3A: UI Package Consolidation (Week 1)

#### 1. Audit UI Packages
```bash
# Compare component overlap
diff -r packages/ui/ packages/ibimina-ui/ | head -50

# Check usage
grep -r "from '@.*ui" apps/ services/ --include="*.ts" --include="*.tsx"
```

#### 2. Merge Strategy
```
packages/ui/
├── components/         # Generic components (existing)
├── ibimina/           # Ibimina-specific (moved from ibimina-ui)
│   ├── components/
│   └── hooks/
└── shared/            # Truly shared utilities
```

#### 3. Update Imports
```typescript
// Before
import { Button } from '@easymo/ibimina-ui';

// After
import { Button } from '@easymo/ui/ibimina';
// OR (if generic)
import { Button } from '@easymo/ui';
```

#### 4. Validation
- [ ] All imports updated
- [ ] Build succeeds
- [ ] Tests pass
- [ ] No broken imports

---

### Phase 3B: Localization Consolidation (Week 1)

#### 1. Audit Locales
```bash
# Compare translation keys
diff <(jq -S 'keys' packages/locales/en.json) \
     <(jq -S 'keys' packages/ibimina-locales/en.json)
```

#### 2. Merge Strategy
```
packages/locales/
├── common/            # Shared translations
├── ibimina/          # Ibimina-specific
├── vendor/           # Vendor-specific
└── index.ts          # Export all
```

#### 3. Update Imports
```typescript
// Before
import { t } from '@easymo/ibimina-locales';

// After
import { t } from '@easymo/locales/ibimina';
```

---

### Phase 3C: Config/Flags Consolidation (Week 2)

#### 1. Audit Configs
```bash
# Compare configurations
cat packages/flags/src/index.ts
cat packages/ibimina-flags/src/index.ts
cat packages/ibimina-config/src/index.ts
```

#### 2. Merge Strategy
```
packages/config/       # NEW unified package
├── flags/
│   ├── common.ts
│   └── ibimina.ts
├── settings/
└── index.ts

packages/agent-config/ # KEEP separate (domain-specific)
```

#### 3. Update Imports
```typescript
// Before
import { FLAGS } from '@easymo/ibimina-flags';

// After
import { FLAGS } from '@easymo/config/flags/ibimina';
```

---

### Phase 3D: Schema Consolidation (Week 2)

#### 1. Audit Schemas
```bash
# Compare table definitions
diff packages/supabase-schemas/ packages/ibimina-supabase-schemas/
```

#### 2. Merge Strategy
```
packages/schemas/      # NEW unified package
├── supabase/
│   ├── common/
│   └── ibimina/
└── index.ts
```

---

## 🛠️ Technical Implementation

### Script 1: Package Audit

```bash
#!/bin/bash
# scripts/consolidation/audit-packages.sh

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "Package Audit Report"
echo "==================="
echo ""

for pkg in packages/*/; do
  pkg_name=$(basename "$pkg")
  
  if [ -f "$pkg/package.json" ]; then
    name=$(jq -r .name "$pkg/package.json" 2>/dev/null)
    files=$(find "$pkg" -type f | wc -l | tr -d ' ')
    size=$(du -sh "$pkg" | cut -f1)
    
    echo "📦 $pkg_name"
    echo "   NPM Name: $name"
    echo "   Files: $files"
    echo "   Size: $size"
    
    # Check for duplicates
    if [[ "$pkg_name" == *"ibimina"* ]]; then
      base_name=$(echo "$pkg_name" | sed 's/ibimina-//')
      if [ -d "packages/$base_name" ]; then
        echo "   ⚠️  DUPLICATE of packages/$base_name"
      fi
    fi
    echo ""
  fi
done
```

### Script 2: Import Finder

```bash
#!/bin/bash
# scripts/consolidation/find-imports.sh

PACKAGE_NAME=$1

echo "Finding imports of $PACKAGE_NAME"
echo "================================"
echo ""

# TypeScript files
grep -r "from '@.*$PACKAGE_NAME" . \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir="node_modules" \
  --exclude-dir=".next" \
  --exclude-dir="dist" \
  --exclude-dir="build"
```

### Script 3: Import Updater

```bash
#!/bin/bash
# scripts/consolidation/update-imports.sh

OLD_PACKAGE=$1
NEW_PACKAGE=$2

echo "Updating imports: $OLD_PACKAGE → $NEW_PACKAGE"
echo "=============================================="

# Update all TypeScript files
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/dist/*" \
  -exec sed -i '' "s|from '@.*$OLD_PACKAGE'|from '$NEW_PACKAGE'|g" {} \;

echo "✅ Import updates complete"
echo "Run: pnpm build to verify"
```

---

## ⚠️ Risk Management

### High Risks

#### Risk 1: Breaking Imports
**Probability:** HIGH  
**Impact:** CRITICAL  
**Mitigation:**
- Comprehensive import audit before changes
- Automated import update script
- Incremental consolidation
- Full test suite execution

#### Risk 2: Build Failures
**Probability:** MEDIUM  
**Impact:** HIGH  
**Mitigation:**
- Build after each package merge
- TypeScript strict mode validation
- CI/CD pipeline checks

#### Risk 3: Lost Functionality
**Probability:** LOW  
**Impact:** HIGH  
**Mitigation:**
- Detailed component comparison
- Test coverage validation
- Functionality verification

### Rollback Procedure

```bash
# If consolidation causes issues
git checkout consolidation-phase3-packages
git revert HEAD~N  # Revert N commits
git push origin consolidation-phase3-packages --force

# Or restore from backup
git checkout consolidation-phase2-quick-wins -- packages/
```

---

## 📋 Validation Checklist

### Per Package Consolidation
- [ ] All files moved/merged
- [ ] Imports updated across codebase
- [ ] package.json updated
- [ ] pnpm-workspace.yaml updated
- [ ] Build succeeds
- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] Documentation updated

### Final Validation
- [ ] All packages consolidated
- [ ] Total package count reduced
- [ ] No broken imports
- [ ] Full build succeeds
- [ ] All tests pass
- [ ] Bundle size acceptable
- [ ] Performance maintained

---

## 📈 Success Metrics

| Metric | Before | Target | Status |
|--------|--------|--------|--------|
| Total Packages | 32 | 20 | 📝 |
| UI Packages | 3 | 1 | 📝 |
| Locale Packages | 3 | 1 | 📝 |
| Config Packages | 4 | 2 | 📝 |
| Schema Packages | 2 | 1 | 📝 |
| Maintenance Overhead | HIGH | LOW | 📝 |

---

## 🗓️ Timeline

### Week 1
- Day 1-2: Audit all packages
- Day 3-4: UI consolidation
- Day 5: Localization consolidation

### Week 2
- Day 1-2: Config/flags consolidation
- Day 3: Schema consolidation
- Day 4-5: Testing & validation

### Week 3
- Day 1-2: Import updates
- Day 3: Final testing
- Day 4: Documentation
- Day 5: PR creation

---

## 📚 Documentation Tasks

- [ ] Update package README files
- [ ] Create migration guide
- [ ] Update import examples
- [ ] Document new package structure
- [ ] Update architecture docs

---

## 🚦 Decision Points

### Before Starting
- [ ] Phase 1 & 2 PRs merged?
- [ ] Team availability confirmed?
- [ ] Backup strategy in place?

### During Execution
- [ ] Build passing after each merge?
- [ ] Import updates successful?
- [ ] Tests passing?

### Before Completion
- [ ] All validations passed?
- [ ] Documentation complete?
- [ ] Team review completed?

---

## 📞 Communication Plan

### Team Announcement

**Subject:** Phase 3: Package Consolidation Starting

**Body:**
```
Team,

Starting Phase 3 of consolidation: Package Consolidation

WHAT:
- Consolidating duplicate packages
- 32 packages → ~20 packages
- Focus: UI, locales, config, schemas

TIMELINE:
- Week 1: UI and localization
- Week 2: Config and schemas
- Week 3: Testing and documentation

IMPACT:
- Import paths will change
- Package names will change
- Functionality preserved

WHAT YOU NEED TO DO:
- Await updates
- Review PRs when ready
- Test in your workflows

Questions? See: PHASE3_EXECUTION_PLAN.md
```

---

## ✅ Pre-Flight Checklist

Before executing Phase 3:

- [ ] Phase 1 PR created/merged?
- [ ] Phase 2 PR created/merged?
- [ ] Team notified?
- [ ] Backup branch created?
- [ ] Audit scripts ready?
- [ ] Time allocated (2-3 weeks)?
- [ ] Risk assessment reviewed?

---

**Status:** 📝 PLANNING COMPLETE  
**Next:** Execute audit and begin UI consolidation  
**Branch:** `consolidation-phase3-packages`

---

**Note:** This is a more complex phase than 1 & 2. Recommend:
1. Complete Phases 1 & 2 PRs first
2. Get team buy-in
3. Allocate 2-3 weeks for careful execution
4. Consider doing in sub-phases (UI first, then locales, etc.)
