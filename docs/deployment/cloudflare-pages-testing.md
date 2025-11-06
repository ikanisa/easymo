# Cloudflare Pages Deployment - Testing & Validation Guide

## Overview
This guide provides testing procedures to verify the Cloudflare Pages deployment of the EasyMO Admin Panel.

## Pre-Deployment Testing

### 1. Local Build Verification

#### Test Standard Next.js Build
```bash
cd admin-app

# Install dependencies
npm ci

# Run linting
npm run lint -- --max-warnings=0

# Run type checking
npm run type-check

# Run tests
npm test -- --run

# Build the application
npm run build
```

**Expected Results:**
- ✅ Linting passes with 0 warnings
- ✅ Type checking completes without errors
- ✅ All tests pass
- ✅ Build completes successfully
- ✅ `.next` directory created

#### Test Cloudflare Pages Build
```bash
# Build for Cloudflare Pages
npm run pages:build

# Or manually
npx @opennextjs/cloudflare@latest
```

**Expected Results:**
- ✅ Build completes without errors
- ✅ `.vercel/output/static` directory created
- ✅ `_worker.js` file generated
- ✅ Static assets in `static/` subdirectory

#### Test Local Preview
```bash
# Start local Cloudflare Pages environment
npm run cf:dev

# Or manually
npx wrangler pages dev .vercel/output/static --compatibility-flag=nodejs_compat
```

**Expected Results:**
- ✅ Server starts on http://localhost:8788
- ✅ Login page loads
- ✅ No console errors
- ✅ Static assets load correctly

### 2. Security Validation

#### Verify No Secrets in Client Bundle
```bash
cd admin-app

# Check for service role keys
grep -r "SERVICE_ROLE" .next/static/ && echo "❌ FAIL: Secrets found!" || echo "✅ PASS: No secrets"

# Check for admin tokens
grep -r "ADMIN_TOKEN" .next/static/ && echo "❌ FAIL: Secrets found!" || echo "✅ PASS: No tokens"

# Verify prebuild security check
node ../scripts/assert-no-service-role-in-client.mjs
```

**Expected Results:**
- ✅ No secrets found in client bundles
- ✅ Prebuild security check passes

#### Verify Environment Variable Configuration
```bash
# Check .env.example has only placeholders
grep -E "CHANGEME|placeholder|example" .env.example

# Verify no actual secrets
! grep -E "eyJhbG|sk-[a-zA-Z0-9]" .env.example || echo "❌ FAIL: Real secrets in example!"
```

**Expected Results:**
- ✅ Only placeholder values in `.env.example`
- ✅ No real secrets committed

### 3. Code Quality Checks

#### Run Full Test Suite
```bash
cd admin-app

# Unit tests
npm test -- --run

# Smoke tests
npm test -- --run --config vitest.config.smoke.cjs
```

**Expected Results:**
- ✅ All unit tests pass
- ✅ All smoke tests pass

#### Type Safety Validation
```bash
# Check TypeScript compilation
npm run type-check

# Check for any type errors
tsc --noEmit
```

**Expected Results:**
- ✅ No TypeScript errors
- ✅ Types correctly imported

## Post-Deployment Testing

### 1. Domain & SSL Verification

#### DNS Resolution
```bash
# Check DNS resolution
dig easymo.ikanisa.com

# Expected: Should resolve to Cloudflare IPs
# Example: 172.67.x.x or 104.21.x.x
```

#### SSL Certificate
```bash
# Verify SSL certificate
curl -vI https://easymo.ikanisa.com 2>&1 | grep -E "SSL|subject|issuer"

# Or use OpenSSL
echo | openssl s_client -connect easymo.ikanisa.com:443 -servername easymo.ikanisa.com 2>/dev/null | openssl x509 -noout -dates -subject -issuer
```

**Expected Results:**
- ✅ Certificate valid
- ✅ Issued by Cloudflare
- ✅ Not expired
- ✅ Subject matches domain

#### HTTPS Redirect
```bash
# Test HTTP to HTTPS redirect
curl -I http://easymo.ikanisa.com

# Expected: 301/302 redirect to https://
```

### 2. Application Health Checks

#### Basic Connectivity
```bash
# Test homepage
curl -I https://easymo.ikanisa.com

# Expected: 200 OK
```

#### Login Page
```bash
# Check login page
curl -s https://easymo.ikanisa.com/login | grep -i "login"

# Expected: Contains login form or text
```

#### API Routes
```bash
# Test API endpoint (should require auth)
curl -I https://easymo.ikanisa.com/api/auth/session

# Expected: 401 Unauthorized (correct behavior)
```

