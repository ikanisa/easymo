# Netlify Quick Start Guide

This document provides a rapid deployment path for the EasyMO Admin Panel to Netlify.

## 🚀 Quick Deploy (5 Minutes)

### Prerequisites
- Netlify account
- GitHub repository access
- Supabase project set up

### Step 1: Connect Repository

1. Go to https://app.netlify.com
2. Click **Add new site** → **Import an existing project**
3. Choose **GitHub**
4. Select repository: `ikanisa/easymo`
5. Configure:
   - **Branch to deploy:** `main`
   - **Base directory:** `admin-app`
   - **Build command:** (leave empty, uses netlify.toml)
   - **Publish directory:** `.next`

### Step 2: Set Environment Variables

**Required Variables (Minimum to start):**

```bash
# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# Supabase (Server)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Admin Auth
EASYMO_ADMIN_TOKEN=your-secure-token-here
ADMIN_SESSION_SECRET=min-32-char-random-string

# Build
NODE_VERSION=20.18.0
PNPM_VERSION=10.18.3
NODE_ENV=production
```

**Optional AI Variables (Add as needed):**

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-...

# Google AI
GOOGLE_AI_API_KEY=AIzaSy...
GOOGLE_MAPS_API_KEY=AIzaSy...
```

### Step 3: Deploy

Click **Deploy site** - First build takes ~3-5 minutes.

### Step 4: Verify

Once deployed:
1. Visit your site URL (e.g., `https://your-site.netlify.app`)
2. Check homepage loads
3. Test login functionality
4. Verify API endpoints work

## 🔧 Build Configuration

The repository includes `netlify.toml` which handles:
- ✅ Shared package builds
- ✅ Next.js configuration
- ✅ Security headers
- ✅ Caching strategy
- ✅ Function timeouts

**No additional configuration needed!**

## 📊 Build Process

Netlify will automatically:

1. **Install dependencies** with pnpm
2. **Build shared packages** (@va/shared, @easymo/commons, etc.)
3. **Run security checks** (no service role keys in client code)
4. **Build admin-app** with Next.js
5. **Deploy** to CDN with serverless functions

Expected build time: **2-3 minutes**

## 🔍 Troubleshooting

### Build fails with "Cannot find module '@easymo/commons'"

**Solution:** The build command in netlify.toml should handle this. If not:

```toml
# In netlify.toml, ensure command includes:
command = "cd .. && pnpm --filter @va/shared build && pnpm --filter @easymo/commons build && cd admin-app && pnpm build"
```

### "SECURITY VIOLATION" error

**Cause:** Server secrets in NEXT_PUBLIC_* variables

**Solution:** 
- Remove `NEXT_PUBLIC_` prefix from sensitive keys
- Use `SUPABASE_SERVICE_ROLE_KEY` not `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`

### Function timeout errors

**Cause:** AI operations taking > 26 seconds

**Solution:**
- Use streaming responses for long operations
- Implement proper error handling
- Consider background processing

## 📚 Full Documentation

For complete deployment guide, see:
- [NETLIFY_DEPLOYMENT_GUIDE.md](./NETLIFY_DEPLOYMENT_GUIDE.md)

For architecture details, see:
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [GROUND_RULES.md](./GROUND_RULES.md)

## 🎯 Production Checklist

Before going live:

- [ ] Set custom domain in Netlify
- [ ] Configure DNS records
- [ ] Enable HTTPS (auto-provisioned)
- [ ] Set up monitoring/alerts
- [ ] Configure Sentry error tracking
- [ ] Test all AI features
- [ ] Run smoke tests: `./scripts/post-deploy-smoke.sh`
- [ ] Enable deploy notifications (Slack/Email)

## 💡 Tips

1. **Deploy Previews:** Enabled automatically for PRs
2. **Branch Deploys:** Configure for `staging` branch
3. **Instant Rollback:** Click previous deploy → Publish
4. **Build Logs:** Check real-time in Netlify dashboard
5. **Function Logs:** View under Functions tab

## 🔗 Useful Links

- **Netlify Dashboard:** https://app.netlify.com
- **Netlify Docs:** https://docs.netlify.com
- **Next.js on Netlify:** https://docs.netlify.com/integrations/frameworks/next-js/
- **Build Hooks:** Create in Site Settings → Build & Deploy

## ⚡ Pro Tips

### Faster Builds

Enable Netlify caching (already configured in netlify.toml):
```toml
NETLIFY_CACHE_NEXTJS=true
```

### Multiple Environments

Use Netlify contexts:
- `production` - main branch
- `deploy-preview` - PR previews
- `branch-deploy` - staging branch

Set different API keys per context in Netlify dashboard.

### Cost Optimization

Netlify Free Tier:
- 300 build minutes/month
- 100 GB bandwidth/month
- 125k function invocations/month

For EasyMO admin panel (internal tool), free tier should be sufficient.

---

**Ready to deploy? Click "Add new site" in Netlify!**

