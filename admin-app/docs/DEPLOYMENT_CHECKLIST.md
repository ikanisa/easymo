# Admin App Deployment Checklist

## Pre-Deployment Review

### 1. Code Review ✅
- [ ] All PRs have been reviewed by at least one team member
- [ ] Design system consistency verified
- [ ] Accessibility requirements validated
- [ ] Security scan (CodeQL) passed
- [ ] No high-severity vulnerabilities

### 2. Design Review Sign-Off ✅
- [ ] UI changes reviewed by design team
- [ ] Visual regression tests passed
- [ ] Screenshots of all UI states provided
- [ ] Typography and spacing verified
- [ ] Color contrast meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- [ ] Responsive design checked at breakpoints: 375px, 768px, 1280px, 1920px

### 3. Functionality Testing ✅
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Manual smoke testing completed
- [ ] Cross-browser testing done (Chrome, Firefox, Safari, Edge)

### 4. Accessibility Validation ✅
- [ ] WCAG 2.1 Level AA compliance verified
- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility checked (NVDA, JAWS, VoiceOver)
- [ ] Skip links functional
- [ ] Focus management working correctly
- [ ] ARIA attributes properly implemented
- [ ] Color contrast validated
- [ ] Text alternatives for non-text content provided

### 5. Performance Check ✅
- [ ] Lighthouse score > 90 for Performance
- [ ] Lighthouse score > 90 for Accessibility
- [ ] Bundle size analysis completed
- [ ] No unnecessary dependencies added
- [ ] Images optimized
- [ ] Lazy loading implemented where appropriate

### 6. Navigation Specific Checks ✅
- [ ] All navigation links functional
- [ ] Active state indicators working
- [ ] Breadcrumbs rendering correctly
- [ ] Mobile menu working on all devices
- [ ] Search integration functional
- [ ] Group expand/collapse working
- [ ] Keyboard shortcuts documented and functional

## Deployment Steps

### 1. Pre-Deployment Backup
```bash
# Backup current production database
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql

# Tag current production version
git tag -a production-$(date +%Y%m%d-%H%M%S) -m "Pre-deployment backup"
git push origin --tags
```

### 2. Deploy to Staging
```bash
# Deploy admin-app to staging
cd admin-app
npm run build
# Deploy to staging environment (e.g., Netlify, Vercel)
```

### 3. Staging Validation
- [ ] Verify deployment successful
- [ ] Run smoke tests on staging
- [ ] Check navigation functionality
- [ ] Verify API integrations
- [ ] Test authentication flow
- [ ] Check error logging/monitoring

### 4. Production Deployment
```bash
# Deploy to production
# Use your deployment tool (Netlify, Vercel, etc.)
npm run deploy:production
```

### 5. Post-Deployment Verification (CRITICAL)
Run these tests immediately after deployment:

#### Smoke Tests (5 minutes)
```bash
# Run automated smoke tests
cd admin-app/tests/e2e/playwright
ADMIN_APP_BASE_URL=https://admin.easymo.app npx playwright test specs/critical-flows.e2e.spec.ts
```

#### Manual Verification Checklist
- [ ] Can log in successfully
- [ ] Dashboard loads and displays data
- [ ] Navigation sidebar renders correctly
- [ ] Mobile menu works on phone/tablet
- [ ] Breadcrumbs display on nested pages
- [ ] Search opens and functions
- [ ] Can navigate to key pages:
  - [ ] /insurance (root)
  - [ ] /notifications
  - [ ] /users
  - [ ] /logs
  - [ ] /settings
- [ ] Active page highlighting works
- [ ] Keyboard navigation functional (Tab, Enter, Space)
- [ ] Skip link appears on Tab press
- [ ] No console errors in browser
- [ ] No 404 or 500 errors in logs

#### Performance Checks
```bash
# Run Lighthouse audit
npx lighthouse https://admin.easymo.app --view --preset=desktop

# Check key metrics:
# - FCP < 1.8s
# - LCP < 2.5s
# - CLS < 0.1
# - FID < 100ms
```

### 6. Monitoring Setup
- [ ] Error tracking enabled (Sentry, etc.)
- [ ] Performance monitoring active
- [ ] User analytics configured
- [ ] Uptime monitoring verified

## Rollback Procedure

If any critical issues are found:

```bash
# Immediately rollback to previous version
git revert HEAD
git push origin main

# Or revert to specific tag
git checkout production-YYYYMMDD-HHMMSS
# Force deploy previous version
```

### Rollback Triggers
- Authentication failures
- Critical navigation broken
- 500 errors on main pages
- Data loss or corruption
- Security vulnerabilities discovered

## Post-Deployment

### Monitoring (First 24 Hours)
- [ ] Monitor error rates every 2 hours
- [ ] Check user feedback channels
- [ ] Review performance metrics
- [ ] Verify no increase in support tickets
- [ ] Check database query performance

### Documentation Updates
- [ ] Update CHANGELOG.md
- [ ] Document any configuration changes
- [ ] Update user guides if needed
- [ ] Share release notes with team

### Team Communication
- [ ] Announce deployment in team chat
- [ ] Notify support team of any changes
- [ ] Brief team on new features
- [ ] Share post-deployment metrics

## Sign-Off

### Required Approvals
- [ ] Engineering Lead: _________________ Date: _______
- [ ] Design Lead: _________________ Date: _______
- [ ] Product Manager: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______

### Deployment Completion
- [ ] Deployment completed by: _________________ 
- [ ] Date/Time: _________________
- [ ] Environment: [ ] Staging [ ] Production
- [ ] Version deployed: _________________
- [ ] Rollback tested: [ ] Yes [ ] No

## Emergency Contacts

- On-Call Engineer: [Phone/Slack]
- DevOps Lead: [Phone/Slack]
- Product Manager: [Phone/Slack]
- CTO: [Phone/Slack]

## Notes

_Add any deployment-specific notes here:_

---

## Appendix: Testing Commands

### Unit Tests
```bash
cd admin-app
npm test -- --run
```

### Integration Tests
```bash
cd admin-app
npm test -- --run tests/integration/
```

### Visual Regression Tests
```bash
cd admin-app/tests/e2e/playwright
npx playwright test navigation-visual.e2e.spec.ts --update-snapshots  # Update baselines
npx playwright test navigation-visual.e2e.spec.ts                      # Compare to baselines
```

### Accessibility Tests
```bash
cd admin-app/tests/e2e/playwright
npx playwright test navigation-accessibility.e2e.spec.ts
```

### Full E2E Suite
```bash
cd admin-app/tests/e2e/playwright
npx playwright test
```

### Build Verification
```bash
cd admin-app
npm run build
npm run start
# Verify app starts on http://localhost:3000
```
