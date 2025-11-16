# Production Deployment Checklist

## Pre-Deployment Security ✅

- [ ] All passwords use bcrypt hashes
- [ ] CSRF_SECRET configured (32+ chars)
- [ ] ADMIN_SESSION_SECRET configured (32+ chars)
- [ ] No secrets in client variables
- [ ] Security audit passed
- [ ] Rate limiting tested

## Build Verification ✅

- [ ] `npm run build` succeeds
- [ ] Bundle size < 150 KB
- [ ] No critical TypeScript errors
- [ ] Health check: GET /api/health

## Post-Deployment ✅

- [ ] Login flow works
- [ ] Rate limiting works
- [ ] Sessions work correctly
- [ ] Error monitoring configured

See full checklist for complete details.