### 3. Security Headers Verification

```bash
# Check all security headers
curl -I https://easymo.ikanisa.com

# Verify specific headers
curl -I https://easymo.ikanisa.com | grep -E "Content-Security-Policy|Strict-Transport-Security|X-Frame-Options|X-Content-Type-Options"
```

**Expected Headers:**
- ✅ `Content-Security-Policy`: Present with proper directives
- ✅ `Strict-Transport-Security`: max-age=31536000; includeSubDomains; preload
- ✅ `X-Frame-Options`: DENY
- ✅ `X-Content-Type-Options`: nosniff
- ✅ `X-XSS-Protection`: 1; mode=block
- ✅ `Referrer-Policy`: strict-origin-when-cross-origin

### 4. Authentication & Session Testing

#### Login Flow Test
```bash
# Manual test via browser:
1. Navigate to https://easymo.ikanisa.com/login
2. Enter valid operator token
3. Verify redirect to /dashboard
4. Check DevTools → Application → Cookies:
   - Cookie name: admin_session
   - HttpOnly: true
   - Secure: true
   - SameSite: Strict
```

**Expected Results:**
- ✅ Login successful with valid credentials
- ✅ Session cookie set correctly
- ✅ Redirect to dashboard
- ✅ Cookie attributes secure

#### Session Persistence
```bash
1. After login, navigate to different pages
2. Verify session persists
3. Check that actor ID is present in requests
4. Verify no unnecessary re-authentication
```

#### Logout Test
```bash
1. Click logout button
2. Verify redirect to /login
3. Check that session cookie is cleared
4. Attempt to access /dashboard (should redirect to login)
```

### 5. Functional Testing

#### Navigation Test
- [ ] Dashboard page loads
- [ ] All menu items accessible
- [ ] Page transitions smooth
- [ ] No console errors during navigation

#### Data Loading Test
- [ ] Lists and tables render
- [ ] Loading states appear appropriately
- [ ] Error states handled gracefully
- [ ] Empty states display correctly

#### API Integration Test
- [ ] Supabase client initializes
- [ ] API calls succeed (with valid auth)
- [ ] Error responses handled properly
- [ ] Loading indicators work

### 6. Performance Testing

#### Lighthouse Audit
```bash
# Install Lighthouse CLI (if not installed)
npm install -g lighthouse

# Run audit
lighthouse https://easymo.ikanisa.com --output html --output-path ./lighthouse-report.html --chrome-flags="--headless"
```

**Target Scores:**
- ✅ Performance: >90
- ✅ Accessibility: >95
- ✅ Best Practices: >95
- ✅ SEO: >90

#### Core Web Vitals
```bash
# Use Chrome DevTools or WebPageTest.org
# Check:
- LCP (Largest Contentful Paint): <2.5s
- FID (First Input Delay): <100ms
- CLS (Cumulative Layout Shift): <0.1
```

#### Load Time Measurement
```bash
# Measure time to first byte
curl -w "@-" -o /dev/null -s https://easymo.ikanisa.com <<'EOF'
time_namelookup:  %{time_namelookup}s\n
time_connect:     %{time_connect}s\n
time_appconnect:  %{time_appconnect}s\n
time_pretransfer: %{time_pretransfer}s\n
time_starttransfer: %{time_starttransfer}s\n
time_total:       %{time_total}s\n
EOF
```

**Expected Results:**
- ✅ TTFB < 500ms
- ✅ Total load time < 3s
- ✅ DNS lookup < 100ms

### 7. PWA Functionality

#### Service Worker Registration
```bash
# Open browser DevTools → Application → Service Workers
# Verify:
- Service worker registered
- Status: Activated
- Source: /sw.js
```

#### Offline Mode
```bash
1. Load the application
2. Open DevTools → Network → Set to "Offline"
3. Refresh or navigate
4. Verify offline page or cached content displays
5. Re-enable network
6. Verify sync occurs
```

#### Install Prompt
```bash
1. Visit homepage twice (within ~5 minutes)
2. Check for install prompt (A2HS - Add to Home Screen)
3. Install the app
4. Verify it opens in standalone mode
5. Check manifest in DevTools → Application → Manifest
```

### 8. Error Handling

#### 404 Page
```bash
curl -I https://easymo.ikanisa.com/nonexistent-page

# Expected: 404 with custom error page
```

#### 500 Error Handling
```bash
# Trigger error (if test endpoint exists)
# Verify error page displays
# Check error logging/tracking
```

#### Network Errors
```bash
1. Disconnect network mid-request
2. Verify graceful error handling
3. Check error messages are user-friendly
4. Verify retry mechanisms work
```

