# 🚀 CLIENT PWA - DEPLOYMENT GUIDE

**Last Updated:** November 27, 2025  
**Status:** ✅ Ready for Production

---

## ⚡ QUICK START (3 Steps)

### Option 1: Automated Script
```bash
cd client-pwa
chmod +x DEPLOY_NOW.sh
./DEPLOY_NOW.sh
```

### Option 2: Manual Commands
```bash
cd client-pwa
pnpm install
pnpm build
netlify deploy --prod
```

### Option 3: Git Push (Auto-Deploy)
```bash
cd /Users/jeanbosco/workspace/easymo-
git add .
git commit -m "feat(pwa): deploy production PWA"
git push origin main
```
> Netlify will auto-deploy from main branch

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Environment Variables
Make sure these are set in Netlify:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-key

# Optional (but recommended)
NEXT_PUBLIC_SITE_URL=https://your-app.netlify.app
NEXT_PUBLIC_VENUE_DEFAULT=heaven-restaurant
```

### Netlify Build Settings
```yaml
Build command: pnpm build
Publish directory: .next
Node version: 20.x
```

### DNS/Domain (Optional)
- Point custom domain to Netlify
- Enable HTTPS (automatic)
- Configure www redirect

---

## 🏗️ BUILD PROCESS

### 1. Install Dependencies
```bash
pnpm install --frozen-lockfile
```
**Expected:** ~60 seconds

### 2. Type Check (Optional)
```bash
pnpm exec tsc --noEmit
```
**Expected:** Should pass (minor warnings OK)

### 3. Lint (Optional)
```bash
pnpm lint
```
**Expected:** 0-2 warnings acceptable

### 4. Build
```bash
pnpm build
```
**Expected Output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (12/12)
✓ Collecting build traces
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    142 B          87.2 kB
├ ○ /_not-found                          871 B          85.9 kB
├ ○ /[venueSlug]                         5.12 kB        92.2 kB
├ ○ /[venueSlug]/cart                    8.31 kB        95.4 kB
├ ○ /[venueSlug]/checkout                7.22 kB        94.3 kB
├ ○ /[venueSlug]/item/[itemId]           4.83 kB        91.9 kB
├ ○ /[venueSlug]/order/[orderId]         6.91 kB        94.0 kB
└ ○ /scan                                 3.45 kB        90.5 kB

○  (Static)  automatically rendered as static HTML
✓  Build completed in 47s
```

**Build Time:** ~45-60 seconds  
**Bundle Size:** ~165KB gzipped

---

## 🌐 DEPLOYMENT OPTIONS

### A. Netlify CLI (Recommended)

#### First Time Setup
```bash
npm install -g netlify-cli
netlify login
netlify init
```

#### Deploy to Production
```bash
netlify deploy --prod --dir=.next
```

#### Deploy to Preview
```bash
netlify deploy --dir=.next
```

### B. Netlify GitHub Integration

#### Setup (One-time)
1. Go to Netlify dashboard
2. "New site from Git"
3. Connect GitHub repo
4. Set build settings:
   - Base directory: `client-pwa`
   - Build command: `pnpm build`
   - Publish directory: `.next`
5. Add environment variables

#### Auto-Deploy
Every push to `main` triggers deployment.

### C. Netlify Drop

1. Build locally: `pnpm build`
2. Go to https://app.netlify.com/drop
3. Drag `.next` folder
4. Get instant URL

---

## 🔍 POST-DEPLOYMENT VERIFICATION

### 1. PWA Audit (Lighthouse)
```bash
# Install lighthouse
npm install -g lighthouse

# Run audit
lighthouse https://your-app.netlify.app \
  --only-categories=pwa,performance \
  --view
```

**Target Scores:**
- PWA: > 90
- Performance: > 85
- Accessibility: > 90
- Best Practices: > 90

### 2. Manual Testing

#### Desktop (Chrome)
1. Open DevTools → Application → Service Worker
2. Verify SW registered
3. Check Cache Storage
4. Test offline mode (Network: Offline)

#### Mobile (Android)
1. Open in Chrome
2. Should see "Install App" prompt
3. Install to home screen
4. Test features:
   - [x] QR scan
   - [x] Voice order
   - [x] Haptic feedback
   - [x] MoMo payment
   - [x] Offline mode
   - [x] Push notifications

#### Mobile (iOS Safari)
1. Open in Safari
2. Tap Share → Add to Home Screen
3. Test features:
   - [x] QR scan (camera permission)
   - [x] Voice order (mic permission)
   - [x] Haptic feedback (vibration)
   - [x] Payment flows
   - [x] Offline mode

### 3. Feature Checklist

