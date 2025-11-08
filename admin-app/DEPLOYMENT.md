# Admin App Deployment Guide

This guide explains how to fix the "Supabase environment variables are missing" error and deploy the admin app to Netlify.

## Error Explanation

The error occurs when the Next.js build is created without the required public environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Next.js inlines these values at build time, so they **must** be present during the build process.

## Quick Fix for Netlify

### 1. Set Environment Variables in Netlify

Go to **Netlify Dashboard** → **Site settings** → **Environment variables** and add:

#### Public Variables (Browser-Safe)
These are required at **build time** and exposed to the browser:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...  # Your Supabase Anon/Publishable key
```

#### Server-Only Variables (Never prefix with NEXT_PUBLIC_)
These are used by API routes and server components:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Your Supabase Service Role key
EASYMO_ADMIN_TOKEN=your-admin-token-here
ADMIN_SESSION_SECRET=your-session-secret-min-16-chars
```

⚠️ **Security**: Only `NEXT_PUBLIC_*` variables are exposed to the browser. Never prefix server secrets with `NEXT_PUBLIC_`.

### 2. Trigger Redeploy

After setting the environment variables:
1. Go to **Deploys** tab in Netlify
2. Click **Trigger deploy** → **Clear cache and deploy site**

## Architecture Overview

The app uses a **split environment configuration** to prevent leaking server secrets:

### Client-Side (Browser)
- **File**: `lib/env-client.ts`
- **Supabase Client**: `lib/supabase-client.ts`
- **Uses**: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Safe**: Only anon/publishable keys, exposed to browser

### Server-Side (API Routes, Server Components)
- **File**: `lib/env-server.ts` (has `server-only` import)
- **Supabase Admin**: `lib/server/supabase-admin.ts` (has `server-only` import)
- **Uses**: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- **Protected**: Never bundled in client code

## Build Process

The build command runs:
```bash
node scripts/check-env.js && next build
```

**Check Script** (`scripts/check-env.js`):
- Validates `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present
- Fails fast if missing, preventing broken deploys

## Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your values:
   ```bash
   # Public (client-safe)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # Server-only
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   EASYMO_ADMIN_TOKEN=your-admin-token
   ADMIN_SESSION_SECRET=min-16-chars-secret
   ```

3. Build and run:
   ```bash
   npm ci
   npm run build
   npm start
   ```

## Mock Mode (Development Only)

For local development without Supabase:

```bash
NEXT_PUBLIC_USE_MOCKS=true npm run dev
```

⚠️ **Production**: Mock mode is automatically disabled in production builds (enforced by security check).

## Troubleshooting

### Error: "Supabase environment variables are missing"
- **Cause**: Public env vars not set at build time
- **Fix**: Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Netlify → Environment variables → Redeploy

### Error: Server code importing in client bundle
- **Cause**: Missing `server-only` import in server modules
- **Fix**: Ensure all files in `lib/server/` and `lib/env-server.ts` have `import "server-only";` at the top

### Build succeeds but runtime errors
- **Cause**: Server-only variables not set in Netlify
- **Fix**: Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EASYMO_ADMIN_TOKEN` to Netlify environment variables

### Changes not reflected after deploy
- **Cause**: Cached build
- **Fix**: Use "Clear cache and deploy site" in Netlify

## Security Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Netlify
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set **without** `NEXT_PUBLIC_` prefix
- [ ] All server-only modules have `import "server-only";`
- [ ] No imports of `lib/server/*` or `lib/env-server.ts` from client components
- [ ] Build check passes locally: `npm run build`

## References

- [Supabase Next.js Documentation](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
