# ✅ PRE-DEPLOYMENT VERIFICATION CHECKLIST

Run through this checklist before deploying to ensure everything is ready.

---

## 📋 Code Verification

### ✅ Core Files Present

- [x] `app/layout.tsx` - Root layout with PWA meta
- [x] `app/page.tsx` - Landing page
- [x] `app/manifest.ts` - PWA manifest
- [x] `app/globals.css` - Global styles
- [x] `next.config.ts` - Next.js + PWA config
- [x] `tailwind.config.ts` - Tailwind setup
- [x] `package.json` - Dependencies
- [x] `netlify.toml` - Netlify config
- [x] `.env.local` - Environment variables

### ✅ Components Directory Structure

```bash
# Verify these exist:
ls -la client-pwa/components/ui/
ls -la client-pwa/components/menu/
ls -la client-pwa/components/cart/
ls -la client-pwa/components/order/
ls -la client-pwa/components/payment/
ls -la client-pwa/components/layout/
```

### ✅ Hooks and Stores

```bash
# Verify these exist:
ls -la client-pwa/hooks/
ls -la client-pwa/stores/
ls -la client-pwa/lib/
ls -la client-pwa/types/
```

---

## 🔧 Configuration Check

### ✅ Environment Variables

Run this to verify `.env.local`:

```bash
cd client-pwa
cat .env.local
```

**Expected output:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://db.lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_SITE_URL=http://localhost:3002
```

**✅ Verified:** All variables start with `NEXT_PUBLIC_` ✓

### ✅ Netlify Configuration

```bash
cat client-pwa/netlify.toml
```

**Check for:**
- [x] Build command: `pnpm install --frozen-lockfile && pnpm build`
- [x] Publish directory: `.next`
- [x] Node version: 20
- [x] pnpm version: 10.18.3
- [x] Plugin: `@netlify/plugin-nextjs`

### ✅ Next.js Configuration

```bash
cat client-pwa/next.config.ts | head -20
```

**Check for:**
- [x] `withPWA` wrapper
- [x] Image domains include Supabase URL
- [x] PWA config present
- [x] Service worker enabled

---

## 📦 Dependencies Check

### ✅ Verify Dependencies Installed

```bash
cd client-pwa
pnpm list --depth=0
```

**Key dependencies to verify:**
- [x] `next@15.1.6`
- [x] `react@^19.0.0`
- [x] `@supabase/ssr`
- [x] `@supabase/supabase-js`
- [x] `framer-motion`
- [x] `zustand`
- [x] `next-pwa`
- [x] `tailwindcss`

### ✅ No Critical Vulnerabilities

```bash
pnpm audit
```

**Expected:** No high/critical vulnerabilities

---

## 🏗️ Build Test

### ✅ Type Check

```bash
cd client-pwa
pnpm type-check
```

**Expected:** No TypeScript errors

### ✅ Lint Check

```bash
pnpm lint
```

**Expected:** No critical errors (warnings OK)

### ✅ Build Locally

```bash
pnpm build
```

**Expected output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    XXX      XXX KB
└ ○ /[venueSlug]                        XXX      XXX KB

○  (Static)  prerendered as static content
```

**✅ Build successful:** Yes / No

### ✅ Bundle Size Check

After successful build:

```bash
du -sh .next
```

**Expected:** ~5-15 MB (before gzip)

**Check build output for:**
- [ ] First Load JS < 200KB (gzipped)
- [ ] No critical warnings
- [ ] Static pages generated

---

## 🔍 Code Quality

### ✅ No Hardcoded Secrets

```bash
# Search for common secret patterns
grep -r "sk_" client-pwa/app/ client-pwa/components/ || echo "✓ No Stripe secrets"
grep -r "pk_test" client-pwa/app/ client-pwa/components/ || echo "✓ No test keys"
grep -r "SUPABASE_SERVICE_ROLE" client-pwa/ || echo "✓ No service role key"
```

**✅ Verified:** No secrets in client code

### ✅ Environment Variables Scoped Correctly

```bash
# Verify all client-side env vars have NEXT_PUBLIC_ prefix
grep -r "process.env" client-pwa/components/ client-pwa/app/ | grep -v "NEXT_PUBLIC"
```

**Expected:** No matches (or only server-side code)

---

## 🌐 External Services Check

### ✅ Supabase Connection

```bash
# Test Supabase connection (requires curl/httpie)
curl "https://db.lhbowpbcpwoiparwnwgt.supabase.co/rest/v1/" \
  -H "apikey: eyJhbGc..." \
  -H "Authorization: Bearer eyJhbGc..."
```

**Expected:** HTTP 200 response

