# PWA Admin Panel - Quick Reference Card

## 🚀 Deploy Now

```bash
# 1. Commit changes
git add .
git commit -m "feat(admin): Production-ready PWA with Aurora theme v4"
git push origin main

# 2. Verify deployment
cd admin-app
./verify-pwa-deployment.sh https://admin.easymo.dev
```

## 📋 Pre-Flight Checklist

```bash
cd admin-app

# ✓ Type check
npm run type-check

# ✓ Lint
npm run lint

# ✓ Test
npm test -- --run

# ✓ Build
npm run build

# ✓ Test locally
npm run start
```

## 🔧 Netlify Environment Variables

**Required - Set in Netlify Dashboard:**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vacltfdslodqybxojytc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
ADMIN_SESSION_SECRET=<32-char-secret>
ADMIN_ACCESS_CREDENTIALS=<json-array>
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_UI_V2_ENABLED=true
NEXT_PUBLIC_ENV=production
```

## 🧪 Test PWA Features

### Desktop (Chrome)
1. Visit site → Install icon appears in address bar
2. Click install → App opens in standalone window
3. Open DevTools → Application → Service Workers → Verify v4-aurora

### Mobile (Android/iOS)
1. Visit in browser → Install prompt or "Add to Home Screen"
2. Install → Icon appears on home screen
3. Open → App runs in standalone mode (no browser UI)

### Offline Mode
1. Open DevTools → Network → Check "Offline"
2. Reload page → Custom offline page with Aurora theme
3. Navigate to /dashboard → Cached version loads
4. Uncheck "Offline" → Connection restored message

### Background Sync
1. Go offline
2. Try to send notification or update user
3. See "Request queued" message
4. Go online → Request auto-replays
5. See success notification

## 📊 Success Criteria

- ✅ Lighthouse PWA score ≥ 90
- ✅ Service Worker registered (v4-aurora)
- ✅ Offline page displays correctly
- ✅ Install prompt appears
- ✅ App installs in standalone mode
- ✅ Background sync works
- ✅ All security headers present

## 🔍 Quick Verification

```bash
# Check manifest
curl -I https://admin.easymo.dev/manifest.webmanifest

# Check Service Worker
curl -I https://admin.easymo.dev/sw.v4.js

# Check offline page
curl -I https://admin.easymo.dev/offline.html

# Full verification
./verify-pwa-deployment.sh https://admin.easymo.dev
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `sw.v4.js` | Service Worker (v4-aurora) |
| `manifest.webmanifest` | PWA manifest |
| `offline.html` | Offline fallback page |
| `_headers` | Netlify security headers |
| `PWAProvider.tsx` | React PWA integration |

## 🛠 Integration

### Add to Layout

```tsx
// app/layout.tsx
import { PWAProvider } from '@/components/pwa/PWAProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body>
        <PWAProvider>
          {children}
        </PWAProvider>
      </body>
    </html>
  );
}
```

### Use PWA Hooks

```tsx
'use client';
import { usePWA } from '@/components/pwa/PWAProvider';

export function InstallButton() {
  const { canInstall, install } = usePWA();
  return canInstall ? <button onClick={install}>Install</button> : null;
}
```

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| SW not registering | Clear caches, check `/sw.v4.js` accessible |
| Offline page not showing | Verify in PRECACHE_URLS, clear cache |
| Install prompt missing | Check HTTPS, valid manifest, SW registered |
| Icons not displaying | Verify `/icons/*.png` exist and correct sizes |
| Background sync failing | Check IndexedDB, network, queued requests |

## 📚 Documentation

- **Complete Guide:** `/NETLIFY_PWA_COMPLETE.md`
- **Deployment Checklist:** `/admin-app/PWA_DEPLOYMENT_CHECKLIST.md`
- **Verification Script:** `/admin-app/verify-pwa-deployment.sh`

## 🎯 Performance Targets

- PWA: ≥ 90
- Performance: ≥ 80
- Accessibility: ≥ 90
- Best Practices: ≥ 90
- SEO: ≥ 90

**Core Web Vitals:**
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

---

**Version:** 4.0 Aurora  
**Status:** Production Ready ✅  
**Deploy:** `git push origin main`
