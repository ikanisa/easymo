# Ground Rules for EasyMO Development

This document establishes foundational rules for observability, security, feature flags, and development requirements that must be followed across all development tasks in the EasyMO platform.

## Table of Contents
- [Package Manager Requirements](#package-manager-requirements)
- [Prebuild Security Checks](#prebuild-security-checks)
- [Observability](#observability)
- [Security](#security)
- [Feature Flags](#feature-flags)
- [Implementation Examples](#implementation-examples)

---

## Package Manager Requirements

**CRITICAL RULE:** The EasyMO platform **MUST** use `pnpm` as the package manager. No other package managers (npm, yarn, etc.) are permitted.

### Why pnpm?

1. **Workspace Support**: pnpm has superior monorepo and workspace support
2. **Disk Efficiency**: Content-addressable storage saves disk space
3. **Strict Dependencies**: Prevents phantom dependencies
4. **Performance**: Faster installs and better caching
5. **Lockfile Integrity**: More reliable dependency resolution

### Required Version

```bash
pnpm >= 8.0.0
# Recommended: pnpm@10.18.3 (as specified in CI)
```

### Installation

```bash
# Via npm (one-time installation)
npm install -g pnpm@10.18.3

# Via corepack (Node 16+, recommended)
corepack enable
corepack prepare pnpm@10.18.3 --activate
```

### Enforcement

The repository includes several mechanisms to enforce pnpm usage:

1. **package.json engines field:**
   ```json
   {
     "engines": {
       "pnpm": ">=8"
     }
   }
   ```

2. **CI/CD workflows:** All GitHub Actions use pnpm exclusively
3. **Makefile:** Default commands use pnpm
4. **Documentation:** All examples use pnpm

### Commands

**DO:**
```bash
pnpm install                    # Install dependencies
pnpm add package-name          # Add dependency
pnpm build                     # Build workspace
pnpm --filter service-name dev # Run service
```

**DON'T:**
```bash
npm install    # ❌ WRONG
yarn install   # ❌ WRONG
```

### Troubleshooting

If pnpm is not recognized:
```bash
# Check installation
pnpm --version

# Add to PATH
export PATH="$HOME/.local/share/pnpm:$PATH"

# Reinstall if needed
npm uninstall -g pnpm
npm install -g pnpm@10.18.3
```

---

## Prebuild Security Checks

**CRITICAL RULE:** All builds **MUST** pass security checks before bundling or deployment. These checks prevent accidental exposure of server-side secrets in client-side code.

### Automated Checks

The repository includes prebuild hooks that run automatically:

1. **assert-no-service-role-in-client.mjs**
   - Location: `scripts/assert-no-service-role-in-client.mjs`
   - Runs: Before every build (`prebuild` script)
   - Purpose: Prevents service role keys and secrets in client bundles

2. **check-client-secrets.mjs**
   - Location: `tools/scripts/check-client-secrets.mjs`
   - Purpose: Additional secret scanning for client code

### What Gets Checked

The security checks scan for:

**Forbidden Names in Public Environment Variables:**
```javascript
const forbiddenNames = [
  'SERVICE_ROLE',
  'SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'ADMIN_TOKEN',
  'EASYMO_ADMIN_TOKEN',
  'SECRET_KEY',
  'PRIVATE_KEY',
  'DATABASE_URL',
  'DB_PASSWORD',
  'MOMO_API_KEY',
  'MOMO_SECRET',
];
```

**Public Variable Prefixes:**
- `NEXT_PUBLIC_*` - Next.js public variables
- `VITE_*` - Vite public variables

**Value Patterns:**
- JWT tokens (long base64 strings starting with `eyJ`)
- Service role keys
- API keys and secrets

### How It Works

```bash
# Automatically runs before build
pnpm build
# ↓ triggers
# ↓ node scripts/assert-no-service-role-in-client.mjs
# ↓ then runs vite build (if check passes)
```

**package.json:**
```json
{
  "scripts": {
    "prebuild": "node ./scripts/assert-no-service-role-in-client.mjs",
    "build": "vite build"
  }
}
```

### Check Behavior

**✅ Pass Example:**
```bash
$ node scripts/assert-no-service-role-in-client.mjs
✅ No service role or sensitive keys detected in client-side environment variables.
```

**❌ Fail Example:**
```bash
$ node scripts/assert-no-service-role-in-client.mjs
❌ SECURITY VIOLATION: Public env variable "NEXT_PUBLIC_ADMIN_TOKEN" contains forbidden name "ADMIN_TOKEN"
❌ SECURITY VIOLATION in .env.local:42: Public env variable "VITE_SERVICE_ROLE" appears to contain a service role key

❌ Build failed: Server-only secrets detected in client-side environment variables.
⚠️  Remove sensitive values from NEXT_PUBLIC_* and VITE_* variables.
```

### Manual Verification

Run checks manually before committing:

```bash
# Check for service role exposure
node scripts/assert-no-service-role-in-client.mjs

# Check for client secrets (if available)
node tools/scripts/check-client-secrets.mjs
```

### CI/CD Integration

All CI workflows include this check:

```yaml
- name: Assert no service role in client env
  run: node scripts/assert-no-service-role-in-client.mjs
```

**Workflow:** `.github/workflows/ci.yml`, `.github/workflows/admin-app-ci.yml`

### Fixing Violations

If the check fails:

1. **Identify the violating variable:**
   ```bash
   # Check environment variables
   env | grep -E '^(NEXT_PUBLIC_|VITE_)'
   
   # Check .env files
   cat .env .env.local | grep -E '^(NEXT_PUBLIC_|VITE_)'
   ```

2. **Remove public prefix from secrets:**
   ```bash
   # ❌ WRONG
   NEXT_PUBLIC_ADMIN_TOKEN=secret-token
   VITE_SERVICE_ROLE_KEY=eyJ...
   
   # ✅ CORRECT
   ADMIN_TOKEN=secret-token
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

3. **Move to server-side:**
   - Use in API routes, Edge Functions, or server components only
   - Call server endpoints from client instead of direct access
   - Use appropriate authentication mechanisms

4. **Update .env.example:**
   ```bash
   # Ensure template doesn't have violations
   ADMIN_TOKEN=CHANGEME_ADMIN_TOKEN  # Server-side only
   NEXT_PUBLIC_API_URL=https://...    # Public is OK
   ```

### Best Practices

1. **Use Environment Variable Naming Convention:**
   ```bash
   # Server-side secrets (NEVER public)
   SECRET_NAME=value
   SERVICE_ROLE_KEY=value
   
   # Public configuration (safe to expose)
   NEXT_PUBLIC_API_URL=value
   VITE_FEATURE_FLAG=value
   ```

2. **Validate at Development Time:**
   - Run prebuild checks before committing
   - Review environment variables regularly
   - Use `.env.local` for local secrets (gitignored)

3. **Document Secret Requirements:**
   - Add to ENV_VARIABLES.md
   - Mark as server-side only
   - Explain usage context

4. **Test in CI:**
   - Security checks run automatically
   - Violations block deployment
   - Review CI logs for details

### Exceptions

There are **NO EXCEPTIONS** to this rule. If you believe a secret must be client-accessible:

1. **Re-evaluate the architecture** - there's usually a better way
2. **Use server-side proxy** - create an API endpoint
3. **Consult security team** - discuss alternatives

**Remember:** Even "public" Supabase anon keys are designed to be public and protected by Row Level Security (RLS). Service role keys bypass RLS and must **NEVER** be exposed.

---

## Observability

All APIs, edge functions, and background jobs **MUST** implement structured logging and event counters for significant actions.

### Structured Logging Requirements

#### For Supabase Edge Functions

Use the structured logging utilities from `supabase/functions/_shared/observability.ts`:

```typescript
import { logStructuredEvent, logError } from "../_shared/observability.ts";

// Log significant events with structured data
await logStructuredEvent("USER_CREATED", {
  userId: user.id,
  method: "whatsapp",
  timestamp: new Date().toISOString(),
});

// Log errors with context
logError("user_creation_failed", error, {
  phoneNumber: maskedPhone,
  attemptNumber: 3,
});
```

#### For Node.js Services (NestJS, Express)

Use the pino-based logger from `@easymo/commons`:

```typescript
import { logger, childLogger } from "@easymo/commons";

// Create a child logger with context
const serviceLogger = childLogger({ service: "wallet-service" });

// Log structured events
serviceLogger.info({ 
  event: "PAYMENT_PROCESSED",
  transactionId: tx.id,
  amount: tx.amount,
  currency: tx.currency 
}, "Payment processed successfully");

// Log errors with full context
serviceLogger.error({ 
  event: "PAYMENT_FAILED",
  error: err.message,
  stack: err.stack,
  transactionId: tx.id 
}, "Payment processing failed");
```

### Event Counters

Emit event counters for all significant actions:

```typescript
import { recordMetric } from "../_shared/observability.ts";

// Record a counter
await recordMetric("user.created", 1, { source: "whatsapp" });

// Record with dimensions for filtering
await recordMetric("payment.processed", 1, {
  provider: "momo",
  currency: "RWF",
  status: "success"
});

// Record duration metrics
const startTime = Date.now();
// ... perform operation ...
await recordDurationMetric("api.duration", startTime, {
  endpoint: "/api/users",
  method: "POST"
});
```

### Required Log Events

Every API endpoint and job MUST log:

1. **Request Start**: Method, path, relevant identifiers
   ```typescript
   logRequest("endpoint-name", req);
   ```

2. **Request Completion**: Status, duration, outcome
   ```typescript
   logResponse("endpoint-name", statusCode, { duration: durationMs });
   ```

3. **Business Events**: Significant state changes
   ```typescript
   await logStructuredEvent("ORDER_COMPLETED", { orderId, amount });
   ```

4. **Errors**: All errors with full context
   ```typescript
   logError("operation_failed", error, { context: "details" });
   ```

### Best Practices

- **Always use structured logs** (JSON format) - never plain strings
- **Include correlation IDs** (`x-request-id`, `x-correlation-id`) for request tracing
- **Mask sensitive data** (PII, credentials) before logging
- **Use consistent event names** following the pattern: `ENTITY_ACTION` (e.g., `USER_CREATED`, `PAYMENT_FAILED`)
- **Add dimensions to metrics** for better filtering and aggregation
- **Never expose stack traces in production** - `logError()` automatically filters stack traces based on environment
- **Log at appropriate levels**:
  - `error`: System errors, failures requiring attention
  - `warn`: Degraded functionality, retryable errors
  - `info`: Significant business events, API requests
  - `debug`: Detailed debugging information (disabled in production)

---

## Security

All code MUST adhere to strict security guidelines to protect user data and system integrity.

### Secret Management

**CRITICAL RULES:**

1. **NEVER expose secrets client-side**
   - Service role keys, API tokens, and credentials MUST only be used server-side
   - Use environment variables with `NEXT_PUBLIC_` prefix ONLY for truly public values
   - Validate that no secrets are in client bundles using `prebuild` script

2. **Environment Variable Guidelines**
   ```bash
   # ✅ CORRECT: Server-side only
   SUPABASE_SERVICE_ROLE_KEY=secret-key
   ADMIN_TOKEN=admin-secret
   WA_APP_SECRET=whatsapp-secret
   
   # ✅ CORRECT: Public client values
   NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
   
   # ❌ INCORRECT: Never expose secrets with PUBLIC prefix
   NEXT_PUBLIC_SERVICE_ROLE_KEY=secret-key  # WRONG!
   ```

3. **Secret Storage**
   - Production secrets in Supabase Project Settings → Edge Functions Secrets
   - Local development secrets in `.env.local` (gitignored)
   - Never commit secrets to version control
   - Use placeholder values (`CHANGEME_*`) in `.env.example`

### Webhook Signature Verification

All incoming webhooks **MUST** verify request signatures to prevent unauthorized access.

#### WhatsApp Webhooks

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

function verifyWhatsAppSignature(req: Request, rawBody: Buffer): boolean {
  const signature = req.headers.get('x-hub-signature-256');
  if (!signature) {
    throw new UnauthorizedException('missing_signature');
  }

  const appSecret = process.env.WA_APP_SECRET;
  const expected = `sha256=${createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;
  
  const provided = Buffer.from(signature);
  const comparison = Buffer.from(expected);

  if (provided.length !== comparison.length || 
      !timingSafeEqual(provided, comparison)) {
    throw new UnauthorizedException('invalid_signature');
  }

  return true;
}
```

#### Supabase Edge Functions with Admin Token

```typescript
import { requireAdminAuth } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  // Verify admin authentication
  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;
  
  // Process authenticated request
  // ...
});
```

### Data Protection

1. **Mask PII in Logs**
   ```typescript
   // ❌ WRONG: Full phone number in logs
   logger.info({ phoneNumber: "+250788123456" });
   
   // ✅ CORRECT: Masked phone number
   logger.info({ phoneNumber: "+250788***456" });
   ```

2. **Input Validation**
   - Use Zod schemas for all incoming data
   - Validate and sanitize user inputs
   - Return generic error messages to clients

3. **Database Security**
   - Enable Row Level Security (RLS) on all tables
   - Use service role key only in trusted server code
   - Query with anon key + RLS for user-facing operations

### Security Checklist

Before deploying any feature:

- [ ] No secrets exposed client-side (verified with build checks)
- [ ] Webhook signatures verified where applicable
- [ ] PII masked in all logs
- [ ] Input validation implemented with Zod
- [ ] RLS policies defined and tested
- [ ] Admin endpoints protected with authentication
- [ ] Error messages don't leak sensitive information

---

## Feature Flags

All new capabilities **MUST** be controlled by feature flags and default to OFF in production.

### Feature Flag System

EasyMO uses a centralized feature flag system defined in `packages/commons/src/feature-flags.ts`.

#### Adding a New Feature Flag

1. **Define the flag** in `feature-flags.ts`:
   ```typescript
   export type FeatureFlag =
     | "agent.chat"
     | "agent.collectPayment"
     | "wallet.service"
     | "myModule.newFeature";  // Add your flag here
   
   const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
     "agent.chat": true,
     "agent.collectPayment": false,
     "wallet.service": false,
     "myModule.newFeature": false,  // Default to OFF
   };
   ```

2. **Enable via environment variable**:
   ```bash
   # In .env or deployment config
   FEATURE_MYMODULE_NEWFEATURE=true
   ```

#### Using Feature Flags

##### In NestJS Controllers (with Guard)

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common";
import { RequireFeatureFlag } from "@easymo/commons";
import { FeatureFlagGuard } from "../guards/feature-flag.guard";

@Controller("payments")
@UseGuards(FeatureFlagGuard)
export class PaymentsController {
  
  @Get("collect")
  @RequireFeatureFlag("agent.collectPayment")
  async collectPayment() {
    // This endpoint only works if feature flag is enabled
    // Returns 403 Forbidden if disabled
  }
}
```

##### In Application Code

```typescript
import { isFeatureEnabled } from "@easymo/commons";

async function processOrder(order: Order) {
  // Check feature flag before using new functionality
  if (isFeatureEnabled("wallet.service")) {
    await walletService.debit(order.amount);
  } else {
    await legacyPaymentService.process(order);
  }
}
```

##### In Edge Functions

```typescript
import { isFeatureEnabled } from "../_shared/feature-flags.ts";

Deno.serve(async (req) => {
  // Check feature flag
  if (!isFeatureEnabled("myModule.newFeature")) {
    return json({ 
      error: "feature_disabled",
      message: "This feature is not yet available" 
    }, 403);
  }
  
  // Feature implementation
  // ...
});
```

### Feature Flag Best Practices

1. **Always default to OFF** for new features in production
2. **Use descriptive names** following the pattern: `module.capability`
3. **Document the purpose** of each flag in code comments
4. **Progressive rollout**: Enable in dev → staging → production
5. **Clean up old flags** once features are stable and fully rolled out
6. **Test both states**: Verify behavior when flag is ON and OFF
7. **Fail safely**: If flag check fails, default to safer/disabled state

### Environment-Specific Flag Configuration

```bash
# Development - enable experimental features
FEATURE_AGENT_WEBSEARCH=true
FEATURE_MARKETPLACE_RANKING=true

# Staging - enable features under test
FEATURE_AGENT_WEBSEARCH=true
FEATURE_MARKETPLACE_RANKING=true

# Production - conservative, only stable features
FEATURE_AGENT_CHAT=true
FEATURE_AGENT_WEBSEARCH=false
FEATURE_MARKETPLACE_RANKING=false
```

---

## Implementation Examples

### Complete Edge Function Example

```typescript
// supabase/functions/my-feature/index.ts
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
} from "../_shared/admin.ts";
import { 
  logStructuredEvent, 
  logError,
  recordMetric 
} from "../_shared/observability.ts";
import { isFeatureEnabled } from "../_shared/feature-flags.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const supabase = createServiceRoleClient();

const requestSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["create", "update", "delete"]),
}).strict();

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  // 1. Log incoming request
  logRequest("my-feature", req);
  
  // 2. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions();
  }
  
  // 3. Check feature flag
  if (!isFeatureEnabled("myModule.newFeature")) {
    await recordMetric("feature.disabled", 1, { feature: "my-feature" });
    return json({ error: "feature_disabled" }, 403);
  }
  
  // 4. Verify authentication
  const authResponse = requireAdminAuth(req);
  if (authResponse) {
    await recordMetric("auth.failed", 1, { endpoint: "my-feature" });
    return authResponse;
  }
  
  // 5. Parse and validate input
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    await recordMetric("validation.failed", 1, { reason: "invalid_json" });
    return json({ error: "invalid_json" }, 400);
  }
  
  const parseResult = requestSchema.safeParse(payload);
  if (!parseResult.success) {
    await recordMetric("validation.failed", 1, { reason: "invalid_schema" });
    return json({ error: "invalid_payload" }, 400);
  }
  
  const { userId, action } = parseResult.data;
  
  try {
    // 6. Business logic
    const result = await performAction(userId, action);
    
    // 7. Log success event
    await logStructuredEvent("MY_FEATURE_ACTION", {
      userId,
      action,
      success: true,
    });
    
    // 8. Record metrics
    await recordMetric("action.completed", 1, { action });
    await recordDurationMetric("action.duration", startTime, { action });
    
    // 9. Log response
    logResponse("my-feature", 200, { action });
    
    return json({ ok: true, result });
  } catch (error) {
    // 10. Error handling
    const message = error instanceof Error ? error.message : String(error);
    
    logError("my-feature.action_failed", error, { userId, action });
    await recordMetric("action.failed", 1, { action });
    
    logResponse("my-feature", 500);
    return json({ error: "action_failed", message }, 500);
  }
});
```

### Complete NestJS Service Example

```typescript
// services/my-service/src/my-feature/my-feature.service.ts
import { Injectable } from "@nestjs/common";
import { logger, childLogger, isFeatureEnabled } from "@easymo/commons";

@Injectable()
export class MyFeatureService {
  private readonly logger = childLogger({ 
    service: "my-service",
    module: "my-feature" 
  });

  async processRequest(userId: string, data: any) {
    const startTime = Date.now();
    
    // Check feature flag
    if (!isFeatureEnabled("myModule.newFeature")) {
      this.logger.warn({ 
        event: "FEATURE_DISABLED",
        feature: "myModule.newFeature",
        userId 
      });
      throw new ForbiddenException("Feature not enabled");
    }
    
    try {
      // Log request start
      this.logger.info({ 
        event: "REQUEST_START",
        userId,
        operation: "processRequest" 
      });
      
      // Business logic
      const result = await this.performOperation(userId, data);
      
      // Log success
      const duration = Date.now() - startTime;
      this.logger.info({ 
        event: "REQUEST_SUCCESS",
        userId,
        duration,
        resultId: result.id 
      });
      
      return result;
    } catch (error) {
      // Log error with context
      this.logger.error({ 
        event: "REQUEST_FAILED",
        userId,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime 
      });
      
      throw error;
    }
  }
}
```

---

## Enforcement

These ground rules are **mandatory** for all development:

- Code reviews MUST verify observability, security, and feature flag compliance
- CI/CD pipelines include automated checks for secret exposure
- Pull requests without proper logging/metrics will be rejected
- Security violations require immediate remediation

## Updates

This document is living and will be updated as patterns evolve. When adding new patterns:

1. Update this document with clear examples
2. Add utilities to `_shared` directories
3. Document in relevant service READMEs
4. Update team in development chat

---

**Last Updated**: 2025-10-27  
**Maintained by**: EasyMO Platform Team
