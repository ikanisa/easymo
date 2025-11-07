# EasyMO Troubleshooting Guide

This document provides solutions to common issues encountered during development, building, testing, and deployment of the EasyMO platform.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Build Issues](#build-issues)
- [Dependency Issues](#dependency-issues)
- [Database and Schema Issues](#database-and-schema-issues)
- [TypeScript and Type Checking Issues](#typescript-and-type-checking-issues)
- [Testing Issues](#testing-issues)
- [Environment Variable Issues](#environment-variable-issues)
- [CI/CD Issues](#cicd-issues)
- [Service-Specific Issues](#service-specific-issues)
- [Local Development Issues](#local-development-issues)

---

## Quick Reference

Common commands to fix issues:

```bash
# Clean and reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Rebuild all packages
pnpm --filter @easymo/shared build
pnpm --filter @easymo/messaging build
pnpm build

# Run all checks
pnpm lint
pnpm type-check
pnpm test
pnpm schema:verify

# Check for security issues
node scripts/assert-no-service-role-in-client.mjs

# Update schema after migrations
supabase db dump --schema public > latest_schema.sql
```

---

## Build Issues

### Issue: "Module not found" during build

**Symptoms:**
```
Error: Cannot find module '@easymo/shared'
Error: Cannot find module '@va/shared'
```

**Causes:**
- Workspace dependencies not built
- Missing exports in package.json
- Incorrect import paths

**Solutions:**

1. **Build shared packages first:**
   ```bash
   pnpm --filter @va/shared build
   pnpm --filter @easymo/shared build
   pnpm --filter @easymo/messaging build
   ```

2. **Check package.json exports:**
   ```json
   {
     "exports": {
       ".": "./dist/index.js",
       "./types": "./dist/types.js"
     }
   }
   ```

3. **Verify import paths:**
   ```typescript
   // Correct
   import { logger } from '@easymo/commons';
   
   // Incorrect (missing /src or wrong path)
   import { logger } from '@easymo/commons/logger';
   ```

---

### Issue: TypeScript compilation errors during build

**Symptoms:**
```
TS2307: Cannot find module 'X' or its corresponding type declarations
TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
```

**Solutions:**

1. **Check tsconfig paths:**
   ```bash
   # Verify all tsconfig.json files
   find . -name "tsconfig*.json" -exec cat {} \;
   ```

2. **Ensure proper extends:**
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

3. **Clean TypeScript cache:**
   ```bash
   find . -name "tsconfig.tsbuildinfo" -delete
   find . -name "*.tsbuildinfo" -delete
   pnpm type-check
   ```

---

### Issue: Out of memory during build

**Symptoms:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solutions:**

1. **Increase Node.js memory limit:**
   ```bash
   export NODE_OPTIONS="--max_old_space_size=4096"
   pnpm build
   ```

2. **Build incrementally:**
   ```bash
   # Build packages one at a time
   pnpm --filter @easymo/commons build
   pnpm --filter @easymo/db build
   pnpm --filter @easymo/messaging build
   # Then build the main app
   pnpm build
   ```

3. **For CI environments:**
   - Ensure `NODE_OPTIONS` is set in workflow environment
   - Consider splitting build into multiple jobs

---

### Issue: Vite build fails with "Transform failed"

**Symptoms:**
```
Error: Transform failed with X errors
[ERROR] Could not resolve "X"
```

**Solutions:**

1. **Check vite.config.ts:**
   ```typescript
   export default defineConfig({
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
       },
     },
   });
   ```

2. **Verify dependencies are installed:**
   ```bash
   pnpm install --frozen-lockfile
   ```

3. **Clear Vite cache:**
   ```bash
   rm -rf node_modules/.vite
   pnpm build
   ```

---

## Dependency Issues

### Issue: pnpm install warnings or errors

**Symptoms:**
```
WARN  Issues with peer dependencies found
ERR_PNPM_PEER_DEP_ISSUES
```

**Solutions:**

1. **Use correct pnpm version:**
   ```bash
   pnpm --version  # Should be >= 8.0.0
   # Install specific version if needed
   npm install -g pnpm@10.18.3
   ```

2. **Check workspace configuration:**
   ```yaml
   # pnpm-workspace.yaml
   packages:
     - "services/*"
     - "packages/*"
     - "apps/*"
     - "admin-app"
   ```

3. **Clean install:**
   ```bash
   rm -rf node_modules
   rm pnpm-lock.yaml
   pnpm install
   ```

---

### Issue: Workspace dependency version conflicts

**Symptoms:**
```
ERR_PNPM_NO_MATCHING_VERSION
Cannot resolve workspace protocol
```

**Solutions:**

1. **Use workspace protocol:**
   ```json
   {
     "dependencies": {
       "@easymo/commons": "workspace:*"
     }
   }
   ```

2. **Verify package exists in workspace:**
   ```bash
   ls packages/commons/package.json
   ```

3. **Update pnpm-lock.yaml:**
   ```bash
   pnpm install --no-frozen-lockfile
   ```

---

### Issue: Missing post-install scripts

**Symptoms:**
```
SKIPPED: Postinstall script for 'X'
```

**Solutions:**

1. **Run post-install manually:**
   ```bash
   pnpm --filter @easymo/db prisma:generate
   ```

2. **Check if scripts are defined:**
   ```json
   {
     "scripts": {
       "postinstall": "prisma generate"
     }
   }
   ```

---

## Database and Schema Issues

### Issue: Schema checksum mismatch

**Symptoms:**
```
Schema dump is out of sync with migrations.
  expected checksum: abc123...
  recorded checksum: def456...
```

**Solutions:**

1. **Update schema dump:**
   ```bash
   # Ensure Supabase is running locally or connected to remote
   supabase db dump --schema public > latest_schema.sql
   ```

2. **Add checksum comment:**
   ```bash
   # Compute checksum
   node scripts/check-schema-alignment.mjs
   
   # Add to latest_schema.sql (at the top or bottom):
   -- MIGRATIONS_CHECKSUM: <computed-hash>
   ```

3. **Verify alignment:**
   ```bash
   pnpm schema:verify
   ```

---

### Issue: Migration fails to apply

**Symptoms:**
```
Error applying migration: relation "X" already exists
Syntax error near "Y"
```

**Solutions:**

1. **Check migration hygiene:**
   ```bash
   bash scripts/check-migration-hygiene.sh
   ```

2. **Ensure additive-only changes:**
   - Use `IF NOT EXISTS` clauses
   - Don't drop or modify existing tables
   - Create new tables/columns instead

3. **Fix migration order:**
   ```bash
   # Migrations should be named with timestamps
   # Format: YYYYMMDDHHMMSS_description.sql
   ls -la supabase/migrations/
   ```

4. **Reset local database (development only):**
   ```bash
   supabase db reset
   ```

---

### Issue: Prisma migration failures

**Symptoms:**
```
Error: P3009: Failed to apply migration
Database connection failed
```

**Solutions:**

1. **Check DATABASE_URL:**
   ```bash
   echo $DATABASE_URL
   # Should be: postgresql://user:pass@host:5432/dbname
   ```

2. **Ensure database is running:**
   ```bash
   # For local development
   docker ps | grep postgres
   # Or check Supabase status
   supabase status
   ```

3. **Apply migrations manually:**
   ```bash
   pnpm --filter @easymo/db prisma:migrate:deploy
   ```

4. **Reset Prisma client:**
   ```bash
   pnpm --filter @easymo/db prisma:generate
   ```

---

## TypeScript and Type Checking Issues

### Issue: Cannot find module or type declarations

**Symptoms:**
```
TS2307: Cannot find module '@easymo/commons' or its corresponding type declarations
```

**Solutions:**

1. **Check package has types:**
   ```json
   {
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts"
   }
   ```

2. **Verify tsconfig paths:**
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@easymo/commons": ["./packages/commons/src"],
         "@easymo/*": ["./packages/*/src"]
       }
     }
   }
   ```

3. **Rebuild package with types:**
   ```bash
   pnpm --filter @easymo/commons build
   ```

---

### Issue: Type mismatch between workspaces

**Symptoms:**
```
TS2345: Argument of type 'X' is not assignable to parameter of type 'X'
Types have separate declarations of a class or interface
```

**Solutions:**

1. **Ensure single source of truth:**
   - Move shared types to common package
   - Import from one location only

2. **Check TypeScript version consistency:**
   ```bash
   # All packages should use same TypeScript version
   cat package.json packages/*/package.json | grep typescript
   ```

3. **Clear build artifacts:**
   ```bash
   find . -type d -name "dist" -exec rm -rf {} +
   pnpm build
   ```

---

### Issue: tsconfig.json not found or invalid

**Symptoms:**
```
error TS5058: The specified path does not exist: 'tsconfig.json'
```

**Solutions:**

1. **Verify file exists:**
   ```bash
   ls -la tsconfig*.json
   ```

2. **Check extends path:**
   ```json
   {
     "extends": "./tsconfig.base.json"  // Correct relative path
   }
   ```

3. **Validate JSON syntax:**
   ```bash
   cat tsconfig.json | jq .
   ```

---

## Testing Issues

### Issue: Tests fail in CI but pass locally

**Symptoms:**
- Tests pass with `pnpm test` locally
- Same tests fail in GitHub Actions

**Solutions:**

1. **Check environment variables:**
   ```bash
   # Ensure all required vars are set in CI
   # Compare local .env with GitHub secrets
   ```

2. **Run tests with CI flags:**
   ```bash
   pnpm test -- --runInBand --no-cache
   ```

3. **Check timing issues:**
   - Increase test timeouts
   - Use `waitFor` utilities for async operations
   - Avoid hardcoded delays

4. **Verify database state:**
   ```bash
   # Ensure clean database state between tests
   beforeEach(async () => {
     await resetDatabase();
   });
   ```

---

### Issue: Deno tests fail

**Symptoms:**
```
error: Uncaught ReferenceError: process is not defined
error: Cannot find module
```

**Solutions:**

1. **Check Deno permissions:**
   ```bash
   deno test --allow-env --allow-read --allow-net supabase/functions/tests/
   ```

2. **Update Deno lockfile:**
   ```bash
   deno cache --reload --lock=deno.lock --lock-write supabase/functions/**/*.ts
   ```

3. **Use Deno-compatible imports:**
   ```typescript
   // Use Deno-specific imports
   import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
   
   // Not Node.js imports
   // import { expect } from 'vitest';  // Wrong for Deno
   ```

---

### Issue: Vitest configuration errors

**Symptoms:**
```
Error: Cannot find module 'vitest/config'
Test files not found
```

**Solutions:**

1. **Check vitest.config.ts:**
   ```typescript
   import { defineConfig } from 'vitest/config';
   
   export default defineConfig({
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: './tests/setup.ts',
     },
   });
   ```

2. **Verify test patterns:**
   ```json
   {
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest"
     }
   }
   ```

---

## Environment Variable Issues

### Issue: Service role key exposed in client

**Symptoms:**
```
❌ SECURITY VIOLATION: Public env variable "NEXT_PUBLIC_X" contains forbidden name
Build failed: Server-only secrets detected
```

**Solutions:**

1. **Remove PUBLIC prefix:**
   ```bash
   # Wrong
   NEXT_PUBLIC_SERVICE_ROLE_KEY=secret
   
   # Correct
   SUPABASE_SERVICE_ROLE_KEY=secret
   ```

2. **Move to server-side:**
   - Use in API routes or edge functions only
   - Never import in client-side code

3. **Verify with script:**
   ```bash
   node scripts/assert-no-service-role-in-client.mjs
   ```

See [ENV_VARIABLES.md](./ENV_VARIABLES.md) for complete guide.

---

### Issue: Missing required environment variables

**Symptoms:**
```
Error: Environment variable "X" is not defined
undefined at runtime
```

**Solutions:**

1. **Copy from example:**
   ```bash
   cp .env.example .env
   # Fill in all CHANGEME_* values
   ```

2. **Check for typos:**
   ```bash
   # Compare variable names
   diff <(grep "^[A-Z]" .env.example | cut -d= -f1 | sort) \
        <(grep "^[A-Z]" .env | cut -d= -f1 | sort)
   ```

3. **Validate required vars:**
   ```typescript
   // In your app startup
   const requiredVars = ['DATABASE_URL', 'API_KEY'];
   for (const v of requiredVars) {
     if (!process.env[v]) {
       throw new Error(`Missing ${v}`);
     }
   }
   ```

---

## CI/CD Issues

### Issue: GitHub Actions workflow fails

**Symptoms:**
- Workflow shows red X
- Jobs fail with various errors

**Solutions:**

1. **Check workflow logs:**
   - Go to Actions tab in GitHub
   - Click on failed workflow
   - Review each job's logs

2. **Common fixes:**
   ```yaml
   # Ensure pnpm setup
   - uses: pnpm/action-setup@v4
     with:
       version: 10.18.3
   
   # Cache dependencies
   - uses: actions/setup-node@v6
     with:
       cache: pnpm
   
   # Use frozen lockfile
   - run: pnpm install --frozen-lockfile
   ```

3. **Test locally with act:**
   ```bash
   # Install act: brew install act
   act -j build-and-test
   ```

See [CI_WORKFLOWS.md](./CI_WORKFLOWS.md) for detailed troubleshooting.

---

### Issue: Deployment fails

**Symptoms:**
```
Error deploying edge function
Authentication failed
```

**Solutions:**

1. **Check secrets:**
   - Verify `SUPABASE_ACCESS_TOKEN` is set
   - Ensure `SUPABASE_PROJECT_ID` is correct

2. **Test deployment locally:**
   ```bash
   supabase functions deploy function-name --project-ref your-ref
   ```

3. **Check function syntax:**
   ```bash
   supabase functions serve function-name --env-file .env.local
   curl http://localhost:54321/functions/v1/function-name
   ```

---

## Service-Specific Issues

### Issue: Agent-Core service fails to start

**Symptoms:**
```
Error: Cannot connect to database
Port already in use
```

**Solutions:**

1. **Check DATABASE_URL:**
   ```bash
   cd services/agent-core
   cat .env | grep DATABASE_URL
   ```

2. **Ensure dependencies are built:**
   ```bash
   pnpm --filter @easymo/db build
   pnpm --filter agent-core build
   ```

3. **Check port availability:**
   ```bash
   lsof -i :4000  # Default port
   # Kill process if needed
   kill -9 <PID>
   ```

---

### Issue: WhatsApp Bot webhook errors

**Symptoms:**
```
Webhook signature verification failed
Unauthorized request
```

**Solutions:**

1. **Verify webhook secret:**
   ```bash
   # Check WA_APP_SECRET matches Meta webhook config
   echo $WA_APP_SECRET
   ```

2. **Test webhook locally:**
   ```bash
   # Use ngrok or another HTTPS tunnel
   npm run tunnel
   # Update Meta webhook URL
   ```

3. **Check signature implementation:**
   - Must use raw request body
   - Use timing-safe comparison
   - See `docs/GROUND_RULES.md` for example

---

### Issue: Voice Bridge connection issues

**Symptoms:**
```
WebSocket connection failed
OpenAI Realtime API error
```

**Solutions:**

1. **Check API keys:**
   ```bash
   echo $OPENAI_REALTIME_API_KEY
   # Ensure it's a valid OpenAI API key
   ```

2. **Verify WebSocket URL:**
   ```bash
   # Should be wss://api.openai.com/v1/realtime
   echo $OPENAI_REALTIME_URL
   ```

3. **Test connectivity:**
   ```bash
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models
   ```

---

## Local Development Issues

### Issue: Supabase local instance won't start

**Symptoms:**
```
Error starting Supabase
Docker daemon not running
```

**Solutions:**

1. **Check Docker:**
   ```bash
   docker --version
   docker ps
   # Start Docker Desktop if needed
   ```

2. **Reset Supabase:**
   ```bash
   supabase stop
   supabase start
   ```

3. **Check ports:**
   ```bash
   # Default Supabase ports: 54321, 54322, 54323
   lsof -i :54321
   ```

---

### Issue: Hot reload not working

**Symptoms:**
- Changes not reflected in browser
- Need to restart dev server

**Solutions:**

1. **Check Vite config:**
   ```typescript
   export default defineConfig({
     server: {
       watch: {
         usePolling: true,  // For Docker/WSL
       },
     },
   });
   ```

2. **Clear cache:**
   ```bash
   rm -rf node_modules/.vite
   pnpm dev
   ```

3. **Check file watchers:**
   ```bash
   # macOS/Linux
   ulimit -n  # Should be > 1024
   ulimit -n 10240
   ```

---

### Issue: pnpm not found

**Symptoms:**
```bash
bash: pnpm: command not found
```

**Solutions:**

1. **Install pnpm:**
   ```bash
   npm install -g pnpm@10.18.3
   ```

2. **Use corepack (Node 16+):**
   ```bash
   corepack enable
   corepack prepare pnpm@10.18.3 --activate
   ```

3. **Add to PATH:**
   ```bash
   echo 'export PATH="$HOME/.local/share/pnpm:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```

---

## Getting More Help

If your issue is not covered here:

1. **Search GitHub Issues:** Check for similar problems and solutions
2. **Check CI Logs:** Review recent workflow runs for patterns
3. **Review Recent Changes:** Use `git log` to find related commits
4. **Consult Documentation:**
   - [GROUND_RULES.md](./GROUND_RULES.md) - Development standards
   - [CI_WORKFLOWS.md](./CI_WORKFLOWS.md) - CI/CD details
   - [ENV_VARIABLES.md](./ENV_VARIABLES.md) - Environment configuration
5. **Ask the Team:** Post in development chat with:
   - Error message
   - Steps to reproduce
   - What you've tried
   - Relevant logs

---

## Contributing to This Guide

Found a solution to a new problem? Please add it:

1. Create a new section under the appropriate category
2. Include symptoms, causes, and solutions
3. Add example commands where applicable
4. Test the solution before documenting

---

**Last Updated**: 2025-10-29  
**Maintained by**: EasyMO Platform Team
