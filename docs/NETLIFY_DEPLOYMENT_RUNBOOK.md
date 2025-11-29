# Netlify Deployment Runbook

**Purpose:** Step-by-step operational guide for deploying and managing EasyMO Admin Panel on Netlify.

---

## 📋 Pre-Deployment (Day Before Launch)

### 1. Verify All Requirements

```bash
# Clone and enter repository
cd /Users/jeanbosco/workspace/easymo

# Run comprehensive pre-deployment check
./scripts/pre-deploy-check.sh
```

**Expected Result:** All checks should pass ✅

### 2. Environment Variables Preparation

**Action:** Document all environment variables needed

```bash
# Use the template
cp .env.netlify.template .env.netlify.production

# Fill in actual values (DO NOT COMMIT THIS FILE)
vim .env.netlify.production
```

### 3. Database Migration Review

```bash
# Check pending migrations
supabase db diff --use-migra

# If migrations needed, apply them
supabase db push
```

### 4. Stakeholder Notification

**Action:** Send pre-deployment notification to:
- [ ] Development team
- [ ] QA team
- [ ] Product owner
- [ ] Support team

**Template:**
```
Subject: EasyMO Admin Panel - Production Deployment Scheduled

The EasyMO Admin Panel will be deployed to production via Netlify on [DATE] at [TIME].

Expected downtime: None (seamless deployment)
Rollback plan: Available via Netlify dashboard (instant)

Post-deployment testing window: 30 minutes
Full documentation: docs/NETLIFY_DEPLOYMENT_GUIDE.md
```

---

## 🚀 Deployment Day (Production Launch)

### Phase 1: Pre-Deployment Checks (15 min)

#### T-15min: Final Validation

```bash
# Pull latest changes
git checkout main
git pull origin main

# Run pre-deployment checks
./scripts/pre-deploy-check.sh
```

**Decision Point:** Proceed only if all checks pass ✅

#### T-10min: Environment Variables

1. Login to Netlify Dashboard
2. Navigate to: **Site Settings → Environment Variables**
3. Verify all required variables are set (see `.env.netlify.template`)
4. Double-check no `NEXT_PUBLIC_` prefix on server secrets

#### T-5min: Communication

**Action:** Post deployment start notification:
```
#engineering: Starting EasyMO Admin Panel deployment to Netlify. ETA: 5 minutes.
```

### Phase 2: Deployment (5-10 min)

#### Option A: Automatic Deployment (Recommended)

```bash
# Merge to main branch triggers automatic deployment
git checkout main
git merge develop  # or your feature branch
git push origin main
```

#### Option B: Manual Deployment via CLI

```bash
# Install Netlify CLI (if not installed)
npm install -g netlify-cli

# Login
netlify login

# Link to site (first time only)
cd admin-app
netlify link

# Deploy
netlify deploy --prod --build
```

#### Option C: Manual Trigger via GitHub Actions

1. Go to: https://github.com/ikanisa/easymo/actions
2. Select workflow: **Deploy to Netlify**
3. Click **Run workflow**
4. Select environment: `production`
5. Click **Run workflow**

### Phase 3: Monitoring (During Deployment)

**Watch build logs:**

1. Netlify Dashboard → Deploys → (Current Deploy)
2. Monitor for errors in real-time
3. Check build time (normal: 2-3 minutes)

**Expected build stages:**
1. ✅ Clone repository
2. ✅ Install dependencies (pnpm)
3. ✅ Build @va/shared
4. ✅ Build @easymo/commons
5. ✅ Build @easymo/video-agent-schema
6. ✅ Build @easymo/ui
7. ✅ Run security checks
8. ✅ Build admin-app
9. ✅ Deploy to CDN
10. ✅ Deploy functions

