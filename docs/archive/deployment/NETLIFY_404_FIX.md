# Netlify 404 Fix Documentation

## Problem
The admin panel at `https://easymo-admin.netlify.app/` was returning a 404 error despite being deployed to Netlify.

## Root Cause
The `netlify.toml` configuration was incorrect for a pnpm monorepo setup with Next.js 15:

1. **Build Command Issue**: Used `npm run build` from the `admin-app` directory, which couldn't access workspace dependencies in `packages/`
2. **Incorrect Publish Directory**: Set to `.next` relative to base, but the `@netlify/plugin-nextjs` should handle this automatically
3. **Outdated Node Version**: Used Node 18 instead of Node 20 (required by package.json)
4. **Missing pnpm**: No pnpm version specified, and build used npm instead of pnpm

## Solution
Updated `netlify.toml` with the correct configuration:

```toml
# Netlify Configuration for EasyMO Admin Panel
# Next.js 15 in a pnpm monorepo

[build]
  # Set base to admin-app so the Netlify Next.js plugin can find the app
  base = "admin-app"
  # Build workspace dependencies from root, then build the admin app
  command = "cd .. && pnpm install --frozen-lockfile && pnpm --filter @va/shared build && pnpm --filter @easymo/commons build && pnpm --filter @easymo/video-agent-schema build && cd admin-app && pnpm build"

[build.environment]
  NODE_VERSION = "20.18.0"
  PNPM_VERSION = "10.18.3"

# The @netlify/plugin-nextjs plugin automatically handles Next.js deployment
# It creates Netlify Functions for server-side rendering and API routes
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Key Changes

1. **Base Directory**: Set to `"admin-app"` so the Netlify Next.js plugin can detect the Next.js app by finding `next.config.mjs`

2. **Build Command**: 
   - Navigate to root: `cd ..`
   - Install all dependencies: `pnpm install --frozen-lockfile`
   - Build workspace packages in order:
     - `pnpm --filter @va/shared build`
     - `pnpm --filter @easymo/commons build`
     - `pnpm --filter @easymo/video-agent-schema build`
   - Return to admin-app: `cd admin-app`
   - Build the admin app: `pnpm build`

3. **Removed**:
   - `publish` directory (the plugin handles this automatically)
   - Manual redirects (the plugin creates these)
   - Manual headers (handled by `admin-app/public/_headers`)
   - `netlify-plugin-no-more-404` plugin (not needed)

4. **Environment**:
   - Updated Node version to `20.18.0`
   - Added `PNPM_VERSION = "10.18.3"`

## How the Plugin Works

The `@netlify/plugin-nextjs` plugin:
1. Detects the Next.js app in the `base` directory by finding `next.config.mjs`
2. Automatically creates Netlify Functions for:
   - Server-side rendering (SSR)
   - API routes
   - Server components
3. Sets up proper routing and redirects
4. Handles static asset optimization

## Testing Locally

To test the build locally:

```bash
cd /path/to/easymo-

# Create minimal .env.local in admin-app
cat > admin-app/.env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EASYMO_ADMIN_TOKEN=your-admin-token
ADMIN_SESSION_SECRET=your-session-secret-min-16-chars
EOF

# Run the build as Netlify would
cd admin-app
cd ..
pnpm install --frozen-lockfile
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/video-agent-schema build
cd admin-app
pnpm build

# Check for success
ls -la .next
```

Expected output:
```
✓ Compiled successfully
✓ Routes: 100+ static and dynamic routes
✓ Build output: admin-app/.next
```

## Netlify Environment Variables

Ensure these environment variables are set in Netlify (Site settings → Environment variables):

### Required
- `NEXT_PUBLIC_SUPABASE_URL`: `https://vacltfdslodqybxojytc.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (server-only)
- `EASYMO_ADMIN_TOKEN`: Admin API token for Edge Functions
- `ADMIN_SESSION_SECRET`: Minimum 16 characters for session signing

### Optional
- `NEXT_PUBLIC_USE_MOCKS`: Set to `"false"` in production
- `NEXT_PUBLIC_UI_V2_ENABLED`: Set to `"true"` to enable new UI kit

## Deployment Checklist

- [x] Update `netlify.toml` configuration
- [x] Test build locally
- [x] Verify environment variables are set in Netlify
- [ ] Merge PR to main branch
- [ ] Trigger Netlify deployment
- [ ] Verify deployment at `https://easymo-admin.netlify.app/`
- [ ] Test login functionality
- [ ] Test a few key pages (dashboard, users, settings)

## Troubleshooting

### Build Fails with "Cannot find package"
- Ensure workspace dependencies are built first
- Check that pnpm is installed: `PNPM_VERSION = "10.18.3"`

### 404 Error Persists
- Check Netlify build logs for errors
- Verify the `.next` folder was created in `admin-app/`
- Ensure `@netlify/plugin-nextjs` is listed in build plugins

### Environment Variable Errors
- Check that all required variables are set in Netlify
- Use "Deploy Preview" context for testing before production

## References

- [Netlify Next.js Plugin Documentation](https://github.com/netlify/netlify-plugin-nextjs)
- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Admin App README](admin-app/README.md)
