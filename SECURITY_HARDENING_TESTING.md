# Security Hardening Changes - Testing Guide

This document describes the security hardening changes made to easymo and how to test them.

## Overview

This PR implements security hardening focused on:
1. Environment variable documentation and separation
2. Secure cookie handling in production
3. Client-side secret detection
4. CI/CD security guardrails
5. Database RLS policy review template

## Changes Made

### 1. Environment Configuration (`easymo/docs/env/env.sample`)

**Changes:**
- Added security warnings at the top of the file
- Clearly marked all server-only variables (SUPABASE_SERVICE_ROLE_KEY, API keys, secrets)
- Added comments to prevent copying server secrets to NEXT_PUBLIC_* variables

**Testing:**
```bash
# Review the env.sample file
cat easymo/docs/env/env.sample

# Verify warnings are clear and server-only vars are marked
grep "SERVER-ONLY" easymo/docs/env/env.sample
```

### 2. Middleware Cookie Hardening (`easymo/admin-app/middleware.ts`)

**Changes:**
- Removed NEXT_PUBLIC_DEFAULT_ACTOR_ID fallback in production
- Set `httpOnly: true` for admin_actor_id cookie in production
- Set `secure: true` for admin_actor_id cookie in production
- Only use ADMIN_DEFAULT_ACTOR_ID in development

**Testing:**
```bash
# In development:
# - Cookie should be readable by JavaScript (httpOnly: false)
# - ADMIN_DEFAULT_ACTOR_ID should work as fallback

# In production:
# - Cookie should NOT be readable by JavaScript (httpOnly: true)
# - Cookie should require HTTPS (secure: true)
# - NEXT_PUBLIC_DEFAULT_ACTOR_ID should NOT be used

# Test by starting the admin-app:
cd easymo/admin-app
NODE_ENV=development npm run dev
# Check browser DevTools > Application > Cookies
# Cookie should be visible and readable

# Simulate production:
NODE_ENV=production npm run build
NODE_ENV=production npm start
# Check browser DevTools > Application > Cookies
# Cookie should have HttpOnly and Secure flags
```

### 3. Client Provider Updates (`easymo/admin-app/components/providers/AppProviders.tsx`)

**Changes:**
- Cookie auto-setting now only happens in development mode
- In production, cookie setting is blocked at the client level

**Testing:**
```bash
# In development: Cookie should auto-set if NEXT_PUBLIC_DEFAULT_ACTOR_ID is present
# In production: Cookie should NOT auto-set from client code

# Check the code logic:
grep -A 10 "NODE_ENV" easymo/admin-app/components/providers/AppProviders.tsx
```

### 4. Secret Detection Script (`tools/scripts/check-client-secrets.mjs`)

**Changes:**
- New Node.js script that scans client-facing directories
- Detects references to server-only secrets (SUPABASE_SERVICE_ROLE_KEY, etc.)
- Exits with non-zero status if violations found
- Excludes server-side code (API routes, middleware, lib/server/)

**Testing:**
```bash
# Run the script manually
node tools/scripts/check-client-secrets.mjs

# Expected output: ✅ No server secrets found in client code!

# Test with a violation (create a test file):
echo "const key = process.env.SUPABASE_SERVICE_ROLE_KEY" > /tmp/test-violation.tsx
cp /tmp/test-violation.tsx easymo/admin-app/components/test-violation.tsx

# Run again - should detect the violation:
node tools/scripts/check-client-secrets.mjs
# Expected: ❌ SECURITY VIOLATION with details

# Clean up test:
rm easymo/admin-app/components/test-violation.tsx
```

### 5. CI Secret Guard Workflow (`.github/workflows/ci-secret-guard.yml`)

**Changes:**
- New GitHub Actions workflow
- Runs on push and pull requests
- Executes check-client-secrets.mjs
- Builds admin-app to verify no regressions

**Testing:**
```bash
# The workflow will run automatically on push to GitHub
# You can also test locally:

# Test secret detection:
node tools/scripts/check-client-secrets.mjs

# Test build (requires dependencies):
cd easymo/admin-app
npm ci
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-key \
NEXT_PUBLIC_USE_MOCKS=true \
npm run build

# Check that build succeeds
ls -la .next/
```

### 6. Database Migration (`supabase/migrations/20251027073908_security_hardening_rls_client_settings.sql`)

**Changes:**
- Template migration for RLS policy review
- Creates client_settings view for safe client configuration
- Includes audit queries and security checklist
- **NOT automatically applied** - requires DBA review

