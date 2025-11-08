# Admin App Deployment Guide

## The Problem

The error "Supabase environment variables are missing" occurs when:
1. Environment variables are not set in Netlify at build time
2. Client code tries to access server-only secrets (security violation)
3. The build bundles are created without the required `NEXT_PUBLIC_*` variables

## Solution Overview

We've implemented a secure separation between client-safe and server-only environment variables:

- **Client-safe** (`env-client.ts`): Only accesses `NEXT_PUBLIC_*` variables that are safe to expose in browser bundles
- **Server-only** (`env-server.ts`): Protected by `server-only` package, handles service role keys
- **Backward-compatible** (`runtime-config.ts`): Provides safe fallbacks for existing code

## Required Environment Variables

### In Netlify Site Settings → Environment Variables

#### Public (Client-side - exposed in browser bundles)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...your-anon-key
```

#### Server-only (API routes, server components, Netlify Functions)
```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your-service-role-key
EASYMO_ADMIN_TOKEN=your-admin-token-here
ADMIN_SESSION_SECRET=your-session-secret-min-16-chars
```

⚠️ **CRITICAL**: Never prefix server secrets with `NEXT_PUBLIC_` as they will be exposed to the browser!

## Deployment Steps

### 1. Set Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add all required variables listed above
4. Set them for both **Production** and **Deploy Previews** contexts

### 2. Trigger a New Deploy

After setting the environment variables:
- Go to **Deploys** → **Trigger deploy** → **Deploy site**
- Or push a new commit to trigger automatic deployment

The build process will now:
1. Run `scripts/check-env.js` to verify required variables are present
2. Inline `NEXT_PUBLIC_*` variables into client bundles
3. Keep server-only variables accessible only to Netlify Functions

### 3. Verify the Deployment

After deployment:
1. Visit `https://easymo-admin.netlify.app`
2. Check browser console - should see no Supabase errors
3. Try logging in - API routes should work with service role key

## Architecture

### File Structure
```
admin-app/
├── lib/
│   ├── env-client.ts        # Client-safe env parsing
│   ├── env-server.ts        # Server-only env parsing (uses 'server-only')
│   ├── runtime-config.ts    # Backward-compatible wrapper
│   ├── supabase-client.ts   # Browser client (uses anon key)
│   └── server/
│       └── supabase-admin.ts # Admin client (uses service role)
├── scripts/
│   └── check-env.js         # Pre-build validation
└── .env.example             # Environment variable documentation
```

### Security Model

1. **Browser code** imports from:
   - `lib/env-client.ts` → Only reads `NEXT_PUBLIC_*`
   - `lib/supabase-client.ts` → Uses anon/publishable key

2. **Server code** imports from:
   - `lib/env-server.ts` → Protected by `server-only` package
   - `lib/server/supabase-admin.ts` → Uses service role key

3. **Build-time check**:
   - `scripts/check-env.js` fails fast if public vars missing
   - Prevents deploying broken builds

### How It Works

#### Before (Broken)
```typescript
// runtime-config.ts checked BOTH client and server vars
// This forced service role key check into browser bundles! ❌
if (!hasClientSupabaseConfig() && !hasServiceSupabaseConfig()) {
  throw new Error("...SUPABASE_SERVICE_ROLE_KEY..."); // Browser sees this!
}
```

#### After (Fixed)
```typescript
// env-client.ts - Safe for browser ✅
export function shouldUseMocksClient(): boolean {
  const supabaseReady = hasClientSupabaseConfig(); // Only checks NEXT_PUBLIC_*
  if (process.env.NODE_ENV === "production" && !supabaseReady) {
    throw new Error("...NEXT_PUBLIC_SUPABASE_URL..."); // Safe error
  }
}

// env-server.ts - Server only ✅
import 'server-only'; // Build fails if imported from client
export function shouldUseMocksServer(): boolean {
  // Can safely check service role key here
}
```

## Local Development

### Setup
1. Copy `.env.example` to `.env.local`:
   ```bash
   cd admin-app
   cp .env.example .env.local
   ```

2. Fill in your Supabase credentials:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-local-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_URL=https://your-local-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. Install and run:
   ```bash
   npm ci
   npm run dev
   ```

### Mock Mode (Optional)
For local development without Supabase:
```bash
NEXT_PUBLIC_USE_MOCKS=true npm run dev
```

## Troubleshooting

### "Supabase environment variables are missing" in browser
- **Cause**: `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` not set at build time
- **Fix**: Set in Netlify environment variables and redeploy

### "requireServiceSupabaseConfig cannot be called from browser code"
- **Cause**: Client component importing from `env-server.ts` or using `supabase-admin.ts`
- **Fix**: Use `env-client.ts` and `supabase-client.ts` for client components

### Build succeeds but API routes fail
- **Cause**: Server-only variables (`SUPABASE_SERVICE_ROLE_KEY`) not set
- **Fix**: Set in Netlify environment variables (without `NEXT_PUBLIC_` prefix)

### "Module not found: 'server-only'"
- **Cause**: Missing dependency
- **Fix**: Run `npm ci` to install all dependencies

## Supabase Edge Functions

If using Edge Functions (e.g., `/supabase/functions/`), also set:
1. In Netlify (for admin app to call them):
   ```bash
   EASYMO_ADMIN_TOKEN=your-token
   ```

2. In Supabase project secrets (for functions themselves):
   ```bash
   supabase secrets set EASYMO_ADMIN_TOKEN=your-token
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
   ```

## References

- [Supabase Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [Next.js server-only Package](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment)

## Quick Checklist

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` in Netlify
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Netlify
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in Netlify (no NEXT_PUBLIC_ prefix!)
- [ ] Set `SUPABASE_URL` in Netlify
- [ ] Set `EASYMO_ADMIN_TOKEN` in Netlify
- [ ] Trigger new deploy
- [ ] Verify login works at https://easymo-admin.netlify.app
- [ ] Check browser console has no Supabase errors
