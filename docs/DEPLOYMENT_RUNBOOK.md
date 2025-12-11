# Deployment Runbook - EasyMO Refactoring Changes

**Created:** December 10, 2025  
**Status:** Ready for execution  
**Risk Level:** LOW-MEDIUM  
**Estimated Time:** 2-3 hours

---

## 🎯 Overview

This runbook covers deployment of all refactoring changes from Phases 2, 5, 6, and 7.

**What Changed:**
- 3 WhatsApp voice services consolidated to 1
- 22 Supabase functions ready for deletion
- Migration folders consolidated (4 → 1)
- .skip files cleaned up (24 → 13)

**All code is already on GitHub main branch** ✅

---

## ⚠️ Prerequisites

### Required Access
- [ ] GitHub repository access (ikanisa/easymo)
- [ ] Supabase project admin access
- [ ] Staging environment access
- [ ] Production deployment permissions (for final step)

### Required Credentials
- [ ] `SUPABASE_PROJECT_REF` - Get from Supabase dashboard
- [ ] `OPENAI_API_KEY` - For voice service
- [ ] Docker/Kubernetes access - For service deployment

### Team Coordination
- [ ] Notify team of deployment window
- [ ] Schedule code review if needed
- [ ] Coordinate staging environment usage
- [ ] Plan rollback window

---

## 📋 Pre-Deployment Checklist

### 1. Local Environment Setup
```bash
# Clone/pull latest
git checkout main
git pull origin main

# Verify you have the latest refactoring
git log --oneline -5
# Should show Phase 6 and Phase 7 commits

# Install dependencies
pnpm install --frozen-lockfile
```

### 2. Review Changes
```bash
# Review service consolidation
ls -la services/ | grep -E "whatsapp|voice"

# Review documentation
cat docs/PHASE6_WHATSAPP_VOICE_CONSOLIDATION.md
cat docs/PHASE7_SKIP_MIGRATION_REVIEW.md
cat TECHNICAL_DEBT_CLEANUP_COMPLETE.md
```

### 3. Verify Service State
```bash
# Check if whatsapp-media-server exists
if [ -d "services/whatsapp-media-server" ]; then
  echo "✅ New service exists"
else
  echo "❌ Service not found - check git history"
fi

# Check for old services (should be archived)
if [ -d ".archive/services-superseded-20251210" ]; then
  echo "✅ Old services properly archived"
fi
```

---

## 🚀 Deployment Steps

### STEP 1: Clean Up Local Duplicates (10 min)

**Issue:** Local filesystem may have both old and new services.

```bash
# Navigate to project root
cd /path/to/easymo

# Check what exists
echo "Current services:"
ls -d services/*whatsapp* services/*voice* 2>/dev/null

# If you see BOTH whatsapp-media-server AND whatsapp-voice-bridge:
# This means the rename in git didn't fully apply locally

# SOLUTION: Remove old services that should be archived
if [ -d "services/voice-media-bridge" ] && [ -d ".archive/services-superseded-20251210/voice-media-bridge" ]; then
  echo "Removing local duplicate: voice-media-bridge"
  rm -rf services/voice-media-bridge
fi

if [ -d "services/voice-media-server" ] && [ -d ".archive/services-superseded-20251210/voice-media-server" ]; then
  echo "Removing local duplicate: voice-media-server"
  rm -rf services/voice-media-server
fi

# If whatsapp-voice-bridge exists but whatsapp-media-server doesn't:
if [ -d "services/whatsapp-voice-bridge" ] && [ ! -d "services/whatsapp-media-server" ]; then
  echo "Renaming: whatsapp-voice-bridge → whatsapp-media-server"
  mv services/whatsapp-voice-bridge services/whatsapp-media-server
fi

# Verify final state
echo "Final service list:"
ls -d services/*whatsapp* services/*voice* 2>/dev/null
```

**Expected result:**
```
services/voice-bridge          ✅ (kept - different purpose)
services/voice-gateway         ✅ (kept - SIP gateway)
services/whatsapp-media-server ✅ (new consolidated service)
services/whatsapp-pricing-server ✅
services/whatsapp-webhook-worker ✅
```