### ✅ Supabase Tables Exist

**Required tables:**
- `venues`
- `menu_items`
- `menu_categories`
- `orders`
- `order_items`

**Verify in Supabase Dashboard:** https://app.supabase.com/project/lhbowpbcpwoiparwnwgt

---

## 📱 PWA Manifest

### ✅ Manifest Accessible

After build, check:

```bash
cat client-pwa/public/manifest.json
```

**OR** start dev server and check:

```bash
pnpm dev
# Then visit: http://localhost:3002/manifest.json
```

**Verify manifest has:**
- [x] `name`: "EasyMO - Order Food & Drinks"
- [x] `short_name`: "EasyMO"
- [x] `start_url`: "/"
- [x] `display`: "standalone"
- [x] `icons`: Array with multiple sizes
- [x] `theme_color`: "#f9a825"

### ✅ Service Worker

**Check for:**
```bash
ls -la client-pwa/public/sw.js
```

**OR** after build:
```bash
ls -la client-pwa/.next/sw.js
```

---

## 🎨 UI/UX Verification

### ✅ Tailwind CSS Builds

```bash
# Check if Tailwind classes compile
pnpm build 2>&1 | grep -i "tailwind" || echo "✓ Tailwind built"
```

### ✅ Images Optimized

**Verify Next.js Image config:**
```bash
grep -A 10 "images:" client-pwa/next.config.ts
```

**Expected:**
- [x] Supabase domain in `domains` array
- [x] AVIF and WebP formats enabled

---

## 📊 Performance Check

### ✅ No Console Errors (Local)

```bash
# Start dev server
pnpm dev

# Open http://localhost:3002
# Open browser console (F12)
# Check for errors
```

**Expected:** No critical console errors

### ✅ Lighthouse Ready

**Checklist for good Lighthouse score:**
- [x] HTTPS (Netlify provides)
- [x] Service worker registered
- [x] Manifest with icons
- [x] Meta tags for mobile
- [x] Optimized images
- [x] Minified CSS/JS

---

## 🚀 Pre-Deployment Final Steps

### ✅ Git Status Clean

```bash
cd /Users/jeanbosco/workspace/easymo-
git status
```

**Verify:**
- [ ] All important files are tracked
- [ ] No unwanted files staged
- [ ] `.env.local` is NOT staged (should be in .gitignore)

### ✅ .gitignore Correct

```bash
cat client-pwa/.gitignore
```

**Must include:**
```
.next/
node_modules/
.env*.local
.DS_Store
*.tsbuildinfo
```

### ✅ Documentation Complete

**Check these files exist:**
- [x] `client-pwa/README.md`
- [x] `client-pwa/DEPLOYMENT_FINAL.md`
- [x] `client-pwa/GIT_PUSH_GUIDE.md`
- [x] `client-pwa/DEPLOY_FINAL.sh`

---

## 🎯 Deployment Readiness Score

### Core Requirements (Must Pass All)

- [ ] ✅ Code builds successfully (`pnpm build`)
- [ ] ✅ Type check passes (`pnpm type-check`)
- [ ] ✅ Environment variables configured
- [ ] ✅ Netlify config present (`netlify.toml`)
- [ ] ✅ PWA manifest exists
- [ ] ✅ No secrets in client code
- [ ] ✅ Supabase connection works
- [ ] ✅ Git repository clean

### Nice to Have (Recommended)

- [ ] ✅ Lint check passes
- [ ] ✅ Bundle size < 200KB
- [ ] ✅ All documentation complete
- [ ] ✅ Local testing successful

---

## ✅ FINAL GO/NO-GO DECISION

**Status:** [ ] READY TO DEPLOY / [ ] NEEDS FIXES

**If READY:** Proceed with deployment

**If NEEDS FIXES:** Address issues above first

---

## 🚀 Deploy Commands

Once all checks pass:

```bash
cd /Users/jeanbosco/workspace/easymo-

# Add and commit
git add client-pwa/
git commit -m "feat(client-pwa): Complete PWA - ready for production"

# Push to main
git push origin main

# Deploy to Netlify
cd client-pwa
netlify deploy --prod
```

---

## 📞 Troubleshooting Failed Checks

### Build Fails
```bash
rm -rf .next node_modules
pnpm install --frozen-lockfile
pnpm build
```

### Type Errors
```bash
# Check specific file
pnpm tsc --noEmit app/page.tsx
```

### Missing Dependencies
```bash
pnpm install --frozen-lockfile
```

### Netlify Config Issues
```bash
# Validate netlify.toml syntax
cat netlify.toml
```

---

**Run this checklist now and mark items as you verify them!**

Good luck with deployment! 🚀
