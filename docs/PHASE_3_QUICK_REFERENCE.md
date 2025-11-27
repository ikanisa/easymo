# Phase 3: Quick Reference Guide

## What Changed?

### ✅ All Services Now Use Vitest (Instead of Jest)

**Updated Services:**
- agent-core
- attribution-service
- broker-orchestrator
- buyer-service
- ranking-service
- vendor-service
- whatsapp-webhook-worker

### New Test Commands

```bash
# Run tests
pnpm test                    # Root level
pnpm --filter @easymo/<service> test  # Specific service

# Watch mode
pnpm --filter @easymo/<service> test:watch

# Coverage
pnpm --filter @easymo/<service> test:coverage
```

### TypeScript Version

All packages now use **TypeScript 5.5.4** (enforced via pnpm overrides).

### Workspace Dependencies

All internal dependencies must use `workspace:*` protocol:

```json
{
  "dependencies": {
    "@easymo/commons": "workspace:*",
    "@va/shared": "workspace:*"
  }
}
```

## New Scripts Available

### Migration Tools
```bash
# Automated Jest → Vitest migration
./scripts/migration/jest-to-vitest-bulk.sh --dry-run
./scripts/migration/jest-to-vitest-bulk.sh
```

### Verification Tools
```bash
# Validate workspace dependencies
./scripts/verify/workspace-deps.sh
```

### Security Tools
```bash
# Audit environment files
./scripts/security/audit-env-files.sh
```

### Maintenance Tools
```bash
# Clean up root directory
./scripts/maintenance/cleanup-root-directory.sh --dry-run
./scripts/maintenance/cleanup-root-directory.sh
```

### Status
```bash
# Show Phase 3 summary
./scripts/phase3-summary.sh
```

## Testing Your Code

### Before (Jest)
```typescript
import { jest } from '@jest/globals';

const mockFn = jest.fn();
jest.mock('./module');
```

### After (Vitest)
```typescript
import { vi, describe, it, expect } from 'vitest';

const mockFn = vi.fn();
vi.mock('./module');
```

## Common Issues

### Issue: Tests not running
**Solution**: Make sure you have vitest installed
```bash
pnpm install
```

### Issue: Can't find test config
**Solution**: Each service now has `vitest.config.ts`

### Issue: TypeScript errors
**Solution**: All packages use TS 5.5.4, run:
```bash
pnpm type-check
```

## Benefits

1. **Faster Tests**: Vitest is 2-5x faster than Jest
2. **Better DX**: Instant feedback in watch mode
3. **Consistency**: Same test framework everywhere
4. **Modern**: Built on Vite, ES modules native

## Documentation

Full details: `docs/REFACTORING_PHASE_3_COMPLETE.md`

## Questions?

Contact the development team or check the migration guide.
