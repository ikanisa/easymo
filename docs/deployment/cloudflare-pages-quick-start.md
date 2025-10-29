# Cloudflare Pages Deployment - Quick Start Guide

## Overview
This guide provides a quick walkthrough for deploying the EasyMO Admin Panel to Cloudflare Pages. For detailed information, see [cloudflare-pages-deployment.md](./cloudflare-pages-deployment.md).

## Prerequisites (5 minutes)

1. **Cloudflare Account**
   - Sign up at https://dash.cloudflare.com
   - Note your Account ID (in URL or dashboard)

2. **Domain Setup**
   - Domain `ikanisa.com` added to Cloudflare
   - DNS managed by Cloudflare

3. **Required Secrets** (collect these first)
   - Supabase URL and keys
   - Admin session secret (min 16 chars)
   - Admin access credentials
   - Cloudflare API token

## Method 1: GitHub Actions (Recommended)

### Step 1: Configure GitHub Secrets (3 minutes)
Go to GitHub repository Settings → Secrets → Actions:

```
CLOUDFLARE_API_TOKEN=<your-api-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
NEXT_PUBLIC_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_DEFAULT_ACTOR_ID=<uuid>
```

### Step 2: Create Cloudflare Pages Project (2 minutes)
In Cloudflare Dashboard:
1. Go to Pages → Create a project
2. Project name: `easymo-admin`
3. Connect to GitHub: `ikanisa/easymo`
4. Skip build configuration (GitHub Actions will handle it)

### Step 3: Add Server Secrets to Cloudflare (3 minutes)
In Cloudflare Pages → easymo-admin → Settings → Environment variables:

**Production environment:**
```
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ADMIN_SESSION_SECRET=<min-16-char-secret>
ADMIN_TOKEN=<admin-token>
EASYMO_ADMIN_TOKEN=<same-as-admin-token>
ADMIN_ACCESS_CREDENTIALS=[{"actorId":"<uuid>","token":"<token>","label":"Ops"}]
```

### Step 4: Deploy (1 minute)
```bash
# Push to main branch or trigger manual workflow
git push origin main
```

Monitor deployment at: GitHub → Actions → "Deploy Admin Panel to Cloudflare Pages"

### Step 5: Configure Custom Domain (2 minutes)
In Cloudflare Pages → easymo-admin → Custom domains:
1. Add custom domain: `easymo.ikanisa.com`
2. Wait for DNS propagation (~5 minutes)

### Step 6: Verify (2 minutes)
```bash
# Check deployment
curl -I https://easymo.ikanisa.com

# Test login
# Visit https://easymo.ikanisa.com/login
```

**Total Time: ~20 minutes**

---

## Method 2: Manual CLI Deployment

### Step 1: Install Dependencies
```bash
npm install -g wrangler pnpm@10.18.3
```

### Step 2: Login to Cloudflare
```bash
wrangler login
```

### Step 3: Build the Application
```bash
cd /path/to/easymo

# Install dependencies
pnpm install --frozen-lockfile

# Build shared packages
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# Navigate to admin-app
cd admin-app

# Install admin-app dependencies
npm ci

# Build for Cloudflare Pages
npm run build
npx @cloudflare/next-on-pages
```

### Step 4: Deploy
```bash
# Deploy to Cloudflare Pages
npx wrangler pages deploy .vercel/output/static \
  --project-name=easymo-admin \
  --branch=main
```

### Step 5: Configure Environment Variables
```bash
# Use the setup script
cd ..
./scripts/setup-cloudflare-env.sh easymo-admin production
```

### Step 6: Configure Custom Domain
Same as Method 1, Step 5

**Total Time: ~15 minutes**

---

## Verification Checklist

After deployment, verify these items:

- [ ] **Domain accessible**: https://easymo.ikanisa.com returns 200 OK
- [ ] **SSL certificate**: Valid and issued by Cloudflare
- [ ] **Login page loads**: No console errors
- [ ] **Login works**: Can authenticate with test credentials
- [ ] **Session cookie set**: Check DevTools → Application → Cookies
- [ ] **Dashboard accessible**: Can navigate to /dashboard
- [ ] **API routes work**: /api/auth/* endpoints respond
- [ ] **Logout works**: Clears session and redirects
- [ ] **Security headers**: Check with `curl -I`
- [ ] **Performance**: Lighthouse score >90

## Troubleshooting

### Build Fails
```bash
# Ensure shared packages are built
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

### "Unauthorized" on Login
- Check `ADMIN_SESSION_SECRET` is set in Cloudflare Pages
- Verify `ADMIN_ACCESS_CREDENTIALS` JSON is valid
- Ensure credentials match your test tokens

### Domain Not Resolving
```bash
# Check DNS propagation
dig easymo.ikanisa.com

# Check Cloudflare DNS settings
# Ensure CNAME record points to Cloudflare Pages
```

### Environment Variables Not Loading
- Verify variables are set in Cloudflare Pages dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after adding variables

## Rollback

### Quick Rollback (via Dashboard)
1. Go to Cloudflare Pages → easymo-admin → Deployments
2. Find previous deployment
3. Click "Rollback to this deployment"

### Git Rollback
```bash
git revert <commit-sha>
git push origin main
```

## Next Steps

1. **Monitor**: Watch Cloudflare Analytics for errors
2. **Optimize**: Review performance metrics
3. **Test**: Run full QA checklist
4. **Document**: Record any issues or customizations
5. **Train**: Share deployment process with team

## Support

- **Documentation**: See [cloudflare-pages-deployment.md](./cloudflare-pages-deployment.md)
- **Prerequisites**: See [cloudflare-pages-prerequisites-checklist.md](./cloudflare-pages-prerequisites-checklist.md)
- **Environment Variables**: See [ENV_VARIABLES.md](../ENV_VARIABLES.md)
- **Cloudflare Docs**: https://developers.cloudflare.com/pages/
- **Next.js on Cloudflare**: https://developers.cloudflare.com/pages/framework-guides/nextjs/

---

**Last Updated:** 2025-10-29
**Estimated Setup Time:** 20 minutes (Method 1) or 15 minutes (Method 2)