**Testing:**
```bash
# Review the migration file:
cat supabase/migrations/20251027073908_security_hardening_rls_client_settings.sql

# DO NOT RUN automatically - DB owners must review first

# DBAs can use these queries to review current policies:

# 1. List all policies granting SELECT to anon role:
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND roles @> ARRAY['anon']
  AND cmd IN ('SELECT', 'ALL')
ORDER BY tablename, policyname;

# 2. List all table grants to anon role:
SELECT table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'anon'
  AND table_schema = 'public'
ORDER BY table_name;

# 3. Test the client_settings view (after applying migration):
SELECT * FROM public.client_settings;

# The file includes:
# - Documentation of current policies
# - Template for revoking overly permissive policies
# - Client-safe settings view creation
# - Security verification queries
# - Rollback plan

# DBA should:
# 1. Run the audit queries above in staging
# 2. Review all policies granting SELECT to 'anon'
# 3. Test in staging environment
# 4. Uncomment and customize the revocation section as needed
# 5. Apply to production with rollback plan ready
```

## Security Checklist

Before merging this PR, verify:

- [ ] Environment sample clearly marks server-only secrets
- [ ] Middleware only uses ADMIN_DEFAULT_ACTOR_ID in development
- [ ] Middleware sets httpOnly and secure cookies in production
- [ ] AppProviders only auto-sets cookie in development
- [ ] check-client-secrets.mjs runs successfully
- [ ] CI workflow is configured and passing
- [ ] Database migration reviewed by DBA (not auto-applied)
- [ ] No server secrets are exposed to client bundles

## Manual Testing Procedures

### Test 1: Cookie Security in Production

1. Build and run admin-app in production mode:
   ```bash
   cd easymo/admin-app
   NODE_ENV=production npm run build
   NODE_ENV=production npm start
   ```

2. Open browser DevTools → Application → Cookies
3. Verify `admin_actor_id` cookie has:
   - HttpOnly flag set to ✓
   - Secure flag set to ✓ (requires HTTPS - use local tunnel or reverse proxy for testing)
   - SameSite set to Lax

**Note:** To properly test the Secure flag, you'll need to serve the app over HTTPS. Options:
- Use ngrok or cloudflared tunnel: `npx cloudflared tunnel --url http://localhost:3000`
- Set up local HTTPS with mkcert
- Deploy to a staging environment with HTTPS

### Test 2: Development Convenience Still Works

1. Set NEXT_PUBLIC_DEFAULT_ACTOR_ID in .env.local:
   ```
   NEXT_PUBLIC_DEFAULT_ACTOR_ID=12345678-1234-1234-1234-123456789abc
   ```

2. Run in development:
   ```bash
   cd easymo/admin-app
   npm run dev
   ```

3. Verify:
   - Cookie is set automatically
   - API calls work without manually setting headers
   - Cookie is readable in DevTools (not HttpOnly in dev)

### Test 3: Secret Detection Script

1. Run the script:
   ```bash
   node tools/scripts/check-client-secrets.mjs
   ```

2. Verify it passes (exit code 0)

3. Test with intentional violation:
   ```bash
   # Create test directory and file outside source tree
   mkdir -p /tmp/easymo-test
   echo "console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)" > /tmp/easymo-test/test-violation.tsx
   
   # Copy to admin-app (ensure cleanup)
   cp /tmp/easymo-test/test-violation.tsx easymo/admin-app/components/test-violation.tsx
   
   # Run script - should fail
   node tools/scripts/check-client-secrets.mjs
   
   # Clean up - IMPORTANT: Always remove test file
   rm easymo/admin-app/components/test-violation.tsx
   rm -rf /tmp/easymo-test
   
   # Verify clean state
   git status
   ```

## Rollback Plan

If issues are discovered after deployment:

1. **Cookie Issues**: Revert middleware.ts changes
2. **Build Issues**: Check CI workflow logs for specific errors
3. **Database Issues**: Use rollback queries documented in migration file
4. **Script False Positives**: Update SERVER_SIDE_PATTERNS in check-client-secrets.mjs

## Notes for Reviewers

- This PR contains security hardening changes ready for review and testing
- Database migration requires DBA review and approval before applying
- Test thoroughly in staging environment before production deployment
- Monitor application logs for access denied errors after deployment
- Consider gradual rollout with feature flags if available

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Cookie Security Best Practices](https://owasp.org/www-community/controls/SecureCookieAttribute)
