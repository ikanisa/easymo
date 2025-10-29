# Cloudflare Pages Deployment Guide - EasyMO Admin Panel

## Overview

This guide provides step-by-step instructions for deploying the EasyMO Admin Panel to Cloudflare Pages with the domain `easymo.ikanisa.com`.

## Prerequisites

### 1. Cloudflare Account Setup
- [ ] Cloudflare account with Pages enabled
- [ ] Domain `ikanisa.com` added to Cloudflare
- [ ] API token created with Pages permissions

### 2. Required Secrets
Configure these secrets in your Cloudflare Pages project and GitHub repository:

#### Cloudflare Pages Environment Variables (Required)
```bash
# Public variables (safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_ENVIRONMENT_LABEL=Production
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_DEFAULT_ACTOR_ID=<default-actor-id>

# Server-side secrets (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ADMIN_SESSION_SECRET=<min-16-char-secret>
ADMIN_ACCESS_CREDENTIALS=<json-array-of-credentials>
ADMIN_TOKEN=<admin-api-token>
EASYMO_ADMIN_TOKEN=<admin-api-token>
```

#### GitHub Secrets (for CI/CD)
- `CLOUDFLARE_API_TOKEN` - API token with Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_DEFAULT_ACTOR_ID` - Default actor ID

### 3. Domain Configuration
- [ ] DNS A/CNAME records configured for `easymo.ikanisa.com`
- [ ] SSL/TLS certificate (automatic via Cloudflare)
- [ ] Custom domain added to Cloudflare Pages project

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

The repository includes an automated workflow at `.github/workflows/cloudflare-pages-deploy.yml`.

**Setup:**
1. Add required secrets to GitHub repository settings
2. Push changes to `main` branch or trigger manual deployment
3. Monitor workflow progress in GitHub Actions tab

**Workflow triggers:**
- Push to `main` branch affecting `admin-app/**`
- Manual trigger via GitHub Actions UI

### Method 2: Manual Deployment via Wrangler CLI

**Requirements:**
- Node.js 18+
- pnpm 10.18.3+
- Wrangler CLI installed globally

**Steps:**
```bash
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Build shared packages
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# 3. Navigate to admin-app
cd admin-app

# 4. Install admin-app dependencies
npm ci

# 5. Build for Cloudflare Pages
npm run build
npx @cloudflare/next-on-pages

# 6. Deploy to Cloudflare Pages
npx wrangler pages deploy .vercel/output/static \
  --project-name=easymo-admin \
  --branch=main
```

### Method 3: Cloudflare Dashboard Direct Connection

**Setup:**
1. Log in to Cloudflare Dashboard
2. Navigate to Pages → Create a project
3. Connect to GitHub repository `ikanisa/easymo`
4. Configure build settings:
   - **Build command:** `cd admin-app && npm ci && npm run build && npx @cloudflare/next-on-pages`
   - **Build output directory:** `admin-app/.vercel/output/static`
   - **Root directory:** `/`
   - **Node version:** 18
5. Add environment variables from Cloudflare Pages dashboard
6. Deploy

## Build Configuration

### Next.js Configuration
The `admin-app/next.config.mjs` is configured for Cloudflare Pages compatibility.

### Wrangler Configuration
The `admin-app/wrangler.toml` includes:
- Node.js compatibility flags
- Pages output directory
- Environment-specific settings

## Security Configuration

### Headers
Security headers are configured in `admin-app/public/_headers`:
- Content Security Policy (CSP)
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options
- X-Content-Type-Options
- Referrer Policy

### Routes
Static asset routing is configured in `admin-app/public/_routes.json`.

## Post-Deployment Verification

### 1. Domain & SSL
```bash
# Test domain resolution
curl -I https://easymo.ikanisa.com

# Verify SSL certificate
openssl s_client -connect easymo.ikanisa.com:443 -servername easymo.ikanisa.com
```

### 2. Application Health
- [ ] Navigate to `https://easymo.ikanisa.com`
- [ ] Verify login page loads correctly
- [ ] Test login with valid credentials
- [ ] Verify session cookie is set (HttpOnly, Secure, SameSite)
- [ ] Test navigation across dashboard pages
- [ ] Verify API routes respond correctly
- [ ] Check browser console for errors
- [ ] Test logout functionality

### 3. Security Verification
```bash
# Check security headers
curl -I https://easymo.ikanisa.com | grep -E "Content-Security-Policy|Strict-Transport-Security|X-Frame-Options"

# Verify no secrets in client bundle
curl https://easymo.ikanisa.com/_next/static/chunks/*.js | grep -i "service.*role\|secret"
```

### 4. Performance
- [ ] Test initial page load time (< 3s)
- [ ] Verify service worker registration (PWA)
- [ ] Check Lighthouse scores (Performance, Accessibility, Best Practices, SEO)
- [ ] Test offline functionality

## Environment Variables Reference

### Public Variables (Client-Safe)
| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://vacltfdslodqybxojytc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key | `eyJhbG...` |
| `NEXT_PUBLIC_ENVIRONMENT_LABEL` | Environment name display | `Production` |
| `NEXT_PUBLIC_USE_MOCKS` | Enable mock data | `false` |
| `NEXT_PUBLIC_DEFAULT_ACTOR_ID` | Default actor UUID | `00000000-0000-0000-0000-000000000001` |

### Server-Side Variables (Private)
| Variable | Purpose | Example |
|----------|---------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access | `eyJhbG...` |
| `ADMIN_SESSION_SECRET` | Session token signing | `min-16-chars-random-string` |
| `ADMIN_ACCESS_CREDENTIALS` | Operator credentials | `[{"actorId":"...","token":"..."}]` |
| `ADMIN_TOKEN` | Edge function API key | `secret-token` |
| `AGENT_CORE_INTERNAL_TOKEN` | Microservice auth | `internal-token` |

## Monitoring & Observability

### Cloudflare Analytics
- Monitor requests, bandwidth, and errors in Cloudflare Dashboard
- Set up alerts for error rate spikes
- Review Web Analytics for user behavior

### Application Logs
- View function logs in Cloudflare Pages dashboard
- Filter by severity level
- Search by request ID for tracing

### Custom Metrics
The admin panel includes structured logging with:
- Correlation IDs (`x-request-id`)
- Actor tracking (`x-actor-id`)
- Event logging with context

## Troubleshooting

### Build Failures
**Issue:** Build fails with "workspace:* protocol not supported"
```bash
# Solution: Ensure shared packages are built first
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

**Issue:** TypeScript errors during build
```bash
# Solution: Check tsconfig.json and verify types are installed
cd admin-app && npm ci
```

### Runtime Errors
**Issue:** "Unauthorized" on API routes
- Verify `ADMIN_SESSION_SECRET` is set correctly
- Check session cookie is being set
- Verify middleware configuration

**Issue:** Database connection errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` is valid
- Ensure RLS policies allow access

### Deployment Errors
**Issue:** "Invalid API token"
- Regenerate Cloudflare API token with Pages permissions
- Update `CLOUDFLARE_API_TOKEN` secret in GitHub

**Issue:** "Project not found"
- Create project in Cloudflare Pages dashboard
- Ensure `projectName` matches in workflow

## Rollback Procedure

### Quick Rollback (via Cloudflare Dashboard)
1. Navigate to Cloudflare Pages → easymo-admin
2. Go to Deployments tab
3. Find last known good deployment
4. Click "Rollback to this deployment"

### Git-based Rollback
```bash
# Revert to previous commit
git revert <bad-commit-sha>
git push origin main

# Or rollback to specific version
git reset --hard <good-commit-sha>
git push --force origin main  # Use with caution
```

## Support & Escalation

### Documentation Resources
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Admin Panel README](../admin-app/README.md)
- [Environment Variables Guide](../docs/ENV_VARIABLES.md)

### Incident Contacts
- DevOps Team: [Configure in CODEOWNERS]
- Security Team: [Configure incident response]
- On-call rotation: [Configure PagerDuty/similar]

## Checklist Before Production

- [ ] All environment variables configured
- [ ] Domain DNS configured and propagating
- [ ] SSL certificate active
- [ ] Security headers verified
- [ ] Login/logout flow tested
- [ ] API routes functional
- [ ] Service worker registered
- [ ] Offline mode working
- [ ] Performance benchmarks met (Lighthouse >90)
- [ ] Error monitoring configured
- [ ] Rollback procedure documented
- [ ] Incident contacts updated
- [ ] Team trained on deployment process
- [ ] Documentation reviewed and approved

## Next Steps

1. **Initial Deployment**
   - Follow Method 1 (GitHub Actions) for first deployment
   - Verify all checklist items
   - Document any issues encountered

2. **Monitoring Setup**
   - Configure Cloudflare alerts
   - Set up external monitoring (Uptime Robot, Pingdom)
   - Create dashboards for key metrics

3. **Optimization**
   - Review Core Web Vitals
   - Optimize bundle size
   - Implement edge caching strategies
   - Configure rate limiting if needed

4. **Documentation**
   - Update team wiki with deployment notes
   - Record lessons learned
   - Create video walkthrough for team

---

**Last Updated:** 2025-10-29
**Maintainer:** DevOps Team
**Version:** 1.0.0
