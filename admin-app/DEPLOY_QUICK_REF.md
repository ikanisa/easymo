# Quick Deployment Reference - EasyMO Admin PWA

## 🚀 Quick Deploy Commands

### Option 1: Using Deploy Script (Easiest)
```bash
cd admin-app
./deploy-cloudflare.sh production
```

### Option 2: Manual Steps
```bash
# From monorepo root
pnpm install --frozen-lockfile
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build  
pnpm --filter @easymo/ui build

# Build and deploy
cd admin-app
npm run pages:build
wrangler pages deploy .vercel/output/static --project-name=easymo-admin-production
```

### Option 3: Preview/Test Deployment
```bash
cd admin-app
npm run preview
# Visit http://localhost:8788
```

## 📋 Pre-Deployment Checklist

- [ ] Wrangler CLI installed (`npm i -g wrangler`)
- [ ] Logged in to Cloudflare (`wrangler login`)
- [ ] Environment variables set in Cloudflare Dashboard
- [ ] Shared packages built (`@va/shared`, `@easymo/commons`, `@easymo/ui`)
- [ ] PostCSS config uses string plugin names
- [ ] Service worker (`sw.js`) is in `public/`
- [ ] Manifest (`manifest.webmanifest`) is in `public/`
- [ ] PWA icons (192px, 512px) are in `public/icons/`

## 🔑 Required Environment Variables

Set these in Cloudflare Pages Dashboard:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (secret)
EASYMO_ADMIN_TOKEN (secret)
ADMIN_SESSION_SECRET (secret)
```

## 🔧 Troubleshooting Quick Fixes

### PostCSS Build Error
```bash
# Edit admin-app/postcss.config.cjs to use string plugin names
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### Clear Build Cache
```bash
cd admin-app
rm -rf .next .vercel
npm run pages:build
```

### Test Local Build
```bash
cd admin-app
npm run build
npm run start
# Visit http://localhost:3000
```

## 📊 Verify Deployment

1. **Check PWA Manifest**: `https://your-domain.pages.dev/manifest.webmanifest`
2. **Check Service Worker**: `https://your-domain.pages.dev/sw.js`
3. **Lighthouse PWA Score**: Should be 100%
4. **Install Prompt**: Should appear in Chrome/Edge address bar

## 🎯 Build Output Locations

- **Next.js Build**: `admin-app/.next/`
- **Cloudflare Build**: `admin-app/.vercel/output/static/`
- **PWA Assets**: 
  - `manifest.webmanifest`
  - `sw.js`
  - `offline.html`
  - `icons/` (192x192, 512x512)

## 📱 PWA Features Included

✅ Installable as standalone app
✅ Offline fallback page
✅ App shortcuts configured
✅ Maskable icons for Android
✅ Screenshots for install dialog
✅ Service worker with caching strategies

## 🌐 Deployment URLs

- **Production**: `https://easymo-admin-production.pages.dev`
- **Preview**: `https://easymo-admin-preview.pages.dev`
- **Custom Domain**: Set in Cloudflare Pages dashboard

## 📚 Documentation

- Full Guide: `CLOUDFLARE_DEPLOYMENT.md`
- Deploy Script: `deploy-cloudflare.sh`
- GitHub Actions: `.github/workflows/cloudflare-pages.yml`
- Wrangler Config: `wrangler.toml`
