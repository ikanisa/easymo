# 🚀 Netlify Deployment Checklist - EasyMO Admin App

**Deployment Date**: ___________  
**Deployer**: ___________  
**Environment**: [ ] Production [ ] Preview [ ] Staging

---

## 📋 Pre-Deployment (Complete ALL items)

### 1. Code Preparation
- [ ] All code changes committed to Git
- [ ] Main branch is up to date: `git pull origin main`
- [ ] No uncommitted changes: `git status`
- [ ] All tests passing: `npm test`
- [ ] Build succeeds locally: `npm run build`

### 2. Environment Variables Setup
Navigate to: **Netlify Dashboard → Site Settings → Environment Variables**

#### Required Variables (Mark ✓ when added)

**Supabase**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-side only, NO prefix!)

**OpenAI**
- [ ] `OPENAI_API_KEY`
- [ ] `OPENAI_ORG_ID`
- [ ] `OPENAI_PROJECT_ID` (optional)

**Google AI**
- [ ] `GOOGLE_AI_API_KEY`
- [ ] `GOOGLE_CLOUD_PROJECT`
- [ ] `GOOGLE_APPLICATION_CREDENTIALS_JSON` (optional, for advanced features)

**Google Maps**
- [ ] `GOOGLE_MAPS_API_KEY`

**Google Search**
- [ ] `GOOGLE_SEARCH_API_KEY`
- [ ] `GOOGLE_SEARCH_ENGINE_ID`