**If build fails:** See [Troubleshooting](#troubleshooting) section

### Phase 4: Post-Deployment Verification (15 min)

#### T+0min: Automated Tests

```bash
# Run smoke tests (replace URL with your site)
./scripts/post-deploy-smoke.sh https://your-site.netlify.app
```

**Expected:** All tests pass ✅

#### T+5min: Manual UI Verification

**Test these critical paths:**

1. **Authentication:**
   - [ ] Login page loads
   - [ ] Login with valid credentials works
   - [ ] Invalid credentials rejected
   - [ ] Logout works

2. **Agent Management:**
   - [ ] Agents list page loads
   - [ ] Can view agent details
   - [ ] Can create new agent
   - [ ] Can edit agent
   - [ ] Can test agent chat

3. **AI Features:**
   - [ ] Chat completions work
   - [ ] OpenAI integration functional
   - [ ] Google AI integration functional (if enabled)
   - [ ] Voice features work (if enabled)
   - [ ] Image generation works (if enabled)

4. **API Endpoints:**
   - [ ] `/api/health` returns 200
   - [ ] `/api/ai/chat` accepts authenticated requests
   - [ ] `/api/ai/agents` lists agents

5. **Performance:**
   - [ ] Homepage loads in < 3 seconds
   - [ ] No console errors in browser
   - [ ] Images load properly
   - [ ] Navigation is smooth

#### T+10min: Monitoring Setup Verification

1. **Check Netlify Analytics:**
   - Verify traffic is being recorded
   - Check function invocations

2. **Check Sentry (if configured):**
   - Verify no errors logged
   - Check source maps uploaded

3. **Check Application Logs:**
   - Review Netlify function logs
   - Check for any unexpected errors

### Phase 5: Go-Live Communication (T+15min)

**If all tests pass:**

```
#engineering: ✅ EasyMO Admin Panel successfully deployed to production!
Site: https://your-site.netlify.app
Status: All systems operational
Smoke tests: PASSED
```

**Update documentation:**
- [ ] Update deployment date in docs
- [ ] Record deployment version/commit
- [ ] Update runbook with any lessons learned

---

## 🔄 Rollback Procedure

**If deployment fails or critical issues found:**

### Immediate Rollback (< 2 minutes)

#### Method 1: Via Netlify Dashboard (Fastest)

1. Go to Netlify Dashboard → **Deploys**
2. Find previous successful deploy
3. Click **"Publish deploy"**
4. Confirm rollback

**Downtime:** ~30 seconds

#### Method 2: Via Netlify CLI

```bash
netlify rollback
```

#### Method 3: Via Git Revert

```bash
# Revert last commit
git revert HEAD
git push origin main

# Automatic deployment will trigger
```

### Post-Rollback Actions

1. **Communicate:**
   ```
   #engineering: ⚠️  Deployment rolled back to previous version.
   Reason: [DESCRIBE ISSUE]
   Current status: Investigating
   ```

2. **Investigate:**
   - Check Netlify build logs
   - Review function logs
   - Check Sentry errors
   - Review user reports

3. **Document:**
   - Add to post-mortem doc
   - Update runbook with fix
   - Create GitHub issue

---

## 🐛 Troubleshooting

### Build Failures

#### Error: "Cannot find module '@easymo/commons'"

**Cause:** Shared packages not built

**Fix:**
```bash
# Verify netlify.toml build command includes:
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build
```

#### Error: "SECURITY VIOLATION"

**Cause:** Server secrets in NEXT_PUBLIC_* env vars

**Fix:**
1. Go to Netlify → Environment Variables
2. Find any `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` or similar
3. Rename without `NEXT_PUBLIC_` prefix
4. Redeploy

#### Error: "TypeScript errors"

**Cause:** Type checking failures

**Fix:**
```bash
# Run type check locally
cd admin-app
npm run type-check

# Fix errors, commit, push
```

### Runtime Issues

#### Issue: Functions timing out

**Symptoms:** 504 Gateway Timeout errors

**Fix:**
1. Implement streaming responses for long operations
2. Add proper error handling
3. Consider background processing

#### Issue: High memory usage

**Symptoms:** Function crashes, OOM errors

**Fix:**
1. Increase function memory in Netlify (up to 1024MB)
2. Optimize bundle size
3. Implement lazy loading

#### Issue: Cold start delays

**Symptoms:** First request slow (> 5s)

**Expected:** Cold starts are normal on Netlify
**Mitigation:**
- Keep functions warm with scheduled pings
- Optimize bundle size
- Use edge functions for critical paths

### Monitoring Issues

#### Issue: No logs appearing

**Check:**
1. Netlify Dashboard → Functions → Logs
2. Verify function was actually invoked
3. Check log retention settings

#### Issue: Sentry not receiving errors

**Check:**
1. Verify `NEXT_PUBLIC_SENTRY_DSN` is set
2. Check Sentry project quotas
3. Verify source maps uploaded

---

## 📊 Deployment Metrics

**Track these for each deployment:**

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Build Time | < 3 min | ___ | ___ |
| Deploy Time | < 5 min | ___ | ___ |
| Smoke Tests | 100% pass | ___ | ___ |
| Homepage Load | < 3s | ___ | ___ |
| Lighthouse Score | > 90 | ___ | ___ |
| Error Rate | < 0.1% | ___ | ___ |

---

## 📅 Maintenance Schedule

### Weekly
- [ ] Review deployment logs
- [ ] Check error rates
- [ ] Monitor bandwidth usage
- [ ] Review function invocations

### Monthly
- [ ] Review and rotate API keys
- [ ] Update dependencies
- [ ] Check Netlify usage against limits
- [ ] Review and update documentation

### Quarterly
- [ ] Full security audit
- [ ] Performance review
- [ ] Cost optimization review
- [ ] Disaster recovery drill

---

## 🔗 Quick Links

- **Netlify Dashboard:** https://app.netlify.com/sites/your-site
- **Build Logs:** https://app.netlify.com/sites/your-site/deploys
- **Function Logs:** https://app.netlify.com/sites/your-site/functions
- **Environment Variables:** https://app.netlify.com/sites/your-site/settings/env
- **GitHub Repository:** https://github.com/ikanisa/easymo
- **Sentry Dashboard:** https://sentry.io/organizations/your-org/projects/easymo-admin

---

## 📞 Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | ___ | ___ |
| Backend Lead | ___ | ___ |
| Frontend Lead | ___ | ___ |
| Product Owner | ___ | ___ |
| On-Call Engineer | ___ | ___ |

---

**Last Updated:** 2025-11-29  
**Next Review:** 2025-12-29  
**Document Owner:** DevOps Team
