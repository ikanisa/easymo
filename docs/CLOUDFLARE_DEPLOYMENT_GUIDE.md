# Cloudflare Pages Deployment Guide

This guide covers deploying the EasyMO Admin Panel to Cloudflare Pages.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cloudflare Pages Setup](#cloudflare-pages-setup)
3. [Environment Variables](#environment-variables)
4. [Build Configuration](#build-configuration)
5. [GitHub Actions Deployment](#github-actions-deployment)
6. [Custom Domain Configuration](#custom-domain-configuration)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- [ ] Cloudflare account with Pages enabled
- [ ] GitHub repository connected to Cloudflare Pages
- [ ] Node.js 20.18.0 or higher
- [ ] pnpm 10.18.3 or higher
- [ ] Supabase project with API keys

### Required Secrets

You'll need these secrets configured in GitHub and/or Cloudflare:

| Secret | Where to Set | Description |
|--------|--------------|-------------|
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | Cloudflare API token with Pages:Edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Secrets | Your Cloudflare account ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Cloudflare Pages | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cloudflare Pages | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare Pages | Supabase service role key (server-side only) |

---

## Cloudflare Pages Setup

### Step 1: Create a New Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > Pages
2. Click "Create a project"
3. Select "Connect to Git"
4. Authorize and select the `ikanisa/easymo` repository

### Step 2: Configure Build Settings

| Setting | Value |
|---------|-------|
| **Project name** | `easymo-admin` |
| **Production branch** | `main` |
| **Root directory** | `admin-app` |
| **Build command** | See [Build Configuration](#build-configuration) |
| **Build output directory** | `.next` |

### Step 3: Set Environment Variables

Navigate to Settings > Environment variables and add the variables from [Environment Variables](#environment-variables).

---

## Environment Variables

### Production Environment

Add these variables in Cloudflare Pages dashboard:

```bash
# Build Configuration
NODE_VERSION=20.18.0
CF_PAGES=1
NEXT_TELEMETRY_DISABLED=1

# Public Variables (safe for client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_UI_V2_ENABLED=true

# Server-side Secrets (encrypted)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key
```

### Preview Environment

For preview deployments, you may want different values:

```bash
NEXT_PUBLIC_ENVIRONMENT=preview
NEXT_PUBLIC_ENVIRONMENT_LABEL=Preview
```

---

## Build Configuration

### Build Command

Since this is a monorepo, the build must compile shared packages first:

```bash
cd .. && pnpm --filter @va/shared build && pnpm --filter @easymo/commons build && pnpm --filter @easymo/video-agent-schema build && pnpm --filter @easymo/ui build && cd admin-app && npm run build
```

### Alternative: Using GitHub Actions

For more control, use the GitHub Actions workflow at `.github/workflows/deploy-cloudflare.yml`. This workflow:

1. Builds shared packages
2. Runs security checks
3. Lints and type-checks
4. Runs tests
5. Builds the admin app
6. Deploys to Cloudflare Pages

---

## GitHub Actions Deployment

### Setup

1. Create a Cloudflare API token:
   - Go to Cloudflare Dashboard > My Profile > API Tokens
   - Create token with `Cloudflare Pages:Edit` permission

2. Add secrets to GitHub:
   - `CLOUDFLARE_API_TOKEN`: Your API token
   - `CLOUDFLARE_ACCOUNT_ID`: Your account ID (found in Cloudflare dashboard URL)
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

### Triggering Deployments

Deployments are triggered automatically on:
- Push to `main` branch (production deploy)
- Pull requests to `main` (preview deploy)
- Manual workflow dispatch

### Manual Deployment

```bash
gh workflow run deploy-cloudflare.yml -f environment=production
```

---

## Custom Domain Configuration

### Step 1: Add Custom Domain

1. Go to Cloudflare Pages > your project > Custom domains
2. Click "Set up a custom domain"
3. Enter your domain (e.g., `admin.easymo.com`)

### Step 2: DNS Configuration

If your domain is on Cloudflare:
- DNS records are configured automatically

If your domain is external:
- Add a CNAME record pointing to `easymo-admin.pages.dev`

### Step 3: SSL/TLS

Cloudflare Pages provides automatic HTTPS with:
- Free SSL certificates
- Automatic certificate renewal
- TLS 1.3 support

---

## Troubleshooting

### Common Issues

#### Build Fails: "Cannot find package '@va/shared'"

**Cause**: Shared packages not built before admin-app

**Solution**: Ensure build command includes shared package builds:
```bash
cd .. && pnpm --filter @va/shared build && ...
```

#### Build Fails: "SECURITY VIOLATION"

**Cause**: Service role key in NEXT_PUBLIC_* variable

**Solution**: Remove sensitive keys from NEXT_PUBLIC_* variables. Only use:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 500 Error on API Routes

**Cause**: Missing environment variables on server

**Solution**: Add all required environment variables in Cloudflare Pages settings

#### Preview URL Not Working

**Cause**: Branch name may contain invalid characters

**Solution**: Use alphanumeric branch names without special characters

### Deployment Logs

View deployment logs in:
1. Cloudflare Dashboard > Pages > your project > Deployments
2. GitHub Actions > workflow run logs

### Health Check

After deployment, verify the health endpoint:

```bash
curl https://easymo-admin.pages.dev/api/health
```

### Performance Metrics

Check Cloudflare Analytics for:
- Request latency
- Cache hit ratio
- Error rates
- Geographic distribution

---

## Rollback Procedure

### Rollback to Previous Deployment

1. Go to Cloudflare Pages > your project > Deployments
2. Find the previous working deployment
3. Click the three dots menu
4. Select "Rollback to this deploy"

### Rollback via Git

```bash
git revert HEAD
git push origin main
```

---

## Security Headers

Cloudflare Pages automatically adds security headers. Additional headers are configured in `next.config.mjs`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

---

## Caching Strategy

### Static Assets

Static assets in `/_next/static/` are cached immutably:
- Cache-Control: `public, max-age=31536000, immutable`

### Service Worker

Service worker files are not cached:
- Cache-Control: `public, max-age=0, must-revalidate`

### API Routes

API routes are not cached:
- Cache-Control: `no-cache, no-store, must-revalidate`

---

## Monitoring

### Cloudflare Analytics

Access analytics in Cloudflare Dashboard > Pages > your project > Analytics:
- Page views
- Unique visitors
- Bandwidth usage
- Geographic distribution

### Error Tracking

For production error tracking, consider:
- Sentry (already configured)
- Cloudflare Workers logging

---

## Cost Optimization

### Cloudflare Pages Free Tier

- 500 builds/month
- Unlimited requests
- Unlimited bandwidth
- 1 custom domain

### Pro Tips

1. Use preview deployments only for PRs
2. Optimize build times by caching dependencies
3. Use Cloudflare R2 for large static assets

---

## Support Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [GitHub Issues](https://github.com/ikanisa/easymo/issues)
