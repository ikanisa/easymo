# Cloudflare Pages Deployment Documentation

## Quick Links

- 🚀 **[Quick Start Guide](./cloudflare-pages-quick-start.md)** - Deploy in 20 minutes
- 📖 **[Complete Deployment Guide](./cloudflare-pages-deployment.md)** - Comprehensive instructions
- ✅ **[Prerequisites Checklist](./cloudflare-pages-prerequisites-checklist.md)** - Readiness verification
- 🧪 **[Testing & Validation](./cloudflare-pages-testing.md)** - Quality assurance procedures

## Overview

The EasyMO Admin Panel is deployed to **Cloudflare Pages** at:
- **Production:** https://easymo.ikanisa.com

This documentation covers the complete deployment lifecycle from initial setup to production rollout.

## What's Included

### Configuration Files
- `admin-app/wrangler.toml` - Cloudflare Pages configuration
- `admin-app/public/_headers` - Security headers (CSP, HSTS, etc.)
- `admin-app/public/_routes.json` - Static asset routing
- `.github/workflows/cloudflare-pages-deploy.yml` - Automated deployment

### Documentation
1. **Quick Start** (20 min) - Get deployed fast with GitHub Actions
2. **Complete Guide** (9.6KB) - Detailed deployment procedures
3. **Prerequisites Checklist** (10.7KB) - 100+ verification items
4. **Testing Guide** (12.3KB) - Pre and post-deployment validation

### Scripts
- `scripts/setup-cloudflare-env.sh` - Environment variable configuration helper

## Deployment Options

### Option 1: GitHub Actions (Recommended)
**Time:** ~20 minutes  
**Best for:** Production deployments, CI/CD automation

1. Configure GitHub secrets
2. Create Cloudflare Pages project
3. Push to main branch
4. Automatic deployment

