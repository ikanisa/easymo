# 🚀 Manual Deployment Guide - Client PWA

## Status: ✅ **READY TO DEPLOY**

The Client PWA is fully built and configured. Follow these steps to deploy:

---

## Pre-Deployment Checklist

✅ All components built and tested
✅ Environment variables configured (`.env.local`)
✅ Netlify configuration ready (`netlify.toml`)
✅ PWA manifest and service worker configured
✅ Next.js 15 + React 19 ready
✅ Supabase integration configured

---

## Quick Deploy (3 Commands)

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# 1. Install dependencies (if not done)
pnpm install --frozen-lockfile

# 2. Build the project
pnpm build

# 3. Deploy to Netlify
netlify deploy --prod --dir=.next
```

---

## Detailed Step-by-Step

### Step 1: Navigate to Project

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
```

### Step 2: Install Dependencies

```bash
pnpm install --frozen-lockfile
```

**Expected:** ~60 seconds, installs all packages

### Step 3: Run Type Check (Optional but Recommended)

```bash
pnpm type-check
```

**Expected:** Should pass with no errors

### Step 4: Build Project

```bash
pnpm build
```

**Expected:** 
- Build time: ~2-3 minutes
- Output: `.next` directory
- Size: ~50-100 MB (uncompressed)
- Gzipped: <200 KB

### Step 5: Test Build Locally (Optional)

```bash
pnpm start
```

Then visit: `http://localhost:3002`

**Test:**
- Page loads
- PWA manifest available
- Service worker registers
- UI renders correctly

### Step 6: Authenticate with Netlify

```bash
netlify login
```

This will open a browser to authenticate. If already logged in, skip this.

### Step 7: Link to Netlify Site (First Time Only)

```bash
netlify link
```

**Options:**
1. Use existing site
2. Create new site
3. Choose from your sites

**Recommended:** Create new site named `easymo-client-pwa` or similar

### Step 8: Deploy to Production

```bash
netlify deploy --prod --dir=.next
```

**What happens:**
1. Uploads `.next` directory
2. Netlify processes Next.js app
3. Returns deployment URL
4. Site goes live

**Expected output:**
```
✔ Finished hashing 150 files
✔ CDN requesting 120 files
✔ Finished uploading 120 assets
✔ Deploy is live!

Logs:              https://app.netlify.com/sites/YOUR-SITE/deploys/DEPLOY-ID
Unique Deploy URL: https://DEPLOY-ID--YOUR-SITE.netlify.app
Live URL:          https://YOUR-SITE.netlify.app
```

---

## Post-Deployment

### 1. Update Environment Variable

Go to Netlify Dashboard:
- **Site Settings** → **Environment Variables**
- Add/Update: `NEXT_PUBLIC_SITE_URL=https://YOUR-SITE.netlify.app`
- **Redeploy** for changes to take effect

```bash
netlify deploy --prod --dir=.next
```

### 2. Test on Mobile

1. **Open URL** on your phone browser
2. **Add to Home Screen:**
   - iOS: Safari → Share → Add to Home Screen
   - Android: Chrome → Menu → Add to Home Screen
3. **Launch PWA** from home screen
4. **Test features:**
   - QR code scanning
   - Menu browsing
   - Add to cart
   - Checkout flow

### 3. Run Lighthouse Audit

**Desktop:**
1. Open site in Chrome
2. DevTools (F12) → Lighthouse tab
3. Select: Performance, PWA, Accessibility
4. Click "Analyze page load"

**Targets:**
- ✅ Performance: 95+
- ✅ PWA: 100
- ✅ Accessibility: 90+
- ✅ Best Practices: 95+

### 4. Verify PWA Installation

Check these work:
- ✅ Manifest loads: `/manifest.json`
- ✅ Service worker active: DevTools → Application → Service Workers
- ✅ Offline mode: DevTools → Network → Offline → Refresh
- ✅ Icons: Check all sizes present
- ✅ Splash screens: iOS device

---

## Troubleshooting

### Build Fails

**Error:** `Module not found`
**Fix:** 
```bash
rm -rf node_modules .next
pnpm install --frozen-lockfile
pnpm build
```

### Deployment Fails

**Error:** `Command not found: netlify`
**Fix:**
```bash
npm install -g netlify-cli
netlify login
```