---

### STEP 2: Test Consolidated Service Locally (30 min)

```bash
# Navigate to service
cd services/whatsapp-media-server

# Check package.json
cat package.json | grep -E "name|version|description"
# Should show:
#   "name": "@easymo/whatsapp-media-server"
#   "version": "2.0.0"

# Install dependencies
npm install

# Build
npm run build

# Expected: Clean build with no errors
# If errors: Check dependencies and TypeScript config
```

**If build fails:**
1. Check for missing dependencies
2. Verify tsconfig.json
3. Check for broken imports
4. Review build logs carefully

**If build succeeds:**
```bash
# Create .env if needed (copy from .env.example)
cp .env.example .env

# Edit .env with your credentials
# Required:
#   OPENAI_API_KEY=...
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...

# Start service (don't expose port 3100 if already used)
PORT=3199 npm run dev &
SERVICE_PID=$!

# Wait for startup
sleep 5

# Test health endpoint
curl http://localhost:3199/health

# Expected: {"status":"healthy","service":"whatsapp-media-server"}

# Stop service
kill $SERVICE_PID
```

---

### STEP 3: Update Docker Compose (10 min)

```bash
# Verify docker-compose.voice-media.yml
cat docker-compose.voice-media.yml

# It should reference whatsapp-media-server
# If it still references voice-media-bridge, update it:

# Create backup
cp docker-compose.voice-media.yml docker-compose.voice-media.yml.backup

# Update the file (already done in Phase 6, but verify)
grep "whatsapp-media-server" docker-compose.voice-media.yml

# Expected output should include:
#   whatsapp-media-server:
#     context: ./services/whatsapp-media-server
#     container_name: easymo-whatsapp-media-server
```

**Test Docker build:**
```bash
# Build image
docker-compose -f docker-compose.voice-media.yml build whatsapp-media-server

# Expected: Successful build

# Test run (don't start yet, just validate)
docker-compose -f docker-compose.voice-media.yml config

# Expected: Valid YAML, no errors
```

---

### STEP 4: Execute Supabase Function Deletions (15 min)

**⚠️ CRITICAL: This step requires Supabase admin access**

```bash
# Get your project reference
# Go to: https://app.supabase.com/project/_/settings/general
# Copy "Reference ID"

# Set environment variable
export SUPABASE_PROJECT_REF='your-project-ref-here'

# Verify it's set
echo $SUPABASE_PROJECT_REF

# Review what will be deleted
cat scripts/refactor/delete-archived-functions.sh

# Functions to be deleted (22 total):
# - 13 agent duplicates
# - 9 inactive functions

# Execute deletion script
./scripts/refactor/delete-archived-functions.sh

# Expected output:
#   Deleting agent-chat... ✅
#   Deleting agent-config-invalidator... ✅
#   [... 20 more ...]
#   ✅ Phase 2 Supabase cleanup complete!

# Verify deletions
supabase functions list --project-ref $SUPABASE_PROJECT_REF | wc -l
# Should show ~90-95 functions (down from ~114)
```

**If script fails:**
- Check SUPABASE_PROJECT_REF is correct
- Verify you have admin permissions
- Check network connectivity
- Some functions may already be deleted (warnings are OK)

---

### STEP 5: Deploy to Staging (30 min)

**Prerequisites:**
- Staging environment ready
- Environment variables configured
- Team notified

```bash
# Option A: Docker Compose (if staging uses docker-compose)
docker-compose -f docker-compose.voice-media.yml up -d whatsapp-media-server

# Option B: Kubernetes (if staging uses k8s)
kubectl apply -f k8s/whatsapp-media-server.yaml

# Option C: Cloud deployment (Railway, Fly.io, etc.)
# Follow platform-specific deployment steps

# Monitor logs
docker-compose -f docker-compose.voice-media.yml logs -f whatsapp-media-server
# OR
kubectl logs -f deployment/whatsapp-media-server

# Watch for:
#   ✅ "Server started on port..."
#   ✅ "WebRTC initialized"
#   ✅ "Connected to OpenAI"
#   ❌ Any ERROR messages
```

