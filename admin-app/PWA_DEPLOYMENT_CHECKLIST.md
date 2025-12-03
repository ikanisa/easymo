# EasyMO Admin PWA - Netlify Deployment Checklist

## Pre-Deployment Checklist

### 1. Build & Test Locally
```bash
cd admin-app

# NOTE: Use pnpm (not npm) for consistency with monorepo
# From repository root:
pnpm install --frozen-lockfile
pnpm --filter @va/shared build && pnpm --filter @easymo/commons build

# Then in admin-app:
cd admin-app

# Type check
pnpm run type-check

# Lint
pnpm run lint

# Run tests
pnpm test -- --run

# Build locally
pnpm run build

# Test production build
pnpm run start
```

### 2. Verify PWA Assets
```bash
# Check PWA files exist
ls -la public/manifest.webmanifest
ls -la public/sw.v4.js
ls -la public/offline.html
ls -la public/_headers

# Check icons directory
ls -la public/icons/

# Verify screenshots
ls -la public/screenshots/
```

### 3. Test Service Worker Locally
1. Run `npm run dev` or `npm run start`
2. Open Chrome DevTools
3. Go to Application > Service Workers
4. Verify `sw.v4.js` is registered and activated
5. Test offline mode:
   - Network tab > Offline checkbox
   - Reload page
   - Should see offline.html

### 4. Test PWA Installation
1. Run local build (`pnpm run build && pnpm run start`)
2. Open in Chrome (desktop or Android)
3. Check for install prompt in address bar
4. Install PWA
5. Verify it opens in standalone mode

## Offline Support Requirements (P0)

### Critical PWA Features
To meet PWA requirements, ensure the following offline capabilities:

1. **Service Worker Registration**: Service worker must be registered on first visit
2. **Offline Page**: Custom offline page (`/offline.html`) must display when network is unavailable
3. **Static Asset Caching**: All critical static assets must be precached
4. **API Fallback**: Graceful degradation for API calls when offline
5. **Background Sync**: Queue operations made while offline for replay when connected

### Testing Offline Mode
1. Open DevTools > Application > Service Workers
2. Enable "Offline" checkbox
3. Refresh the page - should show offline page
4. Navigate to cached routes - should work
5. Try API operations - should show appropriate offline messages

## Netlify Configuration

### 1. Environment Variables
Set in Netlify Dashboard → Site Settings → Environment Variables:

**Required:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_SESSION_SECRET=your-32-char-secret-minimum
ADMIN_ACCESS_CREDENTIALS=[{"actorId":"...","email":"...","password":"..."}]
```

**Services:**
```bash
AGENT_CORE_URL=https://agent-core.easymo.dev
AGENT_CORE_INTERNAL_TOKEN=your-token
VOICE_BRIDGE_API_URL=https://voice-bridge.easymo.dev
WALLET_SERVICE_URL=https://wallet.easymo.dev
INSURANCE_SERVICE_URL=https://insurance.easymo.dev
```

**Feature Flags:**
```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_UI_V2_ENABLED=true
NEXT_PUBLIC_ENV=production
```

### 2. Build Settings
- **Base directory:** `admin-app`
- **Build command:** (from netlify.toml)
- **Publish directory:** `.next`
- **Node version:** `20.18.0`

### 3. Deploy Configuration
Ensure `netlify.toml` is at repository root with:
- Build commands for monorepo
- Next.js plugin enabled
- Context-specific environment variables
- PWA-specific headers

## Post-Deployment Verification

### 1. Check PWA Score
```bash
# Using Lighthouse
npx lighthouse https://admin.easymo.dev --view

# Or use Chrome DevTools > Lighthouse
# Target scores:
# - Performance: 80+
# - Accessibility: 90+
# - Best Practices: 90+
# - SEO: 90+
# - PWA: 90+
```

### 2. Verify Manifest
```bash
# Check manifest is accessible
curl -I https://admin.easymo.dev/manifest.webmanifest

# Should return:
# - Status: 200
# - Content-Type: application/manifest+json
# - Cache-Control: public, max-age=86400
```

### 3. Verify Service Worker
```bash
# Check SW is accessible
curl -I https://admin.easymo.dev/sw.v4.js

# Should return:
# - Status: 200
# - Content-Type: application/javascript
# - Cache-Control: public, max-age=0, must-revalidate
# - Service-Worker-Allowed: /
```

### 4. Check Security Headers
```bash
curl -I https://admin.easymo.dev | grep -E "X-Frame|X-Content|Strict-Transport"