### Site Not Loading

**Issue:** Blank page or 404
**Check:**
1. Netlify build logs for errors
2. Browser console for errors
3. Verify `.next` directory exists
4. Check `netlify.toml` configuration

### PWA Not Installing

**Issue:** "Add to Home Screen" not showing
**Check:**
1. Site must be HTTPS (Netlify provides this)
2. Manifest file accessible: `https://YOUR-SITE.netlify.app/manifest.json`
3. Service worker registered: Check DevTools → Application
4. All required icons present in `/public/icons/`

### Images Not Loading

**Issue:** Broken image links
**Fix:**
Update `next.config.ts`:
```typescript
images: {
  domains: [
    'lhbowpbcpwoiparwnwgt.supabase.co', // Your Supabase project
  ],
}
```

---

## Configuration Files

### Netlify Configuration (`netlify.toml`)

Already configured with:
- ✅ Next.js plugin
- ✅ PWA headers (manifest, service worker)
- ✅ Cache headers for static assets
- ✅ SPA fallback routing

### Environment Variables

**Local (`.env.local`):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://db.lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SITE_URL=http://localhost:3002
```

**Production (Netlify Dashboard):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://db.lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SITE_URL=https://YOUR-SITE.netlify.app
```

---

## Performance Optimization

### Already Implemented

✅ **Code Splitting:** Automatic via Next.js
✅ **Image Optimization:** Next.js Image component
✅ **Font Optimization:** next/font
✅ **Lazy Loading:** React.lazy + Suspense
✅ **Service Worker:** Caches static assets
✅ **Compression:** Gzip + Brotli via Netlify
✅ **CDN:** Netlify Edge Network

### Expected Metrics

- **First Contentful Paint:** <1.5s
- **Largest Contentful Paint:** <2.5s
- **Time to Interactive:** <3.0s
- **Total Bundle Size:** <200 KB gzipped
- **Lighthouse Score:** 95+

---

## What's Deployed

### Routes

- `/` - Landing/QR scanner
- `/scan` - QR code scanner page
- `/[venueSlug]` - Venue menu (dynamic)
- `/[venueSlug]/cart` - Shopping cart
- `/[venueSlug]/checkout` - Checkout flow
- `/[venueSlug]/order/[orderId]` - Order tracking

### Features

✅ **PWA:** Installable, offline-ready
✅ **Dark Mode:** Default theme
✅ **Touch-Optimized:** Native mobile feel
✅ **Animations:** Framer Motion
✅ **State Management:** Zustand with persistence
✅ **API:** Supabase integration
✅ **Real-time:** Order status updates
✅ **Payments:** MoMo USSD + Revolut Link

### Components

- 🎨 **UI:** Button, Card, Sheet, Toast, Badge
- 🍽️ **Menu:** MenuItemCard, CategoryTabs, SearchBar
- 🛒 **Cart:** CartSheet, QuantitySelector
- 📦 **Order:** OrderStatus, OrderProgress
- 💳 **Payment:** PaymentSelector, MoMo, Revolut
- 🏪 **Venue:** VenueHeader, QRScanner

---

## Next Steps After Deployment

1. **Push to Git:**
   ```bash
   git add .
   git commit -m "feat(client-pwa): production deployment ready"
   git push origin main
   ```

2. **Set up Continuous Deployment:**
   - Netlify auto-deploys on git push
   - Configure in: Netlify Dashboard → Build & Deploy
   - Branch: `main`
   - Build command: `pnpm build`
   - Publish directory: `.next`

3. **Monitor:**
   - Netlify Analytics
   - Error logs in Netlify Dashboard
   - User feedback

4. **Iterate:**
   - Add more features
   - Optimize performance
   - Fix bugs

---

## Support

### Documentation
- Next.js: https://nextjs.org/docs
- Netlify: https://docs.netlify.com
- Supabase: https://supabase.com/docs

### Helpful Commands

```bash
# Check Netlify status
netlify status

# View site info
netlify sites:list

# Open dashboard
netlify open

# View deploy logs
netlify logs

# Rollback deployment
netlify rollback
```

---

## 🎉 You're Ready!

Run these three commands to go live:

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
pnpm build
netlify deploy --prod --dir=.next
```

**Expected deployment time:** 3-5 minutes

Good luck! 🚀