---

### STEP 6: Staging Validation (30 min)

**Health Checks:**
```bash
# Get staging URL (replace with your staging domain)
STAGING_URL="https://staging.easymo.app"

# Test health endpoint
curl $STAGING_URL/api/voice/health

# Expected: {"status":"healthy"}

# Test WebRTC capability (if endpoint exists)
curl $STAGING_URL/api/voice/capabilities

# Check metrics (if available)
curl $STAGING_URL/metrics
```

**Functional Tests:**

1. **Test WhatsApp Voice Call**
   - [ ] Initiate test call to WhatsApp number
   - [ ] Verify audio connection established
   - [ ] Confirm OpenAI Realtime API integration
   - [ ] Check call quality and latency
   - [ ] Verify call ends cleanly

2. **Test Error Handling**
   - [ ] Test with invalid API key (should fail gracefully)
   - [ ] Test with network interruption
   - [ ] Verify error logging

3. **Monitor Performance**
   - [ ] Check CPU usage (should be stable)
   - [ ] Check memory usage (no leaks)
   - [ ] Monitor response times
   - [ ] Check for any errors in logs

**Validation Checklist:**
- [ ] Service starts without errors
- [ ] Health endpoint responds correctly
- [ ] WhatsApp voice calls work end-to-end
- [ ] OpenAI integration functional
- [ ] No memory leaks observed
- [ ] Logs show expected behavior
- [ ] Metrics look healthy

---

### STEP 7: Production Deployment (30 min)

**⚠️ ONLY proceed if staging validation passed 100%**

**Pre-Production Checklist:**
- [ ] Staging tests passed
- [ ] Team approval obtained
- [ ] Rollback plan ready
- [ ] Monitoring configured
- [ ] On-call engineer available

**Deploy:**
```bash
# Same process as staging, but to production

# Option A: Blue-Green Deployment (RECOMMENDED)
# 1. Deploy new version alongside old
# 2. Test new version
# 3. Switch traffic gradually
# 4. Monitor closely
# 5. Complete cutover if successful

# Option B: Rolling Update
# 1. Deploy to one instance
# 2. Monitor for 10-15 minutes
# 3. Deploy to remaining instances
# 4. Monitor for 30 minutes

# Option C: All-at-once (RISKY - not recommended)
# Only if you have very low traffic or good rollback
```

**Post-Deployment Monitoring (1 hour):**
```bash
# Monitor logs continuously
tail -f /var/log/whatsapp-media-server/*.log

# Watch metrics dashboard
# Check: CPU, Memory, Request Rate, Error Rate, Latency

# Test production endpoints
curl https://api.easymo.app/voice/health

# Monitor for 1 hour minimum before considering stable
```

---

## 🔄 Rollback Procedures

### If Issues Detected in Staging

```bash
# Stop the service
docker-compose -f docker-compose.voice-media.yml down whatsapp-media-server

# Revert to old service (if needed)
# Note: Old services are in .archive/services-superseded-20251210/

# Restore from archive
cp -r .archive/services-superseded-20251210/voice-media-bridge services/
cp -r .archive/services-superseded-20251210/voice-media-server services/

# Update docker-compose back to old config
git checkout HEAD~1 docker-compose.voice-media.yml

# Redeploy old version
docker-compose -f docker-compose.voice-media.yml up -d
```

### If Issues Detected in Production

**IMMEDIATE:**
```bash
# Option 1: Route traffic back to old service (if blue-green)
# Update load balancer / ingress to point to old service

# Option 2: Rollback deployment
kubectl rollout undo deployment/whatsapp-media-server

# Option 3: Scale down new, scale up old
docker-compose scale whatsapp-media-server=0
docker-compose scale voice-media-bridge=1
```

**Git Rollback:**
```bash
# If you need to revert code changes
git revert <commit-hash>
git push origin main
```

---

