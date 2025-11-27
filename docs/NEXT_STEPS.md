# Next Steps - Post-Refactoring Action Items

**Last Updated**: 2025-11-27 21:15 UTC  
**Session Status**: ✅ Phase 3 & 4 core tasks complete  
**Priority Order**: Complete these in sequence for maximum impact.  
**Total Estimated Time**: 5-10 hours (remaining)

---

## 🔴 URGENT: Console.log Replacement (2 hours) ✅ IN PROGRESS

### Status: 65/150+ files processed (automated), manual review needed

### Objective
Replace all console.log statements in edge functions with structured logging to achieve 100% observability compliance.

### Progress
- ✅ Automated replacement completed for 65 Supabase Edge Functions
- ✅ Backup files created (*.bak)
- ✅ Observability compliance improved: 194 → 190 non-compliant files
- 🟡 Manual review and semantic event naming needed

### Files to Fix (9 files)
```
supabase/functions/wa-webhook-unified/index.ts
supabase/functions/wa-webhook-property/index.ts
supabase/functions/wa-webhook-profile/index.ts
supabase/functions/wa-webhook-mobility/index.ts
supabase/functions/wa-webhook-jobs/index.ts
supabase/functions/wa-webhook-insurance/index.ts
supabase/functions/wa-webhook/index.ts
supabase/functions/wa-events-bq-drain/index.ts
supabase/functions/video-performance-summary/index.ts
```

### Commands
```bash
# 1. Run automated codemod (dry-run first)
npx tsx scripts/codemod/replace-console.ts --dry-run

# 2. Review changes, then apply
npx tsx scripts/codemod/replace-console.ts

# 3. Test each function
pnpm test:functions

# 4. Deploy and verify
supabase functions deploy wa-webhook-unified
# ... repeat for all functions

# 5. Verify compliance
npx tsx scripts/audit/observability-compliance.ts
```

### Success Criteria
- ✅ 0 console.log statements remain
- ✅ All functions use structured logging
- ✅ Observability compliance: 85% → 100%

---

## 🟡 HIGH: Correlation ID Middleware (2 hours)

### Objective
Add correlation ID handling to all webhook functions for distributed tracing.

### Implementation
```typescript
// supabase/functions/_shared/middleware/correlation.ts
export function withCorrelationId(
  handler: (req: Request, correlationId: string) => Promise<Response>
) {
  return async (req: Request) => {
    const correlationId = req.headers.get('x-correlation-id') || 
                          crypto.randomUUID();
    
    const response = await handler(req, correlationId);
    response.headers.set('x-correlation-id', correlationId);
    return response;
  };
}
```

### Apply to Functions
```typescript
// Example: supabase/functions/wa-webhook/index.ts
import { withCorrelationId } from '../_shared/middleware/correlation.ts';

Deno.serve(withCorrelationId(async (req, correlationId) => {
  log.info({ correlationId }, 'Processing webhook');
  // ... handler logic
}));
```

### Success Criteria
- ✅ All webhook functions use correlation ID middleware
- ✅ Correlation IDs logged in all events
- ✅ Correlation IDs passed to downstream services

---

## 🟡 HIGH: Jest → Vitest Migration (3 hours)

### Objective
Complete test framework standardization by migrating remaining Jest tests.

### Services to Migrate
1. `services/wallet-service` (Jest → Vitest)
2. `services/profile` (Jest → Vitest)

### Commands
```bash
# 1. Run migration script
npx tsx scripts/migration/jest-to-vitest.ts --target=services/wallet-service
npx tsx scripts/migration/jest-to-vitest.ts --target=services/profile

# 2. Create vitest configs
cat > services/wallet-service/vitest.config.ts << 'VITEST'
import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared';

export default mergeConfig(nodeConfig, defineConfig({
  test: {
    coverage: {
      thresholds: {
        global: { statements: 90, branches: 85, functions: 90, lines: 90 }
      }
    },
    testTimeout: 30000,
  },
}));
VITEST

# 3. Update package.json
# Change "test": "jest" to "test": "vitest run"

# 4. Remove Jest
pnpm --filter @easymo/wallet-service remove jest @types/jest
pnpm --filter @easymo/profile remove jest @types/jest

# 5. Run tests
pnpm --filter @easymo/wallet-service test
pnpm --filter @easymo/profile test
```

