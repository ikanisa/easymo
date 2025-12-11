# Phase 3: Package Consolidation Plan

**Date:** December 10, 2025  
**Current Count:** 33 packages  
**Target:** ~20 packages  
**Reduction Goal:** ~13 packages

---

## 🎯 Consolidation Strategy

### Current Package Inventory

```
packages/
├── agent-config
├── agents
├── ai
├── ai-core
├── call-capability
├── circuit-breaker
├── clients
├── commons
├── db
├── flags
├── google-speech
├── ibimina-admin-core
├── ibimina-config
├── ibimina-flags
├── ibimina-lib
├── ibimina-locales
├── ibimina-supabase-schemas
├── ibimina-ui
├── locales
├── localization
├── media-utils
├── messaging
├── ocr-extract
├── pricing-engine
├── sacco-core
├── shared
├── sms-parser
├── state-machine
├── supabase-schemas
├── types
├── ui
├── vendor-admin-core
└── video-agent-schema
```

---

## 📦 Merge Groups

### Group 1: Common/Shared Utilities ⭐ HIGH PRIORITY

**Current:** 3 packages  
**Target:** 1 package (`@easymo/commons`)

#### Packages to Merge:

- `commons` - Common utilities
- `shared` - Shared code
- `types` - TypeScript types

#### Migration Plan:

```bash
# 1. Create unified structure
packages/commons/
├── src/
│   ├── types/          # from @easymo/types
│   ├── utils/          # from @easymo/shared
│   ├── constants/      # from @easymo/commons
│   └── index.ts
├── package.json
└── tsconfig.json

# 2. Update imports across codebase
# Before:
import { User } from '@easymo/types'
import { formatPhone } from '@easymo/shared'
import { API_VERSION } from '@easymo/commons'

# After:
import { User, formatPhone, API_VERSION } from '@easymo/commons'
```

**Risk:** LOW - Mostly utility code  
**Effort:** 2-3 days  
**Savings:** 3 → 1 (save 2 packages)

---

### Group 2: AI/Agent Logic ⭐ HIGH PRIORITY

**Current:** 5 packages  
**Target:** 1 package (`@easymo/ai`)

#### Packages to Merge:

- `ai` - AI utilities
- `ai-core` - Core AI logic
- `agents` - Agent implementations
- `agent-config` - Agent configuration
- `video-agent-schema` - (consider keeping separate if specialized)

#### Migration Plan:

```bash
packages/ai/
├── src/
│   ├── agents/         # from @easymo/agents
│   ├── config/         # from @easymo/agent-config
│   ├── core/           # from @easymo/ai-core
│   ├── providers/      # AI provider integrations
│   ├── schemas/        # Schemas
│   └── index.ts
```

**Risk:** MEDIUM - Active development area  
**Effort:** 3-4 days  
**Savings:** 5 → 1-2 (save 3-4 packages)

---

### Group 3: Localization ⭐ MEDIUM PRIORITY

**Current:** 3 packages  
**Target:** 1 package (`@easymo/i18n` or `@easymo/localization`)

#### Packages to Merge:

- `locales` - Locale data
- `localization` - i18n utilities
- `ibimina-locales` - Ibimina-specific locales

#### Migration Plan:

```bash
packages/i18n/
├── src/
│   ├── locales/
│   │   ├── en/
│   │   ├── rw/
│   │   ├── fr/
│   │   └── ibimina/      # ibimina-specific
│   ├── utils/
│   └── index.ts
```

**Risk:** LOW - Mostly static data  
**Effort:** 1-2 days  
**Savings:** 3 → 1 (save 2 packages)

---

### Group 4: UI Components 🟡 LOWER PRIORITY

**Current:** 2 packages  
**Target:** 1 package (`@easymo/ui`)

#### Packages to Merge:

- `ui` - Main UI components
- `ibimina-ui` - Ibimina-specific UI

#### Migration Plan:

```bash
packages/ui/
├── src/
│   ├── components/
│   │   ├── common/       # shared components
│   │   └── ibimina/      # ibimina-specific
│   ├── hooks/
│   ├── styles/
│   └── index.ts
```

**Risk:** LOW - Component library  
**Effort:** 2 days  
**Savings:** 2 → 1 (save 1 package)

---

### Group 5: Configuration 🟡 LOWER PRIORITY

**Current:** 3 packages  
**Target:** 1 package (`@easymo/config`)

#### Packages to Merge:

- `flags` - Feature flags
- `ibimina-flags` - Ibimina flags
- `ibimina-config` - Ibimina configuration

#### Migration Plan:

```bash
packages/config/
├── src/
│   ├── flags/
│   │   ├── global.ts
│   │   └── ibimina.ts
│   ├── env.ts            # Environment config (from Phase 4)
│   ├── schema.ts         # Zod schemas
│   └── index.ts
```

**Risk:** LOW - Configuration only  
**Effort:** 1-2 days  
**Savings:** 3 → 1 (save 2 packages)

---

### Group 6: Database Schemas 🟡 LOWER PRIORITY

**Current:** 3 packages  
**Target:** 1 package (`@easymo/schemas`)

#### Packages to Merge:

- `supabase-schemas` - Main schemas
- `ibimina-supabase-schemas` - Ibimina schemas
- `video-agent-schema` - (consider keeping if specialized)

#### Migration Plan:

```bash
packages/schemas/
├── src/
│   ├── database/
│   │   ├── public.ts
│   │   └── ibimina.ts
│   ├── api/
│   └── index.ts
```

