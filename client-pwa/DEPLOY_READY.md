# 🚀 CLIENT PWA - DEPLOYMENT GUIDE

## ✅ **ALL FEATURES IMPLEMENTED - READY TO DEPLOY**

### Quick Status Check
Run this command to verify all features are present:
```bash
cd client-pwa
./verify-pwa.sh
```

---

## 📋 **PRE-DEPLOYMENT CHECKLIST**

### 1. Environment Variables
Create `.env.local` with:
```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Optional (for push notifications)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxG...

# Optional (for payments)
NEXT_PUBLIC_MOMO_MERCHANT_CODE=EASYMO
```

### 2. Dependencies
```bash
cd client-pwa
pnpm install
```

### 3. Build Test
```bash
pnpm build
```

Expected output:
- ✓ TypeScript compilation success
- ✓ Bundle size < 200KB gzipped
- ✓ No critical warnings
- ✓ Service worker generated

---

## 🌐 **DEPLOYMENT OPTIONS**

### Option 1: Netlify (Recommended)
```bash
# One-time setup
npm install -g netlify-cli
netlify login

# Deploy
cd client-pwa
pnpm build
netlify deploy --prod
```

Netlify auto-detects Next.js and configures:
- ✅ Server-side rendering
- ✅ API routes
- ✅ Image optimization
- ✅ Cache headers
- ✅ Redirects

### Option 2: Vercel
```bash
npm install -g vercel
cd client-pwa
vercel --prod
```

### Option 3: Self-Hosted
```bash
# Build
cd client-pwa
pnpm build

# Start production server
pnpm start

# Or use PM2
pm2 start npm --name "client-pwa" -- start
```

---

## 🔧 **NETLIFY CONFIGURATION**

The `netlify.toml` is already configured with:

```toml
[build]
  command = "pnpm build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"
  PNPM_VERSION = "10.18.3"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"

# Service worker caching
[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

# PWA manifest
[[headers]]
  for = "/manifest.json"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
    Content-Type = "application/manifest+json"
```

---

## 🔐 **ENVIRONMENT SETUP**

### Netlify Environment Variables
```bash
# Via Netlify UI
Site settings → Environment variables → Add:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

### Or via CLI
```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://..."
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "eyJ..."
```

---

## 🎯 **POST-DEPLOYMENT VERIFICATION**

### 1. PWA Installation
- [ ] Visit site on mobile
- [ ] See "Install App" prompt
- [ ] Install to home screen
- [ ] App opens in standalone mode

### 2. Offline Mode
- [ ] Enable airplane mode
- [ ] Open PWA
- [ ] Browse menu (should work)
- [ ] Add items to cart
- [ ] Disable airplane mode
- [ ] Complete order (should sync)

### 3. Features Testing
- [ ] Scan QR code (camera permission)
- [ ] Voice order (mic permission)
- [ ] Real-time tracking (WebSocket)
- [ ] Push notification (notification permission)
- [ ] Haptic feedback (vibration)
- [ ] Pull to refresh
- [ ] Swipe back navigation
- [ ] Payment flow (MoMo/Revolut)

### 4. Performance
Run Lighthouse audit:
```bash
lighthouse https://your-pwa-url.netlify.app --view
```

Expected scores:
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100
- PWA: 100 ✅

---

## 📱 **MOBILE TESTING**

### iOS Safari
1. Open site
2. Tap Share button
3. Tap "Add to Home Screen"
4. Open from home screen
5. Test all features

### Android Chrome
1. Open site
2. See "Install app" banner
3. Tap "Install"
4. Open from app drawer
5. Test all features

### Desktop Chrome
1. Open site
2. See install icon in address bar
3. Click to install
4. Opens in app window
5. Test keyboard shortcuts

---

## 🐛 **TROUBLESHOOTING**

### Service Worker Not Updating
```bash
# Clear cache
Application → Storage → Clear storage

# Or programmatically
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister())
})
```

### Push Notifications Not Working
1. Check VAPID keys configured
2. Verify notification permission granted
3. Test in browser that supports Push API
4. Check service worker registration

### Voice Order Not Working
1. Requires HTTPS (or localhost)
2. Check microphone permission
3. Test in supported browser (Chrome, Edge)
4. Verify Web Speech API support

### Haptics Not Working
1. Check device supports vibration
2. Verify not in silent mode (iOS)
3. Test in HTTPS context
4. Try different haptic patterns

---

## 📊 **MONITORING**

### Recommended Tools
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Google Analytics** - User analytics
- **Lighthouse CI** - Performance monitoring

### Setup Sentry (Optional)
```bash
pnpm add @sentry/nextjs

# Configure in next.config.js
```

---

## 🔄 **CONTINUOUS DEPLOYMENT**

### Auto-deploy on Git Push
```bash
# Connect repo to Netlify
netlify init

# Push triggers deploy
git add .
git commit -m "feat: deploy PWA"
git push origin main
```

### GitHub Actions (Alternative)
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy PWA
on:
  push:
    branches: [main]
    paths:
      - 'client-pwa/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: cd client-pwa && pnpm install
      - run: cd client-pwa && pnpm build
      - run: netlify deploy --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_TOKEN }}
```

---

## 🎉 **SUCCESS CRITERIA**

Your PWA is successfully deployed when:
- ✅ Lighthouse PWA score = 100
- ✅ Installs on all platforms
- ✅ Works offline
- ✅ Service worker caching works
- ✅ Push notifications work
- ✅ Voice ordering works
- ✅ Real-time tracking works
- ✅ Payment flows work
- ✅ Haptics/gestures work
- ✅ No console errors

---

## 📞 **SUPPORT**

If deployment issues:
1. Check build logs: `netlify open --site`
2. Review environment variables
3. Test locally: `pnpm build && pnpm start`
4. Check browser console for errors
5. Review Netlify function logs

---

## 🚀 **DEPLOY NOW**

One command deploy:
```bash
cd client-pwa && pnpm build && netlify deploy --prod
```

Or use the helper script:
```bash
cd client-pwa
./deploy-now.sh  # If exists
```

**That's it! Your world-class PWA is live!** 🎊