**Session & Auth**
- [ ] `NEXTAUTH_SECRET` (min 32 chars)
- [ ] `NEXTAUTH_URL` (https://easymo-admin.netlify.app)
- [ ] `ADMIN_SESSION_SECRET` (min 16 chars)

**Feature Flags**
- [ ] `ENABLE_OPENAI_REALTIME=true`
- [ ] `ENABLE_GEMINI_LIVE=true`
- [ ] `ENABLE_IMAGE_GENERATION=true`
- [ ] `ENABLE_GOOGLE_SEARCH_GROUNDING=true`
- [ ] `ENABLE_VOICE_AGENTS=true`

### 3. Security Verification
- [ ] No `SERVICE_ROLE` in `NEXT_PUBLIC_*` variables
- [ ] No API keys in `NEXT_PUBLIC_*` variables
- [ ] No secrets in client-side code
- [ ] `.env` files NOT committed to Git
- [ ] Security headers configured in `netlify.toml`

### 4. Configuration Files
- [ ] `admin-app/netlify.toml` exists
- [ ] `admin-app/next.config.js` configured
- [ ] `.github/workflows/netlify-deploy.yml` exists
- [ ] `deploy-netlify.sh` is executable

### 5. Dependencies
- [ ] All packages installed: `npm ci`
- [ ] No critical vulnerabilities: `npm audit`
- [ ] Lockfile committed: `package-lock.json`

---

## 🏗️ Deployment Process

### Option A: Automated (GitHub Actions)
1. [ ] Push to `main` branch: `git push origin main`
2. [ ] Monitor workflow: https://github.com/ikanisa/easymo/actions
3. [ ] Verify build logs (no errors)
4. [ ] Wait for deployment completion (~5-10 minutes)

### Option B: Manual (Netlify CLI)
```bash
# 1. Login to Netlify
netlify login

# 2. Run deployment script
./deploy-netlify.sh preview    # For preview
./deploy-netlify.sh production # For production

# OR use Netlify CLI directly
cd admin-app
npm run build
netlify deploy --prod          # Production
netlify deploy                 # Preview
```

---

## ✅ Post-Deployment Verification

### 1. Basic Functionality
- [ ] Site loads: https://easymo-admin.netlify.app
- [ ] Login page accessible
- [ ] Dashboard loads after authentication
- [ ] No console errors in browser DevTools

### 2. API Endpoints
Test each endpoint:

```bash
SITE_URL="https://easymo-admin.netlify.app"

# Health check
curl -f $SITE_URL/api/health
# Expected: {"status": "ok", "timestamp": "..."}

# Chat completions (requires auth)
curl -X POST $SITE_URL/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'

# Voice endpoint
curl -f $SITE_URL/api/ai/voice

# Image generation
curl -f $SITE_URL/api/ai/images
```

- [ ] `/api/health` returns 200
- [ ] `/api/ai/chat` accessible (with auth)
- [ ] `/api/ai/voice` accessible
- [ ] `/api/ai/images` accessible
- [ ] `/api/ai/search` accessible

### 3. AI Features
- [ ] **Chat Completions**: Test OpenAI chat in UI
- [ ] **Voice Agent**: Test voice input/output
- [ ] **Image Generation**: Generate test image
- [ ] **Google Search**: Test grounded search
- [ ] **Google Maps**: Test location features

### 4. Performance
- [ ] Page load time < 3 seconds
- [ ] Time to Interactive (TTI) < 5 seconds
- [ ] No 404 errors in Network tab
- [ ] Static assets cached (check headers)
- [ ] Function execution time < 10 seconds

Check in Netlify Dashboard:
- [ ] Navigate to **Analytics → Performance**
- [ ] Verify Core Web Vitals are green
- [ ] Check function invocation count

### 5. Error Handling
- [ ] Test 404 page (visit `/nonexistent`)
- [ ] Test API errors (invalid requests)
- [ ] Test rate limiting
- [ ] Check error logs in Netlify Dashboard

### 6. Mobile Responsiveness
- [ ] Test on mobile viewport (DevTools)
- [ ] Navigation works on mobile
- [ ] Touch interactions functional
- [ ] No horizontal scroll

---

## 🔍 Monitoring Setup

### 1. Netlify Analytics
- [ ] Enable Real User Monitoring (RUM)
- [ ] Enable Server-side analytics
- [ ] Set up deployment notifications

Navigate to: **Netlify Dashboard → Site → Analytics**

### 2. External Monitoring (Optional)
- [ ] Add Sentry error tracking
- [ ] Set up Uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure LogRocket session replay
- [ ] Add Google Analytics/PostHog

### 3. Alerts
- [ ] Function errors email alert
- [ ] Build failure notifications
- [ ] Deployment success/failure webhooks

---

## 📊 Success Metrics

Record actual values after deployment:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Build Time | < 3 min | _____ | [ ] |
| Deploy Time | < 2 min | _____ | [ ] |
| Page Load (3G) | < 5s | _____ | [ ] |
| First Contentful Paint | < 2s | _____ | [ ] |
| Time to Interactive | < 5s | _____ | [ ] |
| Lighthouse Score | > 90 | _____ | [ ] |
| Function Success Rate | > 99% | _____ | [ ] |

---

## 🐛 Troubleshooting

If issues occur, check:

### Build Failures
```bash
# Check build logs
netlify logs

# Common fixes:
npm ci                          # Reinstall dependencies
npm run typecheck              # Fix TypeScript errors
npm run lint -- --fix          # Auto-fix lint issues
```

### Runtime Errors
1. [ ] Check Netlify Function logs
2. [ ] Verify environment variables
3. [ ] Test API endpoints individually
4. [ ] Check CORS configuration
5. [ ] Review browser console errors

### Performance Issues
1. [ ] Check function execution times
2. [ ] Verify caching headers
3. [ ] Optimize images
4. [ ] Reduce bundle size

---

## 🔄 Rollback Procedure

If deployment fails critically:

### Option 1: Netlify Dashboard
1. Navigate to **Deploys** tab
2. Find previous successful deploy
3. Click **"Publish deploy"**

### Option 2: Git Revert
```bash
# Find last working commit
git log --oneline

# Revert to that commit
git revert HEAD
git push origin main
```

### Option 3: Lock to specific deploy
```bash
netlify deploy --prod --alias=stable
```

---

## 📝 Post-Deployment Tasks

### Immediate (Within 1 hour)
- [ ] Announce deployment in team chat
- [ ] Update deployment log
- [ ] Monitor error rates for 30 minutes
- [ ] Test critical user flows

### Within 24 hours
- [ ] Review analytics data
- [ ] Check user feedback
- [ ] Monitor function costs
- [ ] Update documentation if needed

### Within 1 week
- [ ] Performance review
- [ ] Error pattern analysis
- [ ] Cost optimization check
- [ ] Plan next iteration

---

## 🎯 Final Sign-off

### Deployment Team
- [ ] Developer: _______________  Signature: _______  Date: _______
- [ ] QA Tester: _______________  Signature: _______  Date: _______
- [ ] DevOps: __________________  Signature: _______  Date: _______

### Verification
- [ ] All checklist items completed
- [ ] All critical features tested
- [ ] No blocking issues found
- [ ] Monitoring configured
- [ ] Documentation updated

**Deployment Status**: [ ] ✅ Success [ ] ⚠️ Partial [ ] ❌ Failed

**Notes/Issues**:
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## 📚 Resources

- **Netlify Dashboard**: https://app.netlify.com
- **Deployment Guide**: `admin-app/NETLIFY_DEPLOYMENT_GUIDE.md`
- **GitHub Actions**: https://github.com/ikanisa/easymo/actions
- **Supabase Dashboard**: https://supabase.com/dashboard
- **OpenAI Platform**: https://platform.openai.com
- **Google Cloud Console**: https://console.cloud.google.com

---

**Checklist Version**: 1.0  
**Last Updated**: 2025-11-29  
**Template Author**: EasyMO DevOps Team