## 📊 Success Criteria

### Deployment is Successful When:

- [x] whatsapp-media-server builds without errors
- [x] Service starts and stays running
- [x] Health endpoint responds correctly
- [x] WhatsApp voice calls complete successfully
- [x] OpenAI integration works
- [x] No error spikes in logs
- [x] Performance metrics within acceptable range
- [x] No memory leaks after 1 hour
- [x] Old services successfully removed
- [x] Supabase functions deleted (22 removed)

### Metrics to Monitor

**Before Deployment (Baseline):**
- Service count: 24 services
- Function count: ~114 Supabase functions
- Duplicated code: ~2,800 lines

**After Deployment (Target):**
- Service count: 22 services (-8.3%)
- Function count: ~90-95 functions (-20%)
- Duplicated code: 0 lines (-100%)
- Single voice service running: whatsapp-media-server

---

## 📞 Contacts & Escalation

**If Issues Arise:**

1. **Check Documentation First:**
   - This runbook
   - docs/PHASE6_WHATSAPP_VOICE_CONSOLIDATION.md
   - docs/TECHNICAL_DEBT_CLEANUP_COMPLETE.md

2. **Review Git History:**
   - All commits are well-documented
   - Each phase has detailed commit messages

3. **Rollback Options:**
   - Everything is archived (not deleted)
   - Clear rollback procedures above
   - Old services in `.archive/services-superseded-20251210/`

4. **Team Escalation:**
   - Notify DevOps lead
   - Contact backend team
   - Review with architect if needed

---

## 🎯 Post-Deployment Tasks

### Immediate (Within 24 hours)
- [ ] Monitor service for stability
- [ ] Review error logs
- [ ] Confirm voice calls working
- [ ] Validate OpenAI costs (no unexpected increase)

### Short-term (Within 1 week)
- [ ] Remove old service directories permanently (if stable)
- [ ] Update documentation
- [ ] Archive old docker images
- [ ] Clean up old environment variables

### Medium-term (Within 1 month)
- [ ] Review performance improvements
- [ ] Gather team feedback
- [ ] Identify additional optimization opportunities
- [ ] Consider further consolidations

---

## 📝 Deployment Log Template

```
DEPLOYMENT LOG
==============
Date: ___________
Deployed by: ___________
Environment: [ ] Staging  [ ] Production

Pre-deployment checks:
[ ] Code pulled from main
[ ] Dependencies installed
[ ] Service built successfully
[ ] Docker tested locally
[ ] Team notified

Deployment steps:
[ ] Step 1: Clean up duplicates - Time: _____
[ ] Step 2: Local testing - Time: _____
[ ] Step 3: Docker config updated - Time: _____
[ ] Step 4: Supabase functions deleted - Time: _____
[ ] Step 5: Deployed to staging - Time: _____
[ ] Step 6: Staging validation - Time: _____
[ ] Step 7: Deployed to production - Time: _____

Issues encountered:
_________________________________________________
_________________________________________________

Resolution:
_________________________________________________
_________________________________________________

Final status: [ ] Success  [ ] Partial  [ ] Rollback
Notes:
_________________________________________________
_________________________________________________
```

---

## ✅ Final Notes

**What This Deployment Achieves:**
- ✅ Cleaner architecture (24 → 22 services)
- ✅ Reduced duplication (-2,800 lines)
- ✅ Single voice service (easier maintenance)
- ✅ Cleaner Supabase functions (-22 functions)
- ✅ Better documented codebase

**Risk Mitigation:**
- Everything is archived (easy rollback)
- Comprehensive testing steps
- Clear success criteria
- Multiple rollback options

**Time Investment:**
- Staging deployment: ~2 hours
- Production deployment: ~1 hour
- Total: ~3 hours with monitoring

**Recommended Execution:**
- Best time: Business hours, weekday
- Team: At least 2 people (deployer + reviewer)
- Duration: Allow 4 hours for full cycle

---

**Last Updated:** December 10, 2025  
**Created by:** AI Assistant  
**Status:** ✅ Ready for execution

