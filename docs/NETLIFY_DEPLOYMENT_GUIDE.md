# EasyMO Admin Panel - Netlify Deployment Guide

**Last Updated:** 2025-11-29  
**Version:** 1.0.0  
**Target:** Production Deployment

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Environment Variables Setup](#environment-variables-setup)
4. [Netlify Configuration](#netlify-configuration)
5. [Deployment Methods](#deployment-methods)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
8. [Rollback Procedures](#rollback-procedures)
9. [Performance Optimization](#performance-optimization)

---

## 🔧 Prerequisites

### Required Accounts & Services

- ✅ Netlify account with team access
- ✅ GitHub repository access (`ikanisa/easymo`)
- ✅ Supabase project (production instance)
- ✅ OpenAI API account with production keys
- ✅ Google AI Platform account (Gemini API)
- ✅ Google Maps API account
- ✅ Domain DNS access (if using custom domain)

### Required Tools (Local Development)

```bash
node --version    # >= 20.18.0
pnpm --version    # >= 10.18.3
netlify --version # >= 17.0.0 (Netlify CLI)
```

Install Netlify CLI:
```bash
npm install -g netlify-cli
netlify login
```

---

## ✅ Pre-Deployment Checklist

### 1. Build Dependencies

```bash
# From repository root
cd /Users/jeanbosco/workspace/easymo

# Install dependencies
pnpm install --frozen-lockfile

# Build shared packages FIRST (critical!)
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/video-agent-schema build
pnpm --filter @easymo/ui build
```

### 2. Run Pre-Build Security Checks

```bash
# These run automatically in prebuild, but test them manually first:
node ./scripts/assert-no-service-role-in-client.mjs
node ./scripts/assert-inventory-app-deferred.mjs
node ./scripts/assert-no-mocks-in-admin.mjs
```

**CRITICAL:** These checks will fail the build if:
- Server secrets (SERVICE_ROLE_KEY) are in client env vars (NEXT_PUBLIC_*)
- Mocks are enabled in production
- Inventory app is not properly deferred

### 3. Run Tests & Linting

```bash
# Admin app specific tests
cd admin-app
npm ci
npm run lint           # Must pass with 0 errors
npm run type-check     # TypeScript validation
npm test -- --run      # Vitest tests

# Root level tests
cd ..
pnpm lint              # 2 console warnings OK
pnpm exec vitest run   # 84 tests should pass
```

### 4. Local Build Test

```bash
# Test production build locally
cd admin-app
NODE_ENV=production npm run build

# If successful, test the production server
npm run start
# Visit http://localhost:3000 and verify functionality
```

### 5. Database Migration Status

```bash
# Ensure all migrations are applied
supabase db push

# Verify schema alignment
pnpm schema:verify
```

---

## 🔐 Environment Variables Setup

### Netlify Environment Variables

Go to: **Netlify Dashboard → Site Settings → Environment Variables**

### 🌍 Public Variables (Safe for Client-Side)

```bash
# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Environment
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_UI_V2_ENABLED=true
NEXT_PUBLIC_USE_MOCKS=false

# Feature Flags
NEXT_PUBLIC_FEATURE_MARKETPLACE=true
NEXT_PUBLIC_FEATURE_VOICE_AGENTS=true
NEXT_PUBLIC_FEATURE_IMAGE_GEN=true
NEXT_PUBLIC_ENABLE_GOOGLE_SEARCH=true
```

### 🔒 Server-Only Variables (CRITICAL: No NEXT_PUBLIC_ prefix!)

```bash
# Supabase (Server)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Admin Authentication
EASYMO_ADMIN_TOKEN=<your-secure-admin-token>
ADMIN_SESSION_SECRET=<min-32-char-random-string>

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-...

# Google AI
GOOGLE_AI_API_KEY=AIzaSy...
GOOGLE_CLOUD_PROJECT=easymo-prod

# Google Maps
GOOGLE_MAPS_API_KEY=AIzaSy...

# Google Custom Search
GOOGLE_SEARCH_API_KEY=AIzaSy...
GOOGLE_SEARCH_ENGINE_ID=...

# Database (if using Prisma Agent-Core)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis (if caching enabled)
REDIS_URL=redis://localhost:6380

# Kafka (if microservices enabled)
KAFKA_BROKERS=localhost:19092

# Feature Flags (Server)
ENABLE_OPENAI_REALTIME=true
ENABLE_GEMINI_LIVE=true
ENABLE_IMAGE_GENERATION=true
ENABLE_GOOGLE_SEARCH_GROUNDING=true

# Build Configuration
NODE_VERSION=20.18.0
PNPM_VERSION=10.18.3
NODE_ENV=production
```

### 🚨 Security Rules

**NEVER** do this:
```bash
❌ NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=...  # WRONG!
❌ NEXT_PUBLIC_OPENAI_API_KEY=...             # WRONG!
❌ NEXT_PUBLIC_ADMIN_TOKEN=...                # WRONG!
```

**ALWAYS** do this:
```bash
✅ SUPABASE_SERVICE_ROLE_KEY=...              # Correct
✅ OPENAI_API_KEY=...                         # Correct
✅ EASYMO_ADMIN_TOKEN=...                     # Correct
```

### Scoped Environment Variables

Netlify supports context-specific variables:

| Context | Use Case |
|---------|----------|
| `Production` | Main production deployment |
| `Deploy Preview` | PR preview deployments |
| `Branch Deploy` | Staging/development branches |

Set different API keys per context if needed:
- Production: Use production OpenAI/Google keys
- Deploy Preview: Use development/test keys

---

## ⚙️ Netlify Configuration

### 1. Site Settings

**Netlify Dashboard → Site Settings → General**

- **Site name:** `easymo-admin` (or your custom name)
- **Custom domain:** `admin.easymo.com` (configure DNS)
- **HTTPS:** Force HTTPS enabled
- **Branch deploys:** Only from `main` or `production` branch

### 2. Build Settings

**Netlify Dashboard → Site Settings → Build & Deploy**

```toml
[build]
  base = "admin-app"
  publish = ".next"
  command = "pnpm --filter @easymo/admin-app build"

[build.environment]
  NODE_VERSION = "20.18.0"
  PNPM_VERSION = "10.18.3"
  NODE_ENV = "production"
```

### 3. Deploy Configuration

**Branch Settings:**
- **Production branch:** `main` or `production`
- **Deploy previews:** Enable for all pull requests
- **Branch deploys:** Enable for `staging` branch (optional)

**Build hooks:** Create webhook for manual/automated deployments:
```
https://api.netlify.com/build_hooks/YOUR_HOOK_ID
```

### 4. Functions Configuration

Netlify automatically handles Next.js API routes and middleware as serverless functions.

**Settings:**
- Function timeout: 26 seconds (Netlify limit)
- Function memory: 1024 MB (adjust if needed)

### 5. Redirects & Headers

These are configured in `netlify.toml` (already in repo):

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
```

---

## 🚀 Deployment Methods

### Method 1: Automatic Deployment (Recommended)

**Triggered on every push to `main` branch:**

```bash
git add .
git commit -m "feat: deploy AI agent improvements"
git push origin main
```

Netlify will:
1. Detect the push
2. Clone the repository
3. Install dependencies with pnpm
4. Build shared packages
5. Build admin-app
6. Deploy to production
7. Send notifications

### Method 2: Manual Deployment via Netlify CLI

```bash
# Login to Netlify
netlify login

# Link to your site (first time only)
cd admin-app
netlify link

# Deploy to production
netlify deploy --prod --build

# Or deploy to staging/preview
netlify deploy --build
```

### Method 3: Deploy from Local Build

```bash
# Build locally first
cd /Users/jeanbosco/workspace/easymo
pnpm install --frozen-lockfile
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/video-agent-schema build
cd admin-app
npm run build

# Deploy the .next folder
netlify deploy --prod --dir=.next
```

### Method 4: Deploy via Build Hook

```bash
# Trigger deployment via webhook
curl -X POST -d '{}' https://api.netlify.com/build_hooks/YOUR_HOOK_ID
```

---

## ✅ Post-Deployment Verification

### 1. Automated Checks

Netlify runs these automatically:
- ✅ Build success
- ✅ Function deployment
- ✅ SSL certificate
- ✅ DNS propagation

### 2. Manual Smoke Tests

```bash
# Run smoke tests
cd /Users/jeanbosco/workspace/easymo
pnpm smoke:netlify
```

### 3. UI Verification Checklist

Visit your deployed site and verify:

- [ ] **Home Page:** Loads without errors
- [ ] **Authentication:** Login/logout works
- [ ] **Agent Management:** 
  - [ ] List agents
  - [ ] Create new agent
  - [ ] Edit agent configuration
  - [ ] Test agent chat
- [ ] **AI Features:**
  - [ ] Chat completions working
  - [ ] Voice agent functional (if enabled)
  - [ ] Image generation working (if enabled)
  - [ ] Google Maps integration active
- [ ] **API Routes:**
  - [ ] `/api/health` returns 200
  - [ ] `/api/ai/chat` accepts requests
  - [ ] `/api/ai/agents` lists agents
- [ ] **Performance:**
  - [ ] Page load < 3 seconds
  - [ ] Lighthouse score > 90

### 4. API Endpoint Tests

```bash
# Health check
curl https://your-site.netlify.app/api/health

# Test chat completion (with auth)
curl -X POST https://your-site.netlify.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "gpt-4o"
  }'
```

### 5. Error Monitoring Setup

**Sentry Integration:**
- Verify errors are logged to Sentry
- Check source maps are uploaded
- Test error alerts

**Netlify Analytics:**
- Enable Netlify Analytics in dashboard
- Monitor traffic and performance

---

## 📊 Monitoring & Troubleshooting

### Netlify Dashboard Monitoring

**Deploy Logs:**
- View real-time build logs
- Check for build warnings/errors
- Monitor deployment duration

**Functions Logs:**
- View serverless function invocations
- Check function errors
- Monitor cold start times

**Bandwidth & Usage:**
- Track bandwidth consumption
- Monitor function execution minutes
- Check build minutes used

### Common Issues & Solutions

#### Issue 1: Build Fails - "Cannot find module '@easymo/commons'"

**Cause:** Shared packages not built before admin-app

**Solution:**
```bash
# Update netlify.toml command:
command = "pnpm --filter @va/shared build && pnpm --filter @easymo/commons build && pnpm --filter @easymo/video-agent-schema build && pnpm --filter @easymo/admin-app build"
```

#### Issue 2: "SECURITY VIOLATION" in Build

**Cause:** Server secrets in NEXT_PUBLIC_* variables

**Solution:**
- Remove `NEXT_PUBLIC_` prefix from sensitive keys
- Check Netlify environment variables
- Verify `.env` files not committed

#### Issue 3: Function Timeout (26s limit)

**Cause:** Long-running AI operations

**Solution:**
- Implement streaming responses
- Use background jobs for long tasks
- Optimize API calls with caching

#### Issue 4: Next.js Image Optimization Errors

**Cause:** Netlify doesn't support Next.js Image Optimization by default

**Solution:**
Already configured in `next.config.mjs`:
```js
images: {
  unoptimized: false, // Netlify handles this via plugin
  remotePatterns: [
    { protocol: 'https', hostname: '**.supabase.co' }
  ]
}
```

#### Issue 5: WebSocket Connections Failing

**Cause:** Netlify Functions don't support WebSockets directly

**Solution:**
- Use Supabase Realtime for WebSocket needs
- Implement polling fallback
- Consider Netlify Edge Functions for real-time features

### Debug Mode

Enable verbose logging:

```bash
# Set in Netlify environment variables
DEBUG=netlify:*
NEXT_DEBUG=true
```

---

## 🔄 Rollback Procedures

### Quick Rollback (Immediate)

**Via Netlify Dashboard:**
1. Go to **Deploys** tab
2. Find previous successful deploy
3. Click **Publish deploy**
4. Confirm rollback

**Via CLI:**
```bash
netlify rollback
```

### Rollback with Git

```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push --force origin main
```

### Database Rollback

If migrations need rollback:

```bash
# Create down migration
supabase migration new rollback_feature_x

# Apply rollback
supabase db push
```

---

## ⚡ Performance Optimization

### Build Performance

**Current build time:** ~2-3 minutes

**Optimization strategies:**

1. **Enable Netlify Build Cache:**
```toml
[build]
  environment = { NETLIFY_CACHE_NEXTJS = "true" }
```

2. **Parallelize Package Builds:**
```bash
pnpm --parallel --filter @va/shared --filter @easymo/commons build
```

3. **Incremental Static Regeneration:**
```js
// next.config.mjs
experimental: {
  isrMemoryCacheSize: 50 * 1024 * 1024 // 50MB
}
```

### Runtime Performance

**Lighthouse Targets:**
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 90

**Optimizations in place:**
- ✅ Image optimization (AVIF/WebP)
- ✅ Code splitting
- ✅ Bundle analysis
- ✅ Gzip compression
- ✅ CDN caching headers

### Cost Optimization

**Netlify Free Tier Limits:**
- 300 build minutes/month
- 100 GB bandwidth/month
- 125k function invocations/month

**Tips:**
- Use deploy previews sparingly
- Enable build skipping for docs-only changes
- Cache API responses
- Optimize images before upload

---

## 📚 Additional Resources

### Documentation
- [Netlify Next.js Documentation](https://docs.netlify.com/integrations/frameworks/next-js/)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [EasyMO Architecture Docs](./ARCHITECTURE.md)
- [EasyMO Ground Rules](./GROUND_RULES.md)

### Support Channels
- Netlify Support: https://answers.netlify.com/
- EasyMO Team: Internal Slack channel
- GitHub Issues: https://github.com/ikanisa/easymo/issues

### Monitoring Dashboards
- Netlify Dashboard: https://app.netlify.com
- Supabase Dashboard: https://app.supabase.com
- Sentry Dashboard: https://sentry.io

---

## 🎯 Quick Reference Commands

```bash
# Pre-deployment
pnpm install --frozen-lockfile
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build
cd admin-app && npm run lint && npm test -- --run

# Deploy
git push origin main  # Auto-deploy
netlify deploy --prod --build  # Manual deploy

# Verify
pnpm smoke:netlify
curl https://your-site.netlify.app/api/health

# Rollback
netlify rollback

# Debug
netlify dev  # Local development with Netlify environment
netlify functions:list  # List deployed functions
netlify logs  # View function logs
```

---

**Deployment Status:** ✅ Ready for Production  
**Last Reviewed:** 2025-11-29  
**Next Review:** 2025-12-29
