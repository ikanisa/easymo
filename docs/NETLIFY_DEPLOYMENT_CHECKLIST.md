# Netlify Deployment - Final Checklist

**Deployment Date:** ___________  
**Deployment Type:** ☐ Production  ☐ Staging  ☐ Preview  
**Deployed By:** ___________  
**Deployment Method:** ☐ Auto (Git Push)  ☐ Manual (CLI)  ☐ GitHub Actions

---

## ✅ Pre-Deployment (Complete ALL before deploying)

### Code & Build
- [ ] All tests passing locally (`cd admin-app && npm test -- --run`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Lint passing (`npm run lint`)
- [ ] Local production build successful (`npm run build`)
- [ ] Pre-deploy script passed (`./scripts/pre-deploy-check.sh`)

### Security
- [ ] No service role keys in NEXT_PUBLIC_* variables
- [ ] No mocks enabled (`NEXT_PUBLIC_USE_MOCKS=false`)
- [ ] All secrets documented in `.env.netlify.template`
- [ ] Security checks passing (`node ./scripts/assert-no-service-role-in-client.mjs`)

### Dependencies
- [ ] All shared packages built successfully
  - [ ] @va/shared
  - [ ] @easymo/commons
  - [ ] @easymo/video-agent-schema
  - [ ] @easymo/ui
- [ ] No dependency vulnerabilities (`pnpm audit`)

### Database
- [ ] All migrations applied (`supabase db push`)
- [ ] Schema alignment verified (`pnpm schema:verify`)
- [ ] Seed data loaded if needed (`pnpm seed:remote`)

### Configuration
- [ ] `netlify.toml` reviewed and up to date
- [ ] Build command includes all shared package builds
- [ ] Environment variables documented
- [ ] Feature flags configured correctly

### Documentation
- [ ] Deployment guide reviewed
- [ ] Runbook updated with any changes
- [ ] Environment variables template current
- [ ] API documentation updated if needed

---

## 🚀 Deployment Process

### Netlify Setup
- [ ] Netlify account access verified
- [ ] Site created in Netlify dashboard
- [ ] Repository connected to Netlify
- [ ] Build settings configured
- [ ] Custom domain configured (if applicable)

### Environment Variables (Set in Netlify Dashboard)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `EASYMO_ADMIN_TOKEN`
- [ ] `ADMIN_SESSION_SECRET`
- [ ] `OPENAI_API_KEY` (if using OpenAI)
- [ ] `OPENAI_ORG_ID` (if using OpenAI)
- [ ] `GOOGLE_AI_API_KEY` (if using Google AI)
- [ ] `GOOGLE_MAPS_API_KEY` (if using Maps)
- [ ] `NODE_VERSION=20.18.0`
- [ ] `PNPM_VERSION=10.18.3`
- [ ] `NODE_ENV=production`

### Deployment Trigger
- [ ] Method selected:
  - [ ] **Auto:** Pushed to `main` branch
  - [ ] **Manual:** Ran `netlify deploy --prod --build`
  - [ ] **GitHub Actions:** Triggered workflow

### Build Monitoring
- [ ] Build started successfully
- [ ] Build logs reviewed in real-time
- [ ] No errors during build
- [ ] Build completed in reasonable time (< 5 min)
- [ ] Deployment successful

**Build Time:** _____ minutes  
**Deploy URL:** _____________________

---

## ✅ Post-Deployment Verification

### Automated Tests
- [ ] Smoke tests passed (`./scripts/post-deploy-smoke.sh [URL]`)
- [ ] Health endpoint responding (`curl [URL]/api/health`)
- [ ] API endpoints accessible

### Manual UI Testing

#### Authentication
- [ ] Login page loads without errors
- [ ] Can login with valid credentials
- [ ] Invalid credentials properly rejected
- [ ] Session persists correctly
- [ ] Logout works properly

#### Agent Management
- [ ] Agents list page loads
- [ ] Can view agent details
- [ ] Can create new agent
- [ ] Can edit existing agent
- [ ] Can delete agent
- [ ] Agent versioning works

#### AI Features
- [ ] Chat interface loads
- [ ] Can send chat messages
- [ ] Responses received correctly
- [ ] OpenAI integration working (if enabled)
- [ ] Google AI integration working (if enabled)
- [ ] Voice features functional (if enabled)
- [ ] Image generation working (if enabled)

#### Core Functionality
- [ ] Navigation works smoothly
- [ ] All pages accessible
- [ ] Forms submit properly
- [ ] Data loads correctly
- [ ] Search functionality works
- [ ] Filters work as expected

### Performance
- [ ] Homepage loads in < 3 seconds
- [ ] No console errors in browser DevTools
- [ ] No network errors
- [ ] Images load properly
- [ ] Lighthouse score > 90 (run test)
- [ ] Mobile responsiveness works

### Security
- [ ] HTTPS enabled and working
- [ ] Security headers present
  - [ ] X-Frame-Options
  - [ ] X-Content-Type-Options
  - [ ] Strict-Transport-Security
- [ ] No sensitive data in client-side code
- [ ] CSP headers configured
- [ ] CORS configured correctly

### Monitoring
- [ ] Netlify Analytics enabled
- [ ] Function logs accessible
- [ ] Sentry error tracking active (if configured)
- [ ] No errors in first 15 minutes
- [ ] Bandwidth usage normal

---

## 📊 Deployment Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Build Time | < 3 min | _____ | ☐ Pass ☐ Fail |
| Deploy Time | < 5 min | _____ | ☐ Pass ☐ Fail |
| Homepage Load Time | < 3s | _____ | ☐ Pass ☐ Fail |
| Lighthouse Performance | > 90 | _____ | ☐ Pass ☐ Fail |
| Lighthouse Accessibility | > 95 | _____ | ☐ Pass ☐ Fail |
| API Response Time | < 500ms | _____ | ☐ Pass ☐ Fail |
| Error Rate | < 0.1% | _____ | ☐ Pass ☐ Fail |

---

## 📢 Communication

### Pre-Deployment
- [ ] Team notified of upcoming deployment
- [ ] Deployment window communicated
- [ ] Stakeholders informed

### Post-Deployment
- [ ] Success notification sent to team
- [ ] Production URL shared
- [ ] Known issues documented (if any)
- [ ] Next steps communicated

**Notification Template:**
```
✅ EasyMO Admin Panel Deployed to Production

URL: [Your Netlify URL]
Version: [Git commit hash]
Deployed by: [Your name]
Status: All systems operational

Verification:
- Smoke tests: PASSED
- Manual testing: PASSED
- Performance: PASSED

Known Issues: None

Next Steps: Monitor for 24 hours
```

---

## 🔄 Rollback Plan (If Needed)

### If Critical Issues Found:
- [ ] Issue documented and severity assessed
- [ ] Decision made: Rollback or hotfix?
- [ ] If rollback: Via Netlify Dashboard → Deploys → Previous Deploy → Publish
- [ ] Rollback verified
- [ ] Team notified of rollback
- [ ] Post-mortem scheduled

**Rollback Executed:** ☐ Yes ☐ No  
**Rollback Time:** ___________  
**Reason:** _____________________

---

## 📝 Post-Deployment Notes

**Issues Encountered:**
_____________________
_____________________

**Resolutions:**
_____________________
_____________________

**Lessons Learned:**
_____________________
_____________________

**Follow-up Tasks:**
- [ ] _____________________
- [ ] _____________________
- [ ] _____________________

---

## ✍️ Sign-off

**Deployed By:**  
Name: ___________  
Date: ___________  
Signature: ___________

**Verified By:**  
Name: ___________  
Date: ___________  
Signature: ___________

**Approved For Production:**  
Name: ___________  
Date: ___________  
Signature: ___________

---

## 📚 Reference Documents

- [Deployment Guide](./NETLIFY_DEPLOYMENT_GUIDE.md)
- [Deployment Runbook](./NETLIFY_DEPLOYMENT_RUNBOOK.md)
- [Quick Start](./NETLIFY_QUICKSTART.md)
- [Architecture](./ARCHITECTURE.md)
- [Ground Rules](./GROUND_RULES.md)

---

**Checklist Version:** 1.0  
**Last Updated:** 2025-11-29  
**Next Review:** After first production deployment