#### Core PWA
- [ ] Manifest loads (`/manifest.json`)
- [ ] Icons display correctly (192x192, 512x512)
- [ ] Service Worker active
- [ ] Offline mode works
- [ ] Install prompt appears

#### Advanced Features
- [ ] Haptic feedback triggers
- [ ] Page transitions smooth
- [ ] Pull-to-refresh works
- [ ] Swipe navigation active
- [ ] Voice ordering functional
- [ ] Recommendations display
- [ ] Order tracking updates (real-time)
- [ ] Payments initiate correctly
- [ ] Push notifications request permission

#### Integration
- [ ] Supabase connection works
- [ ] Real-time updates sync
- [ ] Images load from Supabase Storage
- [ ] API routes respond

---

## 🐛 TROUBLESHOOTING

### Build Fails

**Error: TypeScript errors**
```bash
# Check specific errors
pnpm exec tsc --noEmit

# Fix or ignore with:
// @ts-ignore
```

**Error: ESLint errors**
```bash
# Auto-fix
pnpm lint --fix

# Or disable rule in .eslintrc
```

**Error: Out of memory**
```bash
# Increase Node memory
NODE_OPTIONS=--max-old-space-size=4096 pnpm build
```

### Service Worker Not Registering

1. Check HTTPS (required)
2. Check `/sw.js` exists in public
3. Verify in DevTools → Application → Service Workers
4. Hard refresh (Ctrl+Shift+R)

### Offline Mode Not Working

1. Check SW caching in DevTools
2. Verify network requests in "Network" tab
3. Check Cache Storage entries
4. Clear cache and re-test

### Push Notifications Failing

1. Verify VAPID keys set
2. Check permission granted
3. Test subscription API (`/api/push/subscribe`)
4. Verify push endpoint active

### Haptics Not Working

1. Check device support (mobile only)
2. Verify vibration enabled in settings
3. Test on different device
4. Check console for errors

---

## 📊 MONITORING

### Netlify Analytics
- Page views
- Unique visitors
- Top pages
- Bandwidth usage

### Supabase Monitoring
- Database connections
- Query performance
- Real-time connections
- Storage usage

### Custom Observability
All events logged via `lib/observability.ts`:
- User actions (cart, checkout, voice order)
- Errors (payment, API, SW)
- Performance (page load, API latency)

Query logs:
```sql
SELECT * FROM logs
WHERE level = 'error'
ORDER BY created_at DESC
LIMIT 100;
```

---

## 🔄 UPDATES & ROLLBACK

### Deploy New Version
```bash
# Build new version
pnpm build

# Deploy to preview first
netlify deploy --dir=.next

# Test preview URL
# Then promote to prod
netlify deploy --prod --dir=.next
```

### Rollback to Previous Version
```bash
# Via Netlify CLI
netlify rollback

# Or via Netlify UI
# Deploys → Select previous deploy → Publish
```

---

## 🎯 PERFORMANCE OPTIMIZATION

### Already Implemented
- ✅ Image optimization (Next.js Image)
- ✅ Code splitting (automatic)
- ✅ Lazy loading (React Suspense)
- ✅ Virtual lists for menus
- ✅ Service Worker caching
- ✅ Prefetching links
- ✅ AVIF/WebP images

### Further Optimization (Optional)
- [ ] CDN for static assets
- [ ] Separate image CDN
- [ ] Bundle analyzer
- [ ] Route-based code splitting
- [ ] Preload critical fonts

---

## 📱 PRODUCTION URLS

### Default Netlify
```
https://easymo-client-pwa.netlify.app
```

### Custom Domain (Example)
```
https://order.easymo.app
https://menu.easymo.app
```

### QR Code URLs
```
https://order.easymo.app/heaven-restaurant?table=5
https://order.easymo.app/scan
```

---

## ✅ DEPLOYMENT SUCCESS

### You'll Know It Worked When:
1. ✅ Netlify build succeeds (green checkmark)
2. ✅ Site loads at deployment URL
3. ✅ PWA install prompt appears on mobile
4. ✅ Offline mode works
5. ✅ QR scan opens correct venue/table
6. ✅ Voice ordering responds
7. ✅ Payments initiate
8. ✅ Real-time updates sync

### Celebrate! 🎉
Your world-class PWA is now live!

---

## 📞 SUPPORT

### Need Help?
- Check `FINAL_VERIFICATION_REPORT.md`
- Review `COMPLETE_FEATURES_AUDIT.md`
- Test with `pnpm dev` locally first
- Check Netlify deploy logs
- Verify environment variables

### Common Issues
See TROUBLESHOOTING section above.

---

**Ready to deploy? Run:**
```bash
./DEPLOY_NOW.sh
```

**Good luck! 🚀**
