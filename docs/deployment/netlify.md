# Netlify Deployment

Netlify hosts the admin app frontend.

## Build

```bash
# Build shared deps, then admin app
pnpm run build:deps
pnpm --filter @easymo/admin-app run build
```

Configure the Netlify site to run the build above. Follow Netlify's Next.js guidance for publish
settings.

## Required Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_ENVIRONMENT_LABEL (optional)

## Pre-deploy Checks

```bash
pnpm deploy:check
```

## Rollback
- Use the Netlify UI to promote the previous successful deploy.
