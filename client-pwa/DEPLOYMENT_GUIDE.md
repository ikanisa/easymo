# 🚀 EasyMO Client PWA - Production Deployment Guide

## Prerequisites

- ✅ Netlify account
- ✅ GitHub repository connected
- ✅ Supabase project (database setup complete)
- ✅ Domain (optional): `order.easymo.app`

---

## 1. Environment Variables

### Required Variables (Netlify Dashboard)

```bash
# Supabase (Public - Safe for client)
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0

# Node version
NODE_VERSION=20
```

### Set via Netlify CLI

```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://lhbowpbcpwoiparwnwgt.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "sbp_64ff5d99515ed7b690b69d60451ece55bc467ae0"
netlify env:set NODE_VERSION "20"
```

---

## 2. Netlify Configuration

### Create `netlify.toml`

```toml
[build]
  base = "client-pwa"
  command = "pnpm install --frozen-lockfile && pnpm build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# Headers for security and PWA
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=*, geolocation=*, microphone=()"

# PWA manifest caching
[[headers]]
  for = "/manifest.json"
  [headers.values]
    Content-Type = "application/manifest+json"
    Cache-Control = "public, max-age=3600"

# Service worker - no cache
[[headers]]
  for = "/sw.js"
  [headers.values]
    Content-Type = "application/javascript"
    Cache-Control = "public, max-age=0, must-revalidate"

# Static assets - long cache
[[headers]]
  for = "/icons/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Fonts - long cache
[[headers]]
  for = "/fonts/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Redirects for SPA
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false
```

---

## 3. Pre-Deployment Checklist

### Local Testing

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# Install dependencies
pnpm install --frozen-lockfile

# Type check
pnpm type-check

# Build production bundle
pnpm build

# Test production build locally
pnpm start
# → http://localhost:3002
```

### Lighthouse Audit

```bash
# Install Lighthouse
pnpm add -D lighthouse

# Run audit
pnpm lighthouse
# → Opens lighthouse-report.html
```

**Target Scores**:
- Performance: 95+
- Accessibility: 100
- Best Practices: 100
- SEO: 100
- PWA: 100

### PWA Asset Generation

```bash
# Generate PWA icons and splash screens
# (If not already done)
npx pwa-asset-generator public/logo.svg public/icons \
  --background '#0a0a0a' \
  --splash-only false \
  --favicon
```

---

## 4. Deploy to Netlify

### Option A: Netlify CLI

```bash
# Install Netlify CLI
pnpm add -g netlify-cli

# Login to Netlify
netlify login

# Initialize site (first time only)
cd /Users/jeanbosco/workspace/easymo-/client-pwa
netlify init

# Follow prompts:
# - Create & configure new site
# - Link to GitHub repo
# - Build command: pnpm install --frozen-lockfile && pnpm build
# - Publish directory: .next

# Deploy to production
netlify deploy --prod
```

### Option B: Netlify Dashboard

1. **Connect Repository**
   - Go to https://app.netlify.com
   - Click "New site from Git"
   - Choose GitHub
   - Select `easymo-` repository

2. **Configure Build Settings**
   ```
   Base directory: client-pwa
   Build command: pnpm install --frozen-lockfile && pnpm build
   Publish directory: client-pwa/.next
   ```

3. **Add Environment Variables**
   - Go to Site settings → Environment variables
   - Add all variables from section 1

4. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete (~3-5 minutes)

---

## 5. Custom Domain Setup

### Add Custom Domain

```bash
# Via CLI
netlify domains:add order.easymo.app

