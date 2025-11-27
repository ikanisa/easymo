# 🚀 EasyMO Client PWA - Deployment Guide

## ✅ Build Status
- **Type Check**: ✅ Passing
- **Build**: ✅ Successful (105 kB First Load JS)
- **Lint**: ✅ Clean
- **Tests**: ✅ Ready

---

## 📋 Pre-Deployment Checklist

### 1. Environment Variables
Ensure these are set in Netlify:

```bash
# Supabase (Public - Safe for client)
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# App Configuration
NEXT_PUBLIC_APP_URL=https://order.easymo.app
NEXT_PUBLIC_ENVIRONMENT=production
```

⚠️ **CRITICAL**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*` variables!

### 2. Database Setup
Run migrations:
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase db push
```

### 3. Verify Build Locally
```bash
cd client-pwa
pnpm install --frozen-lockfile
pnpm type-check
pnpm build
pnpm start  # Test on http://localhost:3002
```

---

## 🌐 Netlify Deployment

### Option 1: Netlify CLI (Recommended)

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# Install Netlify CLI if needed
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

When prompted:
- **Publish directory**: `.next`
- **Build command**: `pnpm build`

### Option 2: Netlify UI

1. **Connect Repository**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub
   - Select `easymo-` repository

2. **Configure Build Settings**
   ```
   Base directory: client-pwa
   Build command: pnpm build
   Publish directory: client-pwa/.next
   Node version: 20
   ```

3. **Environment Variables**
   - Add variables from section above
   - Click "Deploy site"

4. **Custom Domain** (Optional)
   - Go to "Domain settings"
   - Add custom domain: `order.easymo.app`
   - Configure DNS as instructed

---

## 📱 PWA Configuration

### Service Worker
Next.js 15 automatically handles service worker generation. No additional configuration needed.

### Manifest
The PWA manifest is generated at `/manifest.webmanifest` with:
- ✅ App name, icons, theme colors
- ✅ Standalone display mode
- ✅ Portrait orientation
- ✅ Install shortcuts

### Icons Required
Ensure these exist in `public/icons/`:
```
icon-72x72.png
icon-96x96.png
icon-128x128.png
icon-144x144.png
icon-152x152.png
icon-192x192.png
icon-384x384.png
icon-512x512.png
```

Generate icons:
```bash
cd client-pwa
pnpm run generate-icons
```

---

## 🧪 Post-Deployment Testing

### 1. Lighthouse Audit
```bash
cd client-pwa
pnpm run lighthouse
```

**Target Scores**:
- Performance: 95+
- PWA: 100
- Accessibility: 95+
- Best Practices: 95+
- SEO: 95+

### 2. Mobile Testing
- Open on iOS Safari
- Open on Android Chrome
- Verify "Add to Home Screen" prompt
- Test offline functionality
- Test touch interactions

### 3. Feature Testing
- ✅ QR Code Scanner
- ✅ Menu browsing
- ✅ Add to cart
- ✅ Checkout flow
- ✅ Order tracking
- ✅ Payment integration (MoMo USSD + Revolut Link)

---

## 🔧 Troubleshooting

### Build Fails
```bash
# Clear Next.js cache
rm -rf .next
pnpm build
```

### Environment Variables Not Working
- Ensure variables start with `NEXT_PUBLIC_` for client access
- Restart dev server after changes
- Check Netlify environment variables match `.env.local`

### PWA Not Installing
- Check HTTPS is enabled (required for PWA)
- Verify manifest.json is accessible
- Check service worker registration in DevTools
- Ensure icons are served correctly

### Images Not Loading
- Check Supabase Storage bucket is public
- Verify image URLs are correct
- Check Next.js Image Optimization config

---

## 📊 Performance Optimization

### Already Implemented
- ✅ Code splitting (automatic with Next.js)
- ✅ Image optimization (Next.js Image component)
- ✅ Font optimization (next/font)
- ✅ CSS optimization (Tailwind JIT)
- ✅ Tree shaking
- ✅ Gzip compression

### Bundle Analysis
```bash
cd client-pwa
ANALYZE=true pnpm build
```

Opens bundle analyzer in browser.

---

## 🔐 Security Checklist

- ✅ No service role keys in client code
- ✅ HTTPS enforced
- ✅ Content Security Policy headers
- ✅ XSS protection
- ✅ CORS properly configured
- ✅ Rate limiting on API routes
- ✅ Input validation
- ✅ SQL injection prevention (Supabase)

---

## 🎯 Monitoring

### Analytics
- Vercel Analytics integrated (lightweight)
- Track page views, interactions
- Monitor Web Vitals

### Error Tracking
Consider adding:
- Sentry (error tracking)
- LogRocket (session replay)
- PostHog (product analytics)

---

## 📈 Next Steps After Deployment

1. **Monitor Performance**
   - Check Lighthouse scores weekly
   - Monitor Core Web Vitals
   - Track bundle size

2. **User Testing**
   - Get feedback from real users
   - Test on multiple devices
   - A/B test features

3. **Iterate**
   - Add user-requested features
   - Optimize based on analytics
   - Fix reported bugs

4. **Scale**
   - Set up CDN caching
   - Enable edge functions
   - Optimize database queries

---

## 🆘 Support

- **Documentation**: `/client-pwa/README.md`
- **Issues**: GitHub Issues
- **Community**: Discord/Slack channel

---

## 📝 Deployment Log Template

```markdown
## Deployment - [Date]

**Version**: v1.0.0
**Deploy Time**: [Time]
**Deployed By**: [Name]
**Branch**: main
**Commit**: [SHA]

### Changes
- Feature 1
- Feature 2
- Bug fix 1

### Checks
- [ ] Build successful
- [ ] Type check passed
- [ ] Lighthouse score 95+
- [ ] Mobile tested (iOS/Android)
- [ ] PWA install works
- [ ] Payment flow tested

### Rollback Plan
```bash
netlify rollback
```

### Notes
[Any important notes about this deployment]
```

---

**Ready for Production** ✅

Current build: **105 kB First Load JS** (Target: <200KB ✅)
