# Cloudflare Pages Deployment - Prerequisites Checklist

## Overview
This checklist ensures all prerequisites are met before deploying the EasyMO Admin Panel to Cloudflare Pages at `easymo.ikanisa.com`.

## Infrastructure Setup

### Cloudflare Account Configuration
- [ ] Cloudflare account created and verified
- [ ] Account ID documented: `___________________`
- [ ] Billing enabled (if required for Pages)
- [ ] Domain `ikanisa.com` added to Cloudflare
- [ ] Domain DNS managed by Cloudflare

### Cloudflare Pages Project
- [ ] Pages project created: `easymo-admin`
- [ ] Project connected to GitHub repository: `ikanisa/easymo`
- [ ] Production branch set to: `main`
- [ ] Build configuration set:
  - [ ] Build command: `cd admin-app && npm ci && npm run build && npx @cloudflare/next-on-pages`
  - [ ] Build output directory: `admin-app/.vercel/output/static`
  - [ ] Root directory: `/`
  - [ ] Node version: `18`
- [ ] Custom domain configured: `easymo.ikanisa.com`
- [ ] SSL/TLS mode: Full (strict)

### DNS Configuration
- [ ] A/AAAA or CNAME record for `easymo.ikanisa.com` pointing to Cloudflare Pages
- [ ] DNS propagation verified: `dig easymo.ikanisa.com`
- [ ] SSL certificate issued and active
- [ ] HTTPS redirect enabled

## Authentication & Secrets

### Cloudflare API Token
- [ ] API token created with permissions:
  - [ ] Account → Cloudflare Pages → Edit
  - [ ] Account → Cloudflare Pages → Read
- [ ] Token documented securely
- [ ] Token added to GitHub Secrets as `CLOUDFLARE_API_TOKEN`
- [ ] Account ID added to GitHub Secrets as `CLOUDFLARE_ACCOUNT_ID`

### Supabase Configuration
- [ ] Supabase project active: `vacltfdslodqybxojytc`
- [ ] Project URL: `https://vacltfdslodqybxojytc.supabase.co`
- [ ] Anonymous key retrieved
- [ ] Service role key retrieved (keep secure!)
- [ ] Database migrations up to date
- [ ] RLS policies enabled and tested
- [ ] Edge functions deployed
- [ ] Redirect URLs configured:
  - [ ] `https://easymo.ikanisa.com/api/auth/callback`
  - [ ] `https://easymo.ikanisa.com/login`

### Environment Variables - Public (Client-Safe)

#### Cloudflare Pages Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://vacltfdslodqybxojytc.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<anon-key>`
- [ ] `NEXT_PUBLIC_ENVIRONMENT_LABEL` = `Production`
- [ ] `NEXT_PUBLIC_USE_MOCKS` = `false`
- [ ] `NEXT_PUBLIC_DEFAULT_ACTOR_ID` = `<uuid>`
- [ ] `NEXT_PUBLIC_ASSISTANT_ENABLED` = `false` (or `true` if ready)
- [ ] `NEXT_PUBLIC_BASKET_CONFIRMATION_ENABLED` = `false` (or `true` if ready)
- [ ] `NEXT_PUBLIC_DUAL_CONSTRAINT_MATCHING_ENABLED` = `false` (or `true` if ready)

#### GitHub Secrets (for CI/CD)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_DEFAULT_ACTOR_ID`

### Environment Variables - Private (Server-Only)

#### Cloudflare Pages Environment Variables (Encrypted)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `<service-role-key>` ⚠️ NEVER expose to client
- [ ] `ADMIN_SESSION_SECRET` = `<min-16-char-random-string>`
- [ ] `ADMIN_TOKEN` = `<admin-api-token>`
- [ ] `EASYMO_ADMIN_TOKEN` = `<same-as-admin-token>`
- [ ] `ADMIN_ACCESS_CREDENTIALS` = `[{"actorId":"<uuid>","token":"<token>","label":"Ops"}]`
- [ ] `ADMIN_SESSION_TTL_SECONDS` = `43200` (12 hours)
- [ ] `ADMIN_SESSION_MAX_AGE_DAYS` = `30`