# Should see:
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 5. Test Offline Mode
1. Visit https://admin.easymo.dev
2. Open Chrome DevTools
3. Application > Service Workers → verify registered
4. Network tab → check "Offline"
5. Reload page
6. Should see custom offline page
7. Navigate to /dashboard
8. Should load cached version if available

### 6. Test Installation
**Desktop (Chrome):**
1. Visit site
2. Click install icon in address bar
3. App should open in standalone window
4. Check Start menu/Applications for app icon

**Mobile (Android):**
1. Visit site in Chrome
2. Tap "Add to Home Screen"
3. App should install with icon
4. Open from home screen
5. Should open in standalone mode (no browser UI)

**iOS:**
1. Visit in Safari
2. Tap Share → "Add to Home Screen"
3. App icon should appear
4. Open from home screen

### 7. Test App Shortcuts
1. Install PWA
2. Right-click app icon (desktop) or long-press (mobile)
3. Should see:
   - Dashboard
   - Users
   - WhatsApp
   - Notifications
4. Click each to verify navigation

### 8. Test Background Sync
1. Open PWA
2. Go offline (Airplane mode or DevTools)
3. Try to send a notification or update user
4. Should see "queued" message
5. Go back online
6. Check that request was replayed
7. Verify success notification

## Performance Monitoring

### 1. Core Web Vitals
Monitor in production:
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

### 2. Cache Hit Rate
Check service worker cache effectiveness:
- Open DevTools > Application > Cache Storage
- Verify caches created:
  - `easymo-shell-v4-aurora`
  - `easymo-runtime-v4-aurora`
  - `easymo-static-v4-aurora`
  - `easymo-images-v4-aurora`
  - `easymo-fonts-v4-aurora`

### 3. Network Requests
- Static assets should be cached (from Service Worker)
- API requests should show network-first strategy
- Images should use stale-while-revalidate

## Troubleshooting

### Service Worker Not Registering
1. Check console for errors
2. Verify `/sw.v4.js` is accessible
3. Check `Service-Worker-Allowed` header is set
4. Clear all caches and reload
5. Unregister old service workers

### Offline Page Not Showing
1. Check `/offline.html` is accessible
2. Verify it's in PRECACHE_URLS in sw.v4.js
3. Check service worker is activated
4. Clear caches and reload

### Icons Not Showing
1. Verify all icon sizes exist in `/public/icons/`
2. Check manifest.webmanifest paths are correct
3. Test with PWA Builder or Lighthouse
4. Ensure icons are square and correct sizes

### Install Prompt Not Appearing
1. Site must be served over HTTPS
2. Manifest must be valid
3. Service worker must be registered
4. User hasn't dismissed prompt before
5. Check `beforeinstallprompt` event fires

### Background Sync Failing
1. Check IndexedDB is accessible
2. Verify sync tag is registered
3. Check network connectivity
4. Review queued requests in DevTools > Application > IndexedDB

## Rollback Procedure

If deployment fails:

```bash
# 1. Identify last working deployment
git log --oneline

# 2. Revert to previous commit
git revert <commit-hash>

# 3. Push to trigger new deployment
git push origin main

# 4. Or use Netlify UI to rollback to previous deploy
```

## Success Criteria

- ✅ Build completes without errors
- ✅ All tests pass
- ✅ Lighthouse PWA score ≥ 90
- ✅ Service Worker registers and activates
- ✅ Offline mode works (shows offline.html)
- ✅ Install prompt appears on supported browsers
- ✅ App installs and runs in standalone mode
- ✅ Background sync queues offline requests
- ✅ All security headers present
- ✅ No console errors in production

## Maintenance

### Updating Service Worker
When updating SW version:

1. Increment SW_VERSION in `sw.v4.js`
2. Update PRECACHE_URLS if needed
3. Test thoroughly in local build
4. Deploy and verify auto-update works
5. Old caches should be cleaned automatically

### Adding New Routes
1. Update service worker caching patterns if needed
2. Add to PRECACHE_URLS if critical
3. Test offline behavior
4. Deploy and verify

### Icon Updates
1. Replace icons in `/public/icons/`
2. Maintain all required sizes
3. Update manifest.webmanifest if needed
4. Test installation on all platforms
5. Clear cache on test devices

---

**Last Updated:** 2025-11-26  
**Version:** 4.0 (Aurora Theme)  
**Status:** Production Ready ✅
