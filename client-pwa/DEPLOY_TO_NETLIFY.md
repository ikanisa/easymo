# 🚀 Deploy EasyMO Client PWA to Netlify

## Prerequisites

- ✅ Netlify account (free tier works)
- ✅ GitHub repository access
- ✅ Supabase project configured
- ✅ Environment variables ready

## 🎯 Quick Deploy (Recommended)

### Option 1: Deploy via Netlify UI

1. **Connect Repository**
   ```bash
   # Push to GitHub if not already done
   git push origin main
   ```

2. **Import to Netlify**
   - Go to [app.netlify.com](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub → Select `easymo-` repository
   - Configure build settings:
     - **Base directory**: `client-pwa`
     - **Build command**: `pnpm install --frozen-lockfile && pnpm build`
     - **Publish directory**: `.next`
     - **Node version**: `20`

3. **Add Environment Variables**
   - Go to Site settings → Environment variables
   - Add these variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     NEXT_PUBLIC_SITE_URL=https://your-site.netlify.app
     ```

4. **Deploy**
   - Click "Deploy site"
   - Wait 2-3 minutes for build to complete

### Option 2: Deploy via Netlify CLI

```bash
# 1. Install Netlify CLI globally
npm install -g netlify-cli

# 2. Login to Netlify
netlify login

# 3. Initialize Netlify site (first time only)
cd client-pwa
netlify init

# 4. Set environment variables
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://lhbowpbcpwoiparwnwgt.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
netlify env:set NEXT_PUBLIC_SITE_URL "https://your-site.netlify.app"

# 5. Deploy to production
netlify deploy --prod
```

## 📋 Build Configuration

The `netlify.toml` file is already configured with optimal settings:

```toml
[build]
  command = "pnpm install --frozen-lockfile && pnpm build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"
  PNPM_VERSION = "10.18.3"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

## 🔐 Environment Variables

Required environment variables for production:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm93cGJjcHdvaXBhcnduZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1OTA1NzEsImV4cCI6MjA0NzE2NjU3MX0.3zgWc2vYOovN2j6YwUF2N4TqQNz0l_NLc0uUAGmjdSc

# Site Configuration
NEXT_PUBLIC_SITE_URL=https://your-custom-domain.com
```

**⚠️ SECURITY NOTE**: These are public keys (NEXT_PUBLIC_*) and safe to expose. Never add service role keys or admin tokens here!

## 🎨 Custom Domain Setup

1. **Add Custom Domain**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter your domain (e.g., `order.easymo.app`)

2. **Configure DNS**
   - Add CNAME record in your DNS provider:
     ```
     order.easymo.app CNAME your-site.netlify.app
     ```

3. **Enable HTTPS**
   - Netlify automatically provisions SSL certificate
   - Wait 1-2 minutes for DNS propagation

## ✅ Post-Deployment Checklist

### 1. Test PWA Installation
- [ ] Open site on mobile browser
- [ ] Check for "Add to Home Screen" prompt
- [ ] Install PWA and verify icon appears on home screen
- [ ] Test offline functionality (service worker)

### 2. Test Core Features
- [ ] QR Code scanner works
- [ ] Menu browsing is smooth (60fps)
- [ ] Cart adds/removes items correctly
- [ ] Order placement succeeds
- [ ] MoMo payment flow works
- [ ] Revolut payment flow works
- [ ] Order status updates in real-time

### 3. Performance Checks
```bash
# Run Lighthouse audit
npm install -g lighthouse
lighthouse https://your-site.netlify.app --view

# Target scores:
# Performance: 95+
# PWA: 100
# Accessibility: 95+
# Best Practices: 95+
```

### 4. Mobile Testing
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Verify notch/safe area handling
- [ ] Test touch gestures (swipe, pinch)
- [ ] Verify haptic feedback
- [ ] Check dark mode

## 🐛 Troubleshooting

### Build Fails with "Module not found"
```bash
# Clear Netlify cache and rebuild
netlify build --clear-cache
```

### Service Worker Not Updating
```bash
# Force update manifest version
# Edit app/manifest.ts and increment version in name
```

### Environment Variables Not Working
```bash
# Verify variables in Netlify UI
netlify env:list

# If missing, set them again
netlify env:set VARIABLE_NAME "value"

# Redeploy
netlify deploy --prod
```

### PWA Not Installable
- Ensure HTTPS is enabled (Netlify does this automatically)
- Check manifest.json is accessible at `/manifest.json`
- Verify service worker is registered (check Console)
- Must be visited at least once before install prompt

## 📊 Monitoring

### Netlify Analytics
- Go to Site → Analytics to view:
  - Unique visitors
  - Page views
  - Bandwidth usage
  - Build times

### Real User Monitoring
The PWA includes Supabase observability:
- Check `app_events` table for user actions
- Monitor `order_events` for order flow
- Track `payment_events` for transactions

## 🔄 Continuous Deployment

Every push to `main` branch automatically triggers:

1. **Build** → Install deps → Type check → Build Next.js
2. **Deploy** → Upload to Netlify CDN
3. **Publish** → Site goes live (atomic deployment)

To disable auto-deploy:
- Go to Site settings → Build & deploy
- Under "Build settings", click "Edit settings"
- Set "Branch deploys" to "None"

## 📱 PWA Update Strategy

When you deploy a new version:

1. Service worker detects new version
2. Downloads new assets in background
3. Shows "Update available" notification to user
4. User refreshes → New version loads

**Force update immediately:**
```javascript
// In PWA install prompt component
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.update());
  });
}
```

## 🎯 Production URLs

After deployment, your PWA will be available at:

- **Netlify URL**: `https://easymo-client.netlify.app`
- **Custom Domain**: `https://order.easymo.app` (if configured)

## 🔗 Useful Links

- [Netlify Dashboard](https://app.netlify.com)
- [Netlify CLI Docs](https://docs.netlify.com/cli/get-started/)
- [Next.js on Netlify](https://docs.netlify.com/frameworks/next-js/overview/)
- [PWA Best Practices](https://web.dev/pwa-checklist/)

## 🆘 Support

If you encounter issues:

1. Check Netlify build logs: Site → Deploys → [Latest deploy] → Build log
2. Check browser console for errors
3. Verify environment variables are set correctly
4. Test locally first: `pnpm dev`

---

**Ready to deploy?** Follow Option 1 or 2 above! 🚀
