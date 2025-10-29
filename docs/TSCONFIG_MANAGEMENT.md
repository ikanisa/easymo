# TypeScript Configuration Management

This document provides guidelines for managing TypeScript configurations across the EasyMO monorepo, including path resolution, compiler options, and best practices.

## Table of Contents

- [Overview](#overview)
- [Configuration Hierarchy](#configuration-hierarchy)
- [Base Configuration](#base-configuration)
- [Service Configurations](#service-configurations)
- [Package Configurations](#package-configurations)
- [Path Mapping](#path-mapping)
- [Common Issues](#common-issues)
- [Validation](#validation)
- [Best Practices](#best-practices)

---

## Overview

EasyMO uses a centralized TypeScript configuration strategy with:

- **Base Configuration**: `tsconfig.base.json` - shared compiler options
- **Root Configuration**: `tsconfig.json` - project references
- **Service Configs**: Each service extends base or root config
- **Package Configs**: Packages use composite builds with declarations

**Key Principles:**
- DRY (Don't Repeat Yourself) - extend base configs
- Consistent compiler options across workspace
- Proper path mapping for workspace packages
- Type safety with strict mode
- Composite builds for packages

---

## Configuration Hierarchy

```
tsconfig.base.json              # Base shared configuration
└── tsconfig.json               # Root configuration
    ├── services/*/tsconfig.json         # Service configurations
    ├── apps/*/tsconfig.json            # Application configurations
    ├── packages/*/tsconfig.json        # Package configurations
    └── admin-app/tsconfig.json         # Admin app configuration
```

---

## Base Configuration

**File:** `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "baseUrl": ".",
    "paths": {
      "@va/shared": ["packages/shared/src/index.ts"],
      "@va/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

**Purpose:**
- Defines common compiler options for all packages
- Sets up workspace-level path mappings
- Enables decorators for NestJS services
- Enforces strict type checking

**Key Options:**
- `target: ES2022` - Modern JavaScript features
- `module: ESNext` - ES module format
- `strict: true` - Enable all strict checks
- `skipLibCheck: true` - Skip type checking of .d.ts files
- `experimentalDecorators: true` - Required for NestJS

---

## Service Configurations

### NestJS Services

**Pattern for services (agent-core, wallet-service, etc.):**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "commonjs",
    "target": "es2021",
    "types": ["node", "jest"],
    "paths": {
      "@/*": ["*"]
    },
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```

**Key Points:**
- Extends root `tsconfig.json` (which extends `tsconfig.base.json`)
- Uses CommonJS module format (required for Node.js)
- Sets `baseUrl: src` with `paths: { "@/*": ["*"] }`
- Excludes test files and dist
- Includes Node and Jest types

**Build Configuration (tsconfig.build.json):**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "removeComments": true
  },
  "exclude": ["test", "src/**/*.spec.ts", "src/**/*.e2e-spec.ts"]
}
```

**Purpose:** Optimized for production builds, excludes tests.

---

### Express/Custom Services

**Pattern for simpler services:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "CommonJS",
    "target": "ES2021",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "test"]
}
```

---

## Package Configurations

### Shared Packages (@easymo/commons, @easymo/messaging, etc.)

**Pattern:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "emitDeclarationOnly": false,
    "composite": true,
    "rootDir": "src",
    "module": "Node16",
    "target": "ES2021",
    "esModuleInterop": true,
    "moduleResolution": "node16",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

**Key Points:**
- `declaration: true` - Generate .d.ts files
- `composite: true` - Enable project references
- `module: Node16` - Modern Node.js module resolution
- Includes all files in `src/`

**Why Composite?**
- Enables faster incremental builds
- Allows project references
- Required for packages consumed by other packages

---

## Path Mapping

### Workspace Package Paths

**In base configuration:**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@va/shared": ["packages/shared/src/index.ts"],
      "@va/shared/*": ["packages/shared/src/*"],
      "@easymo/commons": ["packages/commons/src/index.ts"],
      "@easymo/commons/*": ["packages/commons/src/*"]
    }
  }
}
```

**Purpose:** Allows services to import from workspace packages using aliases.

---

### Service-Level Paths

**In service configurations:**

```json
{
  "compilerOptions": {
    "baseUrl": "src",
    "paths": {
      "@/*": ["*"]
    }
  }
}
```

**Purpose:** Allows imports within the service using `@/` prefix.

**Example Usage:**

```typescript
// Instead of:
import { UserService } from '../../../services/user.service';

// Use:
import { UserService } from '@/services/user.service';
```

---

### Root-Level Paths

**In root tsconfig.json:**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Purpose:** Paths for the main application (Vite/React).

---

## Common Issues

### Issue 1: Cannot find module '@easymo/commons'

**Symptoms:**
```
TS2307: Cannot find module '@easymo/commons' or its corresponding type declarations
```

**Causes:**
1. Package not built
2. Missing path mapping
3. Incorrect extends chain

**Solutions:**

1. **Build the package:**
   ```bash
   pnpm --filter @easymo/commons build
   ```

2. **Check path mapping:**
   ```json
   // In base or root tsconfig.json
   {
     "compilerOptions": {
       "paths": {
         "@easymo/commons": ["packages/commons/src/index.ts"]
       }
     }
   }
   ```

3. **Verify extends:**
   ```json
   // Service tsconfig.json should extend root
   {
     "extends": "../../tsconfig.json"
   }
   ```

---

### Issue 2: Module resolution errors

**Symptoms:**
```
Cannot find module './types' or its corresponding type declarations
Module not found: Error: Can't resolve '@/utils'
```

**Solutions:**

1. **Check baseUrl and paths:**
   ```json
   {
     "compilerOptions": {
       "baseUrl": "src",  // or "."
       "paths": {
         "@/*": ["*"]  // matches baseUrl
       }
     }
   }
   ```

2. **Verify file structure:**
   ```bash
   # If baseUrl is "src" and paths is "@/*": ["*"]
   # Then @/utils maps to src/utils
   ls src/utils
   ```

3. **Use correct import:**
   ```typescript
   // If baseUrl is "src"
   import { helper } from '@/utils/helper';  // ✅ Correct
   
   // Not
   import { helper } from '@/src/utils/helper';  // ❌ Wrong
   ```

---

### Issue 3: Duplicate identifiers

**Symptoms:**
```
TS2300: Duplicate identifier 'User'
```

**Causes:**
- Multiple packages define the same type
- Incorrect path resolution causing double imports

**Solutions:**

1. **Consolidate types in shared package:**
   ```typescript
   // Move to @easymo/commons or @va/shared
   export type User = { ... };
   ```

2. **Use single source:**
   ```typescript
   // Import from one location only
   import { User } from '@easymo/commons';
   ```

3. **Check for conflicting paths:**
   ```bash
   # Search for duplicate type definitions
   grep -r "export type User" packages/ services/
   ```

---

### Issue 4: Build vs Runtime paths

**Symptoms:**
- TypeScript compiles but runtime errors
- Module not found at runtime

**Cause:**
TypeScript path mapping is compile-time only. Node.js doesn't understand TypeScript paths.

**Solutions:**

1. **For packages, use actual paths:**
   ```json
   // package.json
   {
     "exports": {
       ".": "./dist/index.js",
       "./utils": "./dist/utils/index.js"
     }
   }
   ```

2. **For services, use module-alias or build tools:**
   ```typescript
   // Option 1: Use relative imports for runtime
   import { helper } from './utils/helper';
   
   // Option 2: Use module-alias (add to main.ts)
   import 'module-alias/register';
   ```

3. **For Vite/bundlers, configure resolver:**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
       },
     },
   });
   ```

---

## Validation

### Validate All Configs

**Check for syntax errors:**

```bash
# Validate all tsconfig files
find . -name "tsconfig*.json" ! -path "*/node_modules/*" \
  -exec sh -c 'echo "Checking {}"; cat {} | jq . > /dev/null' \;
```

**Check extends chains:**

```bash
# Find all configs that extend
grep -r "extends" --include="tsconfig*.json" | grep -v node_modules
```

**Type check all packages:**

```bash
# Root type check
pnpm type-check

# Check specific package
pnpm --filter @easymo/commons exec tsc --noEmit

# Check specific service
cd services/wallet-service
npx tsc --noEmit
```

---

### Automated Validation Script

Create `scripts/validate-tsconfig.mjs`:

```javascript
#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function validateTsConfig(path) {
  try {
    const content = readFileSync(path, 'utf8');
    JSON.parse(content);
    console.log(`✅ ${path}`);
    return true;
  } catch (err) {
    console.error(`❌ ${path}: ${err.message}`);
    return false;
  }
}

function findTsConfigs(dir) {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsConfigs(fullPath));
    } else if (entry.name.match(/^tsconfig.*\.json$/)) {
      results.push(fullPath);
    }
  }
  
  return results;
}

const configs = findTsConfigs(root);
const valid = configs.map(validateTsConfig).every(Boolean);

if (!valid) {
  console.error('\n❌ Some TypeScript configs are invalid');
  process.exit(1);
}

console.log(`\n✅ All ${configs.length} TypeScript configs are valid`);
```

**Run validation:**

```bash
node scripts/validate-tsconfig.mjs
```

---

## Best Practices

### 1. Extend from Base

✅ **DO:**
```json
{
  "extends": "../../tsconfig.base.json"
}
```

❌ **DON'T:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    // ... repeating all options
  }
}
```

---

### 2. Use Consistent Module Resolution

**For services (Node.js):**
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

**For packages:**
```json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "node16"
  }
}
```

**For browser builds (Vite):**
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

---

### 3. Generate Declarations for Packages

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "composite": true
  }
}
```

**Why?**
- Provides type information to consumers
- Enables better IDE support
- Required for composite builds

---

### 4. Exclude Build Artifacts

```json
{
  "exclude": [
    "node_modules",
    "dist",
    "build",
    "**/*.spec.ts",
    "**/*.test.ts"
  ]
}
```

---

### 5. Use Appropriate Targets

| Target | Use For |
|--------|---------|
| ES2022 | Modern Node.js (18+), latest browsers |
| ES2021 | Node.js 16+, recent browsers |
| ES2020 | Node.js 14+, older browsers |

**Recommendation:** Use ES2021 or ES2022 for consistency.

---

### 6. Path Mapping Strategy

**Workspace level (in base):**
```json
{
  "paths": {
    "@easymo/commons": ["packages/commons/src/index.ts"],
    "@va/shared": ["packages/shared/src/index.ts"]
  }
}
```

**Service level (in service config):**
```json
{
  "baseUrl": "src",
  "paths": {
    "@/*": ["*"]
  }
}
```

**Never mix levels** - keep workspace paths in base, service paths in service config.

---

### 7. Strict Type Checking

Enable in base config:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Can be overridden** in specific services if needed, but prefer fixing the code.

---

### 8. Project References

For large monorepos, use project references:

**Root tsconfig.json:**
```json
{
  "files": [],
  "references": [
    { "path": "./packages/commons" },
    { "path": "./packages/db" },
    { "path": "./services/wallet-service" }
  ]
}
```

**Enable in packages:**
```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true
  }
}
```

**Build with references:**
```bash
tsc --build
```

---

## Maintenance

### Adding New Service

1. **Copy template:**
   ```bash
   cp services/template/tsconfig.json services/new-service/
   ```

2. **Verify extends path:**
   ```json
   {
     "extends": "../../tsconfig.json"
   }
   ```

3. **Validate:**
   ```bash
   cd services/new-service
   npx tsc --noEmit
   ```

---

### Adding New Package

1. **Create with composite:**
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "composite": true,
       "declaration": true,
       "outDir": "dist",
       "rootDir": "src"
     }
   }
   ```

2. **Add to base paths:**
   ```json
   {
     "paths": {
       "@easymo/new-package": ["packages/new-package/src/index.ts"]
     }
   }
   ```

3. **Build and test:**
   ```bash
   pnpm --filter @easymo/new-package build
   ```

---

### Updating TypeScript Version

1. **Update root package.json:**
   ```json
   {
     "devDependencies": {
       "typescript": "^5.9.3"
     }
   }
   ```

2. **Reinstall:**
   ```bash
   pnpm install
   ```

3. **Test all packages:**
   ```bash
   pnpm type-check
   ```

4. **Update compiler options if needed** (check TypeScript release notes)

---

## Related Documentation

- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Repository layout
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - TypeScript issues
- [GROUND_RULES.md](./GROUND_RULES.md) - Development standards

---

## Reference

### Useful Commands

```bash
# Validate all configs
find . -name "tsconfig*.json" -not -path "*/node_modules/*" -exec cat {} \; | jq .

# Find all extends
grep -r "extends" --include="tsconfig*.json" | grep -v node_modules

# Check type errors
pnpm type-check

# Build with verbose
tsc --build --verbose

# Show all compiler options
tsc --showConfig -p tsconfig.json
```

---

**Last Updated**: 2025-10-29  
**Maintained by**: EasyMO Platform Team