#### Additional Service Credentials (if microservices used)
- [ ] `AGENT_CORE_INTERNAL_TOKEN` = `<internal-token>`
- [ ] `AGENT_CORE_URL` = `<agent-core-url>`
- [ ] `VOICE_BRIDGE_API_URL` = `<voice-bridge-url>`
- [ ] `WALLET_SERVICE_URL` = `<wallet-service-url>`
- [ ] `MARKETPLACE_RANKING_URL` = `<ranking-service-url>`
- [ ] `MARKETPLACE_VENDOR_URL` = `<vendor-service-url>`
- [ ] `MARKETPLACE_BUYER_URL` = `<buyer-service-url>`

## Security Verification

### Secret Management
- [ ] No secrets committed to version control
- [ ] `.env.example` contains only placeholder values
- [ ] All `NEXT_PUBLIC_*` variables are safe to expose
- [ ] No `VITE_*SERVICE_ROLE*` or `NEXT_PUBLIC_*SERVICE_ROLE*` variables exist
- [ ] Prebuild security check script passes
- [ ] Service role keys stored only in encrypted environment variables

### Headers & Policies
- [ ] `_headers` file configured with security headers
- [ ] Content Security Policy (CSP) configured
- [ ] HSTS enabled
- [ ] X-Frame-Options set to DENY
- [ ] X-Content-Type-Options set to nosniff
- [ ] Referrer-Policy configured

### Authentication & Authorization
- [ ] Session cookie configured: `admin_session`
- [ ] Cookie attributes: HttpOnly, Secure, SameSite=Strict
- [ ] Session TTL configured (default: 12 hours)
- [ ] Operator credentials documented and stored securely
- [ ] Actor IDs validated against whitelist
- [ ] Middleware protects API routes

## Build & Deploy Configuration

### Repository Setup
- [ ] Repository: `ikanisa/easymo`
- [ ] Default branch: `main`
- [ ] Branch protection enabled
- [ ] Required status checks configured
- [ ] Admin-app directory: `admin-app/`
- [ ] Shared packages: `packages/shared/`, `packages/commons/`

### Build Dependencies
- [ ] Node.js 18+ available in build environment
- [ ] pnpm 10.18.3+ available
- [ ] npm 9.8.1+ available
- [ ] Wrangler CLI available
- [ ] @cloudflare/next-on-pages installed

### Build Process Verification
- [ ] Shared packages build successfully
- [ ] Admin-app dependencies install without errors
- [ ] TypeScript compilation succeeds
- [ ] Linting passes with max warnings = 0
- [ ] Tests pass
- [ ] Next.js build completes
- [ ] @cloudflare/next-on-pages conversion succeeds
- [ ] Output directory created: `.vercel/output/static`

### GitHub Actions Workflow
- [ ] Workflow file: `.github/workflows/cloudflare-pages-deploy.yml`
- [ ] Workflow triggers on push to `main` affecting `admin-app/**`
- [ ] Workflow can be manually triggered
- [ ] All required secrets configured in GitHub
- [ ] Workflow permissions configured: `contents: read`, `deployments: write`

## Testing & Validation

### Pre-Deployment Testing
- [ ] Local build completes: `cd admin-app && npm run build`
- [ ] Local preview works: `npm run preview`
- [ ] All unit tests pass: `npm test`
- [ ] TypeScript type checking passes: `npm run type-check`
- [ ] Linting passes: `npm run lint`
- [ ] Security checks pass (no service role in client vars)

### Post-Deployment Verification
- [ ] Domain accessible: `https://easymo.ikanisa.com`
- [ ] SSL certificate valid
- [ ] Login page loads
- [ ] Login functionality works with test credentials
- [ ] Session cookie set correctly (inspect DevTools)
- [ ] Dashboard page accessible after login
- [ ] API routes functional: `/api/auth/*`
- [ ] Logout clears session
- [ ] No console errors
- [ ] Service worker registers (PWA)
- [ ] Offline mode works

