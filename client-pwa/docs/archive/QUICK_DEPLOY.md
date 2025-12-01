# 🚀 Quick Deploy Guide - EasyMO Client PWA

## ⚡ 1-Minute Deploy

```bash
# Navigate to project
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# Install dependencies
pnpm install --frozen-lockfile

# Configure environment (one-time)
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>
ENVEOF

# Build
pnpm build

# Deploy to Netlify
netlify deploy --prod
```

## 📋 Environment Variables for Netlify

Add these in Netlify Dashboard → Site Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get-from-supabase>
```

## 🔑 Get Supabase Anon Key

**Option 1**: Supabase Dashboard
- Visit: https://app.supabase.com/project/lhbowpbcpwoiparwnwgt/settings/api
- Copy the "anon" "public" key

**Option 2**: CLI
```bash
cd /Users/jeanbosco/workspace/easymo-
supabase status | grep "anon key"
```

## ✅ Pre-Deploy Checklist

- [ ] Supabase anon key obtained
- [ ] Environment variables set
- [ ] Build passes locally (`pnpm build`)
- [ ] Type check passes (`pnpm type-check`)

## 🌐 Netlify Build Settings

```
Base directory: client-pwa
Build command: pnpm build
Publish directory: client-pwa/.next
Node version: 20
```

## 🧪 Test Locally First

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa
pnpm dev
# Open http://localhost:3002
```

## 📱 Post-Deploy Test

1. Open deployed URL on mobile
2. Try "Add to Home Screen"
3. Test as installed PWA
4. Verify menu browsing works

## 🆘 Quick Troubleshooting

**Build fails?**
```bash
rm -rf .next node_modules
pnpm install --frozen-lockfile
pnpm build
```

**Environment variables not working?**
- Ensure they start with `NEXT_PUBLIC_`
- Redeploy after adding variables
- Check Netlify logs for errors

**PWA not installing?**
- Must be served over HTTPS
- Check manifest.json is accessible
- Verify service worker registered

## 📊 Success Metrics

After deployment, verify:
- ✅ Page loads in <2s
- ✅ PWA install prompt appears
- ✅ Lighthouse PWA score = 100
- ✅ No console errors

## 🎯 Next Steps

1. Test on iOS & Android
2. Run Lighthouse audit
3. Configure custom domain (optional)
4. Set up monitoring

---

**Need more details?** See `DEPLOYMENT.md` and `README_CLIENT_PWA.md`