### 9. Mobile Responsiveness

```bash
# Use browser DevTools device emulation
# Test on:
- iPhone SE (375x667)
- iPhone 12 Pro (390x844)
- iPad (768x1024)
- Samsung Galaxy S20 (360x800)

# Verify:
- Layout adapts correctly
- Touch targets ≥44x44px
- Text readable without zoom
- No horizontal scroll
- Images scale properly
```

### 10. Cross-Browser Testing

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**Verify:**
- All features work
- CSS renders correctly
- JavaScript executes
- No browser-specific bugs

## Integration Testing

### 1. Supabase Integration
```bash
# Verify database connectivity
# Test RLS policies with different user roles
# Confirm edge functions are callable
# Check authentication flows
```

### 2. Microservices Integration
```bash
# If applicable, test:
- Agent Core communication
- Voice Bridge connectivity
- Wallet Service calls
- Marketplace services
```

## Load Testing (Optional)

### Simple Load Test
```bash
# Install apache bench
apt-get install apache2-utils

# Run simple load test
ab -n 1000 -c 10 https://easymo.ikanisa.com/

# Expected:
- No failures
- Response time < 1s average
- No 500 errors
```

### Advanced Load Testing
```bash
# Use k6 or Artillery
# Test scenarios:
- Multiple concurrent users
- Peak load conditions
- Sustained traffic
- Spike testing
```

## Monitoring Verification

### 1. Cloudflare Analytics
```bash
# Check Cloudflare Dashboard:
- Request count
- Bandwidth usage
- Status code distribution
- Top pages
- Geographic distribution
```

### 2. Error Tracking
```bash
# Verify logging:
- Errors are captured
- Correlation IDs present
- Stack traces available
- PII is masked
```

### 3. Custom Metrics
```bash
# If implemented:
- User logins tracked
- API call latency
- Feature usage metrics
- Business KPIs
```

## Rollback Validation

### Test Rollback Procedure
```bash
1. Note current deployment ID
2. Perform rollback in Cloudflare Dashboard
3. Verify previous version is live
4. Test basic functionality
5. Re-deploy if satisfied
```

## Compliance Checks

### GDPR-lite Compliance
- [ ] Privacy policy accessible
- [ ] Cookie consent (if required)
- [ ] Data export capability (planned)
- [ ] Account deletion flow (planned)

### Accessibility (WCAG 2.1)
```bash
# Use axe DevTools or WAVE
# Verify:
- Proper heading hierarchy
- Alt text on images
- Keyboard navigation works
- Color contrast ratios
- Screen reader compatibility
```

## Documentation Verification

- [ ] Deployment docs accurate
- [ ] Environment variables documented
- [ ] Troubleshooting guide helpful
- [ ] Runbooks up to date
- [ ] API documentation current

## Final Checklist

### Pre-Production
- [ ] All tests passed
- [ ] Security headers verified
- [ ] Performance benchmarks met
- [ ] Error handling works
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team trained

### Production Readiness
- [ ] Stakeholder approval
- [ ] Communication plan executed
- [ ] Rollback procedure tested
- [ ] On-call team ready
- [ ] Incident response plan reviewed

### Post-Deployment
- [ ] Smoke tests passed
- [ ] User acceptance testing
- [ ] Performance monitoring
- [ ] Error rate acceptable
- [ ] User feedback collected

## Test Results Template

```markdown
## Deployment Test Results

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** Production
**URL:** https://easymo.ikanisa.com

### Build Verification
- [ ] Linting: PASS/FAIL
- [ ] Type checking: PASS/FAIL
- [ ] Tests: PASS/FAIL (X/Y passed)
- [ ] Build: PASS/FAIL

### Security
- [ ] No secrets in bundles: PASS/FAIL
- [ ] Headers configured: PASS/FAIL
- [ ] SSL valid: PASS/FAIL

### Functionality
- [ ] Login: PASS/FAIL
- [ ] Navigation: PASS/FAIL
- [ ] API calls: PASS/FAIL
- [ ] Logout: PASS/FAIL

### Performance
- [ ] Lighthouse Performance: XX/100
- [ ] Lighthouse Accessibility: XX/100
- [ ] TTFB: XXXms
- [ ] Load time: X.Xs

### Issues Found
1. [Issue description]
2. [Issue description]

### Recommendation
- [ ] Approve for production
- [ ] Needs fixes before approval

**Notes:**
[Additional observations]
```

---

**Version:** 1.0.0
**Last Updated:** 2025-10-29
**Maintained By:** DevOps Team