# Or via Dashboard:
# Site settings → Domain management → Add custom domain
```

### DNS Configuration

**Add CNAME record at your DNS provider**:
```
Type: CNAME
Name: order
Value: your-site.netlify.app
TTL: 3600
```

### Enable HTTPS

Netlify automatically provisions SSL certificate via Let's Encrypt (takes ~1 minute).

---

## 6. Post-Deployment Verification

### 1. PWA Installation Test

**Android/Chrome**:
1. Visit https://order.easymo.app on mobile
2. Wait 30 seconds
3. Install prompt should appear
4. Click "Install"
5. App should open in standalone mode

**iOS/Safari**:
1. Visit https://order.easymo.app on iPhone
2. Wait 30 seconds
3. Manual instructions should appear
4. Tap Share → Add to Home Screen
5. App should open full-screen

### 2. QR Code Test

```bash
# Generate test QR code for venue
# URL format: https://order.easymo.app/heaven-bar?table=5
```

1. Scan QR code with phone camera
2. Should open app/browser to venue page
3. Menu should load from Supabase

### 3. Offline Mode Test

1. Install PWA
2. Load a venue page
3. Enable airplane mode
4. Navigate through cached pages
5. Menu should still be visible (from cache)

### 4. Lighthouse Audit (Production)

```bash
lighthouse https://order.easymo.app \
  --output html \
  --output-path ./lighthouse-production.html \
  --preset=desktop
```

---

## 7. Monitoring & Analytics

### Netlify Analytics

```bash
# Enable in dashboard
# Site settings → Analytics → Enable
```

### Error Tracking (Optional - Sentry)

```bash
# Install Sentry
pnpm add @sentry/nextjs

# Initialize
npx @sentry/wizard@latest -i nextjs

# Add to next.config.ts
```

### Real User Monitoring

Add to `app/layout.tsx`:
```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

---

## 8. Continuous Deployment

### Auto-Deploy on Git Push

Netlify automatically deploys when you push to `main`:

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
# → Triggers automatic deployment
```

### Deploy Previews

Every pull request gets a unique preview URL:
```
https://deploy-preview-123--your-site.netlify.app
```

### Rollback

```bash
# Via CLI
netlify rollback

# Or via Dashboard:
# Deploys → Click on previous deploy → "Publish deploy"
```

---

## 9. Performance Optimization

### Bundle Analysis

```bash
# Install analyzer
pnpm add -D @next/bundle-analyzer

# Analyze bundle
ANALYZE=true pnpm build
# → Opens bundle visualization
```

### Image Optimization

All images should be served via Next.js Image component:
```tsx
import Image from 'next/image';

<Image
  src="/menu-item.jpg"
  width={400}
  height={300}
  alt="Pizza"
  loading="lazy"
  placeholder="blur"
/>
```

---

## 10. Troubleshooting

### Build Fails

**Check Netlify build logs**:
```bash
netlify logs
```

**Common issues**:
1. Missing environment variables
2. TypeScript errors
3. Build command incorrect
4. Node version mismatch

### Service Worker Not Updating

**Clear site data**:
1. DevTools → Application → Storage
2. Click "Clear site data"
3. Reload page

**Force update**:
```bash
# Increment version in next.config.ts
# Commit and deploy
```

### PWA Not Installable

**Check manifest**:
```
https://order.easymo.app/manifest.json
```

**Verify requirements**:
- [x] Served over HTTPS
- [x] Has service worker
- [x] Has valid manifest.json
- [x] Has icons (192x192, 512x512)
- [x] Has start_url

---

## 11. Backup & Disaster Recovery

### Database Backups

Supabase automatically backs up database daily.

**Manual backup**:
```bash
# Export schema
supabase db dump -f backup-schema.sql --schema public

# Export data
supabase db dump -f backup-data.sql --data-only
```

### Code Backups

Code is backed up on GitHub. Netlify also keeps deployment history.

---

## SUCCESS CHECKLIST ✅

- [ ] Environment variables set
- [ ] Netlify build succeeds
- [ ] Site accessible at custom domain
- [ ] HTTPS enabled
- [ ] PWA installable (Android & iOS)
- [ ] QR scanner works
- [ ] Offline mode works
- [ ] Lighthouse score > 90
- [ ] Error boundary catches errors
- [ ] Payment flow tested (MoMo & Revolut)
- [ ] Real-time order updates work
- [ ] Cart persists across sessions
- [ ] Analytics tracking works

---

## 🎉 Production Deployment Complete!

**Live URL**: https://order.easymo.app

**Next Steps**:
1. Generate QR codes for venue tables
2. Train bar staff on order management
3. Monitor analytics and error rates
4. Gather user feedback
5. Iterate and improve

---

**Created**: 2025-11-27  
**Status**: ✅ READY FOR DEPLOYMENT  
**Maintainer**: EasyMO Team