### Performance Testing
- [ ] Initial page load < 3 seconds
- [ ] Time to Interactive (TTI) < 5 seconds
- [ ] Lighthouse Performance score > 90
- [ ] Lighthouse Accessibility score > 95
- [ ] Lighthouse Best Practices score > 95
- [ ] Lighthouse SEO score > 90
- [ ] Core Web Vitals pass
  - [ ] LCP < 2.5s
  - [ ] FID < 100ms
  - [ ] CLS < 0.1

### Security Testing
- [ ] Security headers present: `curl -I https://easymo.ikanisa.com`
- [ ] CSP configured correctly
- [ ] HSTS header present
- [ ] No secrets in client bundles
- [ ] XSS protection enabled
- [ ] CORS configured correctly
- [ ] Session fixation prevented
- [ ] CSRF protection enabled

## Monitoring & Observability

### Cloudflare Analytics
- [ ] Real User Monitoring (RUM) enabled
- [ ] Web Analytics configured
- [ ] Error tracking enabled
- [ ] Performance metrics tracked

### Logging
- [ ] Structured logging implemented
- [ ] Correlation IDs in use
- [ ] PII masking enabled
- [ ] Log retention policy configured

### Alerts
- [ ] Error rate alert configured (threshold: >5%)
- [ ] Response time alert configured (threshold: >3s)
- [ ] Availability alert configured (threshold: <99%)
- [ ] Security alert configured (unusual traffic patterns)

## Documentation

### Deployment Documentation
- [ ] Deployment guide created: `docs/deployment/cloudflare-pages-deployment.md`
- [ ] Prerequisites checklist: `docs/deployment/cloudflare-pages-prerequisites-checklist.md`
- [ ] Environment variables documented: `docs/ENV_VARIABLES.md`
- [ ] Rollback procedure documented
- [ ] Troubleshooting guide available

### Team Knowledge
- [ ] Team trained on deployment process
- [ ] Runbook reviewed by team
- [ ] Incident response plan documented
- [ ] Escalation paths defined
- [ ] On-call rotation configured

## Rollback & Recovery

### Rollback Capability
- [ ] Previous deployment accessible in Cloudflare dashboard
- [ ] One-click rollback tested
- [ ] Git revert procedure documented
- [ ] Database rollback scripts available (if needed)
- [ ] RTO (Recovery Time Objective) documented: `_____` minutes
- [ ] RPO (Recovery Point Objective) documented: `_____` minutes

### Backup & Disaster Recovery
- [ ] Database backups enabled in Supabase
- [ ] Backup retention period: `_____` days
- [ ] Restore procedure tested
- [ ] Configuration backups stored securely
- [ ] Secrets backed up in secure vault

## Compliance & Governance

### Security Compliance
- [ ] HTTPS enforced
- [ ] PII handling compliant with regulations
- [ ] Data retention policies defined
- [ ] Access logs maintained
- [ ] Security audit trail enabled

### Change Management
- [ ] Change request process followed
- [ ] Stakeholders notified of deployment
- [ ] Maintenance window scheduled (if needed)
- [ ] Communication plan executed

## Final Approval

### Sign-off Required
- [ ] Technical Lead: _________________ Date: _______
- [ ] Security Review: _________________ Date: _______
- [ ] DevOps Lead: _________________ Date: _______
- [ ] Product Owner: _________________ Date: _______

### Go/No-Go Decision
- [ ] All critical items checked
- [ ] All blockers resolved
- [ ] Team consensus achieved
- [ ] **APPROVED FOR PRODUCTION DEPLOYMENT**

---

## Deployment Timeline

| Phase | Duration | Activities |
|-------|----------|------------|
| Pre-deployment checks | 2 hours | Verify checklist, test locally |
| Initial deployment | 30 min | Deploy to production |
| Post-deployment verification | 1 hour | Run all verification tests |
| Monitoring period | 24 hours | Watch for errors, performance issues |
| Final sign-off | - | Confirm stable deployment |

## Next Steps After Deployment

1. Monitor application for 24 hours
2. Address any issues that arise
3. Gather feedback from operators
4. Plan optimization improvements
5. Document lessons learned
6. Schedule retrospective meeting

---

**Checklist Version:** 1.0.0
**Last Updated:** 2025-10-29
**Next Review Date:** _________________