[→ Quick Start Guide](./cloudflare-pages-quick-start.md#method-1-github-actions-recommended)

### Option 2: Manual CLI Deployment
**Time:** ~15 minutes  
**Best for:** Testing, one-off deployments

1. Install Wrangler CLI
2. Build the application
3. Deploy via command line

[→ Quick Start Guide](./cloudflare-pages-quick-start.md#method-2-manual-cli-deployment)

### Option 3: Cloudflare Dashboard
**Time:** ~10 minutes  
**Best for:** Initial setup, non-technical users

1. Connect GitHub repository
2. Configure build settings
3. Deploy via dashboard

[→ Complete Guide](./cloudflare-pages-deployment.md#method-3-cloudflare-dashboard-direct-connection)

## Prerequisites

Before deploying, ensure you have:

### Accounts & Access
- [ ] Cloudflare account with Pages enabled
- [ ] GitHub repository access
- [ ] Supabase project access
- [ ] Domain management access

### Configuration Items
- [ ] Cloudflare API token
- [ ] Supabase URL and keys
- [ ] Admin session secret
- [ ] Operator credentials
- [ ] Environment variables documented

### Technical Requirements
- [ ] Node.js 18+
- [ ] pnpm 10.18.3+
- [ ] Wrangler CLI (for manual deployment)

[→ Complete Prerequisites Checklist](./cloudflare-pages-prerequisites-checklist.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Network                       │
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │   DNS        │──────▶│  Pages CDN   │                     │
│  │  ikanisa.com │      │              │                     │
│  └──────────────┘      └───────┬──────┘                     │
│                                 │                             │
│                         ┌───────▼──────┐                     │
│                         │  Edge Worker │                     │
│                         │  (Next.js)   │                     │
│                         └───────┬──────┘                     │
└─────────────────────────────────┼───────────────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
         ┌────────▼─────────┐          ┌─────────▼────────┐
         │   Supabase       │          │  Microservices   │
         │   Database +     │          │  - Agent Core    │
         │   Edge Functions │          │  - Voice Bridge  │
         │                  │          │  - Wallet, etc.  │
         └──────────────────┘          └──────────────────┘
```

## Key Features

### Security ✅
- HTTPS enforced with HSTS
- Content Security Policy (CSP)
- Secure session cookies (HttpOnly, Secure, SameSite)
- No secrets in client bundles
- Rate limiting (planned)

### Performance ✅
- Global CDN distribution
- Edge-optimized Next.js
- Static asset caching
- Service worker for offline support
- PWA capabilities

### Reliability ✅
- Zero-downtime deployments
- Instant rollback capability
- Health monitoring
- Error tracking
- 99.9% uptime SLA (Cloudflare)

### Developer Experience ✅
- Automated CI/CD
- Preview deployments
- Local development support
- Comprehensive documentation
- Testing procedures

## Deployment Flow

```
┌──────────────┐
│  Push to Git │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌─────────────────┐
│   GitHub     │────▶│  Build Shared   │
│   Actions    │     │  Packages       │
└──────┬───────┘     └─────────────────┘
       │
       ▼
┌──────────────────┐  ┌─────────────────┐
│  Security Check  │  │  Run Tests      │
│  (No secrets)    │  │  + Lint         │
└──────┬───────────┘  └─────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Build with                   │
│  @opennextjs/cloudflare      │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Deploy to Cloudflare Pages  │
│  (.vercel/output/static)     │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────┐
│  Post-Deploy     │
│  Verification    │
└──────────────────┘
```

## Environment Variables

### Required Public Variables
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_ENVIRONMENT_LABEL=Production
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_DEFAULT_ACTOR_ID=<uuid>
```

### Required Server-Side Secrets
```bash
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ADMIN_SESSION_SECRET=<min-16-chars>
ADMIN_TOKEN=<admin-token>
EASYMO_ADMIN_TOKEN=<admin-token>
ADMIN_ACCESS_CREDENTIALS=<json-array>
```

[→ Complete Environment Variables Guide](../ENV_VARIABLES.md)

## Testing

### Pre-Deployment
```bash
# Lint and type check
npm run lint -- --max-warnings=0
npm run type-check

# Run tests
npm test -- --run

# Build locally
npm run build
npx @opennextjs/cloudflare@latest
```

### Post-Deployment
```bash
# Verify domain
curl -I https://easymo.ikanisa.com

# Check security headers
curl -I https://easymo.ikanisa.com | grep -E "CSP|HSTS"

# Test login
# Visit https://easymo.ikanisa.com/login
```

[→ Complete Testing Guide](./cloudflare-pages-testing.md)

## Monitoring

### Cloudflare Analytics
- Real-time traffic metrics
- Performance monitoring
- Error tracking
- Geographic distribution

### Application Logs
- Structured JSON logging
- Correlation IDs for tracing
- PII masking
- Error aggregation

### Alerts
- Error rate > 5%
- Response time > 3s
- Uptime < 99%
- Security anomalies

## Troubleshooting

### Common Issues

**Build fails with "workspace:* not supported"**
```bash
# Solution: Build shared packages first
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

**Unauthorized on API routes**
```bash
# Solution: Verify server secrets in Cloudflare
# Check ADMIN_SESSION_SECRET and ADMIN_ACCESS_CREDENTIALS
```

**Domain not resolving**
```bash
# Solution: Check DNS configuration
dig easymo.ikanisa.com
# Verify CNAME points to Cloudflare Pages
```

[→ Complete Troubleshooting Guide](./cloudflare-pages-deployment.md#troubleshooting)

## Rollback

### Quick Rollback (Dashboard)
1. Go to Cloudflare Pages → easymo-admin → Deployments
2. Find previous successful deployment
3. Click "Rollback to this deployment"

### Git-based Rollback
```bash
git revert <bad-commit>
git push origin main
```

**Time to rollback:** < 5 minutes

## Support

### Documentation
- Quick Start: [cloudflare-pages-quick-start.md](./cloudflare-pages-quick-start.md)
- Complete Guide: [cloudflare-pages-deployment.md](./cloudflare-pages-deployment.md)
- Prerequisites: [cloudflare-pages-prerequisites-checklist.md](./cloudflare-pages-prerequisites-checklist.md)
- Testing: [cloudflare-pages-testing.md](./cloudflare-pages-testing.md)

### External Resources
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Contact
- DevOps Team: [Configure in CODEOWNERS]
- On-call: [Configure PagerDuty/similar]
- Slack: [Configure channel]

## Change Log

### Version 1.0.0 (2025-10-29)
- Initial Cloudflare Pages deployment setup
- Automated GitHub Actions workflow
- Comprehensive documentation suite
- Security headers configuration
- Testing and validation procedures

## Next Steps

1. **First Deployment**
   - Follow Quick Start Guide
   - Configure all environment variables
   - Deploy to production
   - Verify deployment

2. **Post-Deployment**
   - Monitor for 24 hours
   - Run full test suite
   - Gather user feedback
   - Document lessons learned

3. **Optimization**
   - Review performance metrics
   - Optimize bundle size
   - Fine-tune caching
   - Implement rate limiting

4. **Maintenance**
   - Schedule regular reviews
   - Update dependencies
   - Security audits
   - Performance testing

---

**Documentation Version:** 1.0.0  
**Last Updated:** 2025-10-29  
**Maintained By:** DevOps Team  
**Status:** Ready for Production
