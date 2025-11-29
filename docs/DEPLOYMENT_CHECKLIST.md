# EasyMO Production Deployment Checklist

## Pre-Deployment

### Security
- [ ] All secrets rotated and unique per environment
- [ ] Session secrets are minimum 64 characters
- [ ] No hardcoded credentials in codebase
- [ ] Security headers configured in nginx/CDN
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] SSL/TLS certificates valid

### Database
- [ ] Migrations tested on staging
- [ ] Backup strategy in place
- [ ] Connection pooling configured
- [ ] RLS policies verified
- [ ] Indexes optimized

### Infrastructure
- [ ] Health check endpoints responding
- [ ] Docker images built with production config
- [ ] Environment variables set in deployment platform
- [ ] CDN configured for static assets
- [ ] Auto-scaling configured

### Monitoring
- [ ] OTEL tracing configured
- [ ] Error tracking enabled (Sentry)
- [ ] Log aggregation configured
- [ ] Alerting rules set up
- [ ] Uptime monitoring active

### Testing
- [ ] All unit tests passing
- [ ] E2E tests passing on staging
- [ ] Load testing completed
- [ ] Security scan completed
- [ ] Accessibility audit passed

## Post-Deployment

- [ ] Verify health endpoints (`/api/health`)
- [ ] Check error rates in monitoring
- [ ] Verify core user flows work
- [ ] Monitor performance metrics
- [ ] Verify webhook integrations
- [ ] Test WhatsApp message flow
- [ ] Verify payment processing (if applicable)

## Rollback Procedure

1. Identify the issue via monitoring
2. Switch traffic to previous deployment
3. Investigate and fix in development
4. Re-deploy after validation

## Emergency Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | TBD |
| Backend Lead | TBD |
| Frontend Lead | TBD |
