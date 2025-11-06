# Cloudflare Pages Deployment Guide - EasyMO Admin PWA

## Prerequisites

1. **Cloudflare Account** with Pages enabled
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **GitHub Repository** connected to Cloudflare Pages (recommended) or manual deployment via Wrangler

## Build Configuration

The app uses `@cloudflare/next-on-pages` to adapt Next.js App Router for Cloudflare Pages.

### Build Settings

- **Build Command**: `pnpm run pages:build`
- **Build Output Directory**: `.vercel/output/static`
- **Node Version**: 18 or higher
- **Root Directory**: `admin-app`

## Environment Variables

### Required Variables (Set in Cloudflare Pages Dashboard)

Navigate to: **Pages Project → Settings → Environment Variables**

#### Production & Preview Environments

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin Configuration
EASYMO_ADMIN_TOKEN=your-admin-token
ADMIN_SESSION_SECRET=your-session-secret-min-16-chars

# Feature Flags (optional)
NEXT_PUBLIC_UI_V2_ENABLED=false
FEATURE_MARKETPLACE=false
```

### Setting Secrets via Wrangler

```bash
# Login to Cloudflare
wrangler login

# Set production secrets
wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=easymo-admin-production
wrangler pages secret put EASYMO_ADMIN_TOKEN --project-name=easymo-admin-production
wrangler pages secret put ADMIN_SESSION_SECRET --project-name=easymo-admin-production

# Set preview secrets
wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=easymo-admin-preview
wrangler pages secret put EASYMO_ADMIN_TOKEN --project-name=easymo-admin-preview
wrangler pages secret put ADMIN_SESSION_SECRET --project-name=easymo-admin-preview
```

## Deployment Methods

### Method 1: GitHub Integration (Recommended)

1. **Connect Repository to Cloudflare Pages**
   - Go to Cloudflare Dashboard → Pages
   - Click "Create a project" → "Connect to Git"
   - Select your repository: `easymo-`
   - Configure build settings:
     - **Framework preset**: Next.js
     - **Build command**: `pnpm -w --filter @va/shared build && pnpm -w --filter @easymo/commons build && pnpm -w --filter @easymo/ui build && cd admin-app && pnpm build && pnpm exec @cloudflare/next-on-pages --skip-build`
     - **Build output directory**: `admin-app/.vercel/output/static`
     - **Root directory**: Leave empty (or set to repo root)
     - **Environment variables**: Add `NODE_VERSION=20`

2. **Set Environment Variables** (see above)

3. **Deploy**
   - Push to `main` branch for production
   - Any PR creates a preview deployment

### Method 2: Manual Deployment via Wrangler

```bash
# Navigate to admin-app directory
cd admin-app

# Install dependencies (from monorepo root first)
cd ..
pnpm install --frozen-lockfile
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
pnpm --filter @easymo/ui build

# Build and deploy
cd admin-app
pnpm run pages:build
wrangler pages deploy .vercel/output/static --project-name=easymo-admin-production
```

### Method 3: CI/CD via Wrangler Action

Add `.github/workflows/cloudflare-deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.18.3
          
      - name: Install dependencies
        run: |
          pnpm install --frozen-lockfile
          pnpm --filter @va/shared build
          pnpm --filter @easymo/commons build
          pnpm --filter @easymo/ui build
          
      - name: Build for Cloudflare Pages
        run: |
          cd admin-app
          pnpm run pages:build
          
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy admin-app/.vercel/output/static --project-name=easymo-admin-production
```

## PWA Features Included

✅ **Web App Manifest**: `/manifest.webmanifest`
- App name: "easyMO / Kwigira Admin"
- Icons: 192px, 512px, maskable 512px
- Theme color: `#2563eb`
- Background color: `#0f172a`
- Display mode: standalone
- Shortcuts and screenshots configured

✅ **Service Worker**: `/sw.js`
- Automatically registered via `AppProviders`
- Offline fallback page: `/offline.html`
- Cache strategies for assets

✅ **PWA Metadata**
- Manifest linked in HTML head
- Theme color meta tags
- Apple touch icons (if needed)

## Custom Domain Configuration

1. **In Cloudflare Pages Dashboard**:
   - Go to your Pages project → Custom domains
   - Click "Set up a custom domain"
   - Enter: `admin.easymo.com` (or your domain)
   - Cloudflare will automatically configure DNS

2. **Verify DNS**:
   ```bash
   dig admin.easymo.com
   ```

3. **SSL/TLS**: Automatic via Cloudflare (Full or Full Strict mode)

## Testing the Deployment

### Local Preview (Cloudflare Pages Runtime)

```bash
cd admin-app
npm run preview
# Opens on http://localhost:8788
```

### PWA Testing

1. **Lighthouse Audit**:
   - Open DevTools → Lighthouse
   - Run PWA audit
   - Should score 100% with all checks passing

2. **Install Prompt**:
   - Visit deployed URL in Chrome/Edge
   - Look for "Install" button in address bar
   - Test offline functionality

3. **Service Worker**:
   - DevTools → Application → Service Workers
   - Verify registration
   - Test "Update on reload"

## Troubleshooting

### Build Fails with PostCSS Error

**Issue**: `Error: A PostCSS Plugin was passed as a function`

**Solution**: Ensure `postcss.config.cjs` uses string plugin names:
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### API Routes Not Working

**Issue**: 500 errors on API routes

**Solution**: Add Edge Runtime export to all API routes:
```typescript
export const runtime = 'edge';
```

### Environment Variables Not Available

**Issue**: `undefined` for env vars

**Solution**: 
1. Verify vars are set in Cloudflare Dashboard
2. Redeploy after adding variables
3. Check variable names match exactly (case-sensitive)

### Service Worker Not Updating

**Issue**: Old service worker cached

**Solution**:
1. Update `sw.js` version number
2. Clear browser cache
3. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

## Post-Deployment Checklist

- [ ] Verify environment variables set correctly
- [ ] Test login functionality
- [ ] Verify API routes respond correctly
- [ ] Test PWA install prompt
- [ ] Verify offline fallback works
- [ ] Check Lighthouse PWA score (should be 100%)
- [ ] Test on mobile device
- [ ] Verify custom domain SSL certificate
- [ ] Monitor Cloudflare Pages analytics
- [ ] Set up error tracking (Sentry recommended)

## Monitoring & Logs

### View Deployment Logs
- Cloudflare Dashboard → Pages → Project → Deployments
- Click on specific deployment for logs

### Real-time Logs via Wrangler
```bash
wrangler pages deployment tail --project-name=easymo-admin-production
```

### Analytics
- Cloudflare Dashboard → Analytics → Web Analytics
- Enable for your Pages domain

## Rollback

If deployment issues occur:

1. **Via Dashboard**:
   - Go to Deployments
   - Find working deployment
   - Click "···" → "Rollback to this deployment"

2. **Via Git**:
   ```bash
   git revert HEAD
   git push
   ```

## Performance Optimization

Current build output:
- **First Load JS**: ~87.4 kB (shared)
- **Total Bundle**: ~163 KB gzipped
- **Build Time**: ~5 seconds

### Optimization Tips:
1. Use Cloudflare's image optimization
2. Enable Cloudflare's Zaraz for analytics
3. Use Early Hints for critical assets
4. Monitor Core Web Vitals in Cloudflare Analytics

## Support & Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [@cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages)
- [Next.js Edge Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
