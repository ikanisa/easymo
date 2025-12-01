# ⚡ EasyMO Client PWA - Quick Start

## What You Have

A production-ready Next.js 15 PWA with:
- ✅ Supabase integration
- ✅ Mobile-first UI (dark mode)
- ✅ PWA manifest
- ✅ Netlify deployment config
- ✅ TypeScript + Tailwind CSS
- ✅ ~105KB bundle size

## 🚀 Deploy Now (3 Commands)

```bash
cd /Users/jeanbosco/workspace/easymo-/client-pwa

# 1. Build
pnpm build

# 2. Deploy
./deploy.sh
```

That's it! The deployment script handles everything.

## 🔑 Environment Variables

Already configured in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://db.lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (anon key, safe for client)
```

**Set the same in Netlify Dashboard** after deployment.

## 📱 Test Locally

```bash
pnpm dev
# Open http://localhost:3002
```

## 📂 Project Structure

```
client-pwa/
├── app/
│   ├── layout.tsx       # Root layout + metadata
│   ├── page.tsx         # Home page
│   └── globals.css      # Tailwind styles
├── lib/
│   ├── supabase/
│   │   └── client.ts    # Supabase browser client
│   └── utils.ts         # Helpers (cn, formatPrice)
├── types/
│   ├── menu.ts          # Menu types
│   └── cart.ts          # Cart types
├── public/
│   ├── manifest.json    # PWA manifest
│   └── icons/           # (add 192x192 & 512x512 PNGs)
├── netlify.toml         # Deploy config
├── .env.local           # Environment (local)
└── deploy.sh            # Deployment script
```

## 🎯 Next Steps (After Deployment)

1. **Add Menu Pages**
   ```bash
   mkdir -p app/[venueSlug]
   # Create dynamic venue routes
   ```

2. **Implement Cart**
   ```bash
   # Zustand store already typed in types/cart.ts
   ```

3. **Add Payment Pages**
   ```bash
   mkdir -p app/checkout
   # MoMo USSD & Revolut integration
   ```

4. **Real-time Orders**
   ```typescript
   // Use Supabase Realtime
   const supabase = createClient();
   const channel = supabase.channel('orders')...
   ```

## 🐛 Troubleshooting

**"Cannot find module '@supabase/ssr'"**
→ Run `pnpm install`

**Build fails**
→ Check `pnpm build` output for TypeScript errors

**PWA not installing**
→ Must be served over HTTPS (Netlify does this automatically)

## 📚 Documentation

- Full deployment guide: `DEPLOY.md`
- Next.js docs: https://nextjs.org/docs
- Supabase docs: https://supabase.com/docs
- Netlify docs: https://docs.netlify.com

---

**Ready to deploy?** Run `./deploy.sh`