### Success Criteria
- ✅ All services use Vitest
- ✅ 0 Jest dependencies remain
- ✅ All tests passing

---

## 🟢 MEDIUM: CI Workflow Updates (1 hour)

### Objective
Integrate new security and compliance checks into CI pipeline.

### Changes to `.github/workflows/ci.yml`
```yaml
# Add after existing checks

- name: Security Audit
  run: ./scripts/security/audit-env-files.sh || true
  continue-on-error: true  # Warning only for now

- name: Observability Compliance
  run: |
    npm install -g tsx
    npx tsx scripts/audit/observability-compliance.ts || true
  continue-on-error: true  # Warning only for now

- name: Workspace Dependencies Check
  run: ./scripts/verify/workspace-deps.sh
```

### Success Criteria
- ✅ Security audit runs on every push
- ✅ Observability compliance checked
- ✅ Workspace deps validated
- ✅ Non-blocking initially (warnings)

---

## 🟢 MEDIUM: Documentation Updates (2 hours)

### 1. Update GROUND_RULES.md
Add compliance requirements section:
```markdown
## Observability Compliance

All services MUST:
- Use structured logging (Pino for Node, logStructuredEvent for Deno)
- Include correlation IDs in all log events
- Mask PII before logging
- Emit metrics for key events

Validation: Run `npx tsx scripts/audit/observability-compliance.ts`
```

### 2. Create Observability Best Practices
File: `docs/OBSERVABILITY_BEST_PRACTICES.md`
- Logging patterns
- Correlation ID usage
- PII masking examples
- Metrics recording

### 3. Update README.md
Add new script locations:
```markdown
## Scripts

### Maintenance
- `scripts/maintenance/cleanup-root-directory.sh` - Clean up root directory

### Security
- `scripts/security/audit-env-files.sh` - Audit environment variables

### Audit
- `scripts/audit/observability-compliance.ts` - Check observability compliance
```

### Success Criteria
- ✅ GROUND_RULES.md updated
- ✅ Best practices documented
- ✅ README.md reflects new structure

---

## 📊 Progress Tracking

### Current Status
- [x] Phase 1: Security & Testing (100%)
- [x] Phase 2: DevOps & Infrastructure (100%)
- [x] Phase 3: Code Quality (85%)
- [x] Phase 4: Documentation & Cleanup (100%)

### Remaining Tasks
- [ ] Console.log replacement (0/9 files)
- [ ] Correlation ID middleware (0/9 functions)
- [ ] Jest → Vitest migration (0/2 services)
- [ ] CI workflow updates (0/3 checks)
- [ ] Documentation updates (0/3 files)

### Target Completion
**Date**: 2025-12-04 (1 week from now)  
**Effort**: 10 hours total  
**Priority**: Complete console.log replacement first

---

## 🎯 Success Metrics

When all tasks complete:

| Metric | Current | Target |
|--------|---------|--------|
| Observability compliance | 85% | 100% |
| Test framework consistency | 85% | 100% |
| CI checks | 3 | 6 |
| Console.log statements | 9 files | 0 |
| Documentation completeness | 80% | 100% |

---

## 🚀 Quick Start

To begin immediately:

```bash
# 1. Ensure you're on latest main
git pull origin main

# 2. Install dependencies
pnpm install --frozen-lockfile

# 3. Run compliance check (baseline)
npx tsx scripts/audit/observability-compliance.ts > compliance-before.txt

# 4. Start with console.log replacement
npx tsx scripts/codemod/replace-console.ts --dry-run

# 5. Review and proceed
# ... follow steps in URGENT section above
```

---

**Last Updated**: 2025-11-27  
**Next Review**: After console.log replacement