**Risk:** LOW - Type definitions  
**Effort:** 2 days  
**Savings:** 3 → 1-2 (save 1-2 packages)

---

## 📊 Consolidation Summary

| Group         | Current | Target  | Priority  | Effort         | Savings   |
| ------------- | ------- | ------- | --------- | -------------- | --------- |
| Common/Shared | 3       | 1       | ⭐ HIGH   | 2-3 days       | 2         |
| AI/Agent      | 5       | 1-2     | ⭐ HIGH   | 3-4 days       | 3-4       |
| Localization  | 3       | 1       | ⭐ MEDIUM | 1-2 days       | 2         |
| UI Components | 2       | 1       | 🟡 LOWER  | 2 days         | 1         |
| Configuration | 3       | 1       | 🟡 LOWER  | 1-2 days       | 2         |
| Schemas       | 3       | 1-2     | 🟡 LOWER  | 2 days         | 1-2       |
| **TOTAL**     | **19**  | **6-8** |           | **11-15 days** | **11-13** |

**Remaining specialized packages:** ~14 (keep as-is)  
**Final target:** 33 → ~20-22 packages

---

## 🚀 Implementation Plan

### Week 1: High-Priority Merges

**Day 1-3: Common/Shared Consolidation**

```bash
# Create @easymo/commons
pnpm create @easymo/commons
# Migrate types, shared, commons
# Update imports (use codemod if available)
# Test builds
# Archive old packages
```

**Day 4-7: AI/Agent Consolidation**

```bash
# Create @easymo/ai
# Migrate agent packages
# Update imports
# Test extensively (high risk area)
# Archive old packages
```

### Week 2: Medium & Lower Priority

**Day 8-10: Localization + UI**

```bash
# Create @easymo/i18n
# Merge localization packages
# Create unified @easymo/ui
# Test UI components
```

**Day 11-13: Configuration + Schemas**

```bash
# Create @easymo/config
# Merge config packages
# Create @easymo/schemas
# Test schema references
```

**Day 14-15: Testing & Cleanup**

```bash
# Full build test
# Update documentation
# Archive old packages
# Update workspace config
```

---

## 📋 Technical Implementation

### Step-by-Step Process (Per Package)

#### 1. Create New Package

```bash
cd packages
mkdir new-package
cd new-package
pnpm init
```

#### 2. Setup Package Structure

```json
{
  "name": "@easymo/new-package",
  "version": "0.1.0",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {}
}
```

#### 3. Migrate Code

```bash
# Copy source files
cp -r ../old-package-1/src/* ./src/category-1/
cp -r ../old-package-2/src/* ./src/category-2/

# Update internal imports
# Create unified index.ts
```

#### 4. Update Workspace References

```json
// pnpm-workspace.yaml - already configured

// tsconfig.json - update paths
{
  "compilerOptions": {
    "paths": {
      "@easymo/new-package": ["./packages/new-package/src"]
    }
  }
}
```

#### 5. Update All Import Statements

```bash
# Find all imports
grep -r "from '@easymo/old-package'" --include="*.ts" --include="*.tsx"

# Replace (consider using codemod)
# Manual or scripted replacement
```

#### 6. Test & Validate

```bash
# Build all packages
pnpm run -r build

# Run tests
pnpm run -r test

# Check for broken imports
pnpm run typecheck
```

#### 7. Archive Old Packages

```bash
# Don't delete immediately - archive
mv packages/old-package packages/.archived/old-package-$(date +%Y%m%d)
```

---

## ✅ Success Criteria

- [ ] Reduced from 33 to ~20-22 packages
- [ ] All imports updated across codebase
- [ ] Build passes for all packages
- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] Documentation updated
- [ ] Old packages archived (not deleted)

---

## ⚠️ Risk Mitigation

1. **Create feature branch** - Don't work on main
2. **Test incrementally** - Test after each merge
3. **Use TypeScript** - Catch import errors at compile time
4. **Automated tools** - Use codemods for import updates
5. **Keep archives** - Don't delete packages, archive them
6. **Staged rollout** - Merge one group at a time
7. **Pair review** - Have another dev review changes

---

## 📋 Execution Checklist

### Phase 3A: Common/Shared ⭐ START HERE

- [ ] Create `@easymo/commons` structure
- [ ] Migrate `@easymo/types` code
- [ ] Migrate `@easymo/shared` code
- [ ] Migrate `@easymo/commons` code
- [ ] Create unified exports
- [ ] Update imports (find/replace)
- [ ] Test builds
- [ ] Test applications
- [ ] Archive old packages
- [ ] Update documentation

### Phase 3B: AI/Agent

- [ ] Create `@easymo/ai` structure
- [ ] Migrate `@easymo/ai-core`
- [ ] Migrate `@easymo/agents`
- [ ] Migrate `@easymo/agent-config`
- [ ] Evaluate `video-agent-schema` (merge or keep)
- [ ] Update imports
- [ ] Test AI functionality
- [ ] Archive old packages

### Phase 3C: Localization

- [ ] Create `@easymo/i18n`
- [ ] Migrate locale data
- [ ] Merge ibimina locales
- [ ] Test language switching
- [ ] Archive old packages

### Phase 3D: UI, Config, Schemas

- [ ] Merge UI packages
- [ ] Merge config packages
- [ ] Merge schema packages
- [ ] Test all applications
- [ ] Archive old packages

### Phase 3E: Final Validation

- [ ] Full monorepo build
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Create migration guide for team

---

**Next Step:** Begin with Phase 3A - Common/Shared consolidation (highest priority, lowest risk)
