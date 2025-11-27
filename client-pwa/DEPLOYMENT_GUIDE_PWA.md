# EasyMO Client PWA - Deployment Guide

Complete guide for deploying the Client PWA to production.

## 📋 Pre-Deployment Checklist

### 1. Database Setup
- [ ] Supabase project created
- [ ] Database schema applied (`supabase/schema.sql`)
- [ ] Sample data seeded (optional)
- [ ] RLS policies enabled
- [ ] Realtime enabled for `client_orders` table

### 2. Environment Variables
- [ ] Production `.env.production` configured
- [ ] Supabase URL and anon key set
- [ ] App URL configured
- [ ] Payment details set (MoMo recipient, Revolut username)

### 3. Code Quality
- [ ] All TypeScript errors fixed
- [ ] Linting passed
- [ ] No console errors in production build
- [ ] Images optimized

### 4. Performance
- [ ] Lighthouse score > 90
- [ ] Core Web Vitals optimized
- [ ] Images use next/image
- [ ] Lazy loading implemented

### 5. PWA Requirements
- [ ] manifest.json configured
- [ ] Service worker ready
- [ ] Icons generated (72x72 to 512x512)
- [ ] Splash screens created
- [ ] Offline fallback ready

## 🚀 Deployment Options

### Option 1: Vercel (Recommended)

**Why Vercel?**
- Native Next.js support
- Automatic deployments
- Edge network (fast globally)
- Free SSL
- Preview deployments
- Free tier available

**Steps:**

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Deploy**
```bash
cd client-pwa
vercel --prod
```

4. **Configure Environment Variables**
- Go to Vercel Dashboard → Project Settings → Environment Variables
- Add all variables from `.env.production`
- Redeploy

5. **Custom Domain (Optional)**
- Go to Domains in Vercel
- Add `order.easymo.app`
- Configure DNS as instructed

**Deployment Command:**
```bash
# Production
vercel --prod

# Preview
vercel
```

### Option 2: Netlify

**Steps:**

1. **Install Netlify CLI**
```bash
npm i -g netlify-cli
```

2. **Build**
```bash
npm run build
```

3. **Deploy**
```bash
netlify deploy --prod
```

4. **Configure**
- Add environment variables in Netlify UI
- Set build command: `npm run build`
- Set publish directory: `.next`

### Option 3: Docker + Cloud Run / Railway / Render

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3002
ENV PORT 3002
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

**Deploy to Cloud Run:**
```bash
# Build and push
docker build -t gcr.io/PROJECT_ID/client-pwa .
docker push gcr.io/PROJECT_ID/client-pwa

# Deploy
gcloud run deploy client-pwa \
  --image gcr.io/PROJECT_ID/client-pwa \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Option 4: Static Export (GitHub Pages, S3, etc.)

**Note:** Realtime features require server-side rendering. Use this only if you don't need realtime updates.

```bash
# Update next.config.mjs
output: 'export'

# Build
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## 🔧 Production Configuration

### 1. Supabase Realtime Setup

Enable realtime for orders table:

```sql
-- Enable realtime for client_orders
ALTER PUBLICATION supabase_realtime ADD TABLE client_orders;

-- Or create new publication
CREATE PUBLICATION orders_realtime FOR TABLE client_orders;
```

In Supabase Dashboard:
1. Go to Database → Replication
2. Enable replication for `client_orders`
3. Publish INSERT and UPDATE events

### 2. Environment Variables

**Required:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
NEXT_PUBLIC_APP_URL=https://order.easymo.app
```

**Optional:**
```env
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### 3. Domain Configuration

**DNS Records:**
```
Type: A
Name: order (or @)
Value: Vercel IP or CNAME

Type: CNAME
Name: order
Value: cname.vercel-dns.com
```

### 4. SSL Certificate

- Vercel: Automatic (Let's Encrypt)
- Netlify: Automatic
- Custom: Use Certbot

### 5. Performance Optimization

**Image Optimization:**
```bash
# Generate optimized images
npm run generate-icons

# Compress images
npx @squoosh/cli --resize '{width:1920}' public/images/*.png
```

**Lighthouse Audit:**
```bash
npm run lighthouse

# Target scores:
# Performance: > 90
# Accessibility: > 95
# Best Practices: > 90
# SEO: > 90
# PWA: 100
```

## 📱 PWA Setup

### 1. Generate Icons

Use PWA Asset Generator:
```bash
npm run generate-icons
```

Or manually create:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Maskable and any purpose variants
- Place in `public/icons/`

### 2. Service Worker

Next.js automatically generates service worker in production.

Verify:
```bash
# Build
npm run build

# Check .next/server/service-worker.js exists
```

### 3. Manifest

Already configured in `app/manifest.ts`. Verify:
```bash
curl https://order.easymo.app/manifest.json
```

### 4. Testing PWA

**Chrome DevTools:**
1. Open DevTools → Application
2. Check Manifest
3. Check Service Workers
4. Test "Add to Home Screen"

**Lighthouse PWA Audit:**
```bash
lighthouse https://order.easymo.app --view
```

## 🔍 Monitoring & Analytics

### 1. Vercel Analytics

```bash
npm install @vercel/analytics
```

Add to `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 2. Google Analytics

```typescript
// lib/gtag.ts
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

export const pageview = (url: string) => {
  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  });
};
```

### 3. Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## 🧪 Testing Production Build

### Local Production Test

```bash
# Build
npm run build

# Start production server
npm start

# Test
open http://localhost:3002
```

### Lighthouse CI

```bash
npm install -g @lhci/cli

# Run audit
lhci autorun
```

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 https://order.easymo.app/

# Using Artillery
artillery quick --count 10 --num 100 https://order.easymo.app/
```

## 🔐 Security

### 1. Headers

Already configured in `next.config.mjs`:
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

### 2. RLS Policies

Verify in Supabase:
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'client_orders';
```

### 3. Environment Variables

**Never commit:**
- Service role keys
- Admin tokens
- API secrets

**Safe for client:**
- NEXT_PUBLIC_* variables
- Anon keys (RLS protected)

## 📊 Performance Targets

### Core Web Vitals

- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### Lighthouse Scores

- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 90
- PWA: 100

### Bundle Size

- First Load JS: < 200KB
- Total Page Weight: < 1MB

## 🚦 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Realtime enabled
- [ ] Icons generated
- [ ] Build successful
- [ ] No TypeScript errors
- [ ] Lighthouse score > 90
- [ ] PWA installable
- [ ] SSL certificate active
- [ ] Domain configured
- [ ] Analytics working
- [ ] Error tracking active
- [ ] QR codes generated for tables
- [ ] Payment methods tested
- [ ] Monitoring alerts set up

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
name: Deploy Client PWA

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
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd client-pwa
          npm install
      
      - name: Build
        run: |
          cd client-pwa
          npm run build
      
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## 📱 Post-Deployment

### 1. Generate QR Codes for Tables

```bash
# Using qrcode
npm install -g qrcode

# Generate for each table
qrcode -o table-5.png "https://order.easymo.app/heaven-bar?table=5"
qrcode -o table-6.png "https://order.easymo.app/heaven-bar?table=6"
```

### 2. Test Payment Flows

- [ ] MoMo USSD works
- [ ] Revolut Link opens correctly
- [ ] Payment confirmation updates order

### 3. Monitor

- Check Vercel/Netlify logs
- Monitor error rates
- Check performance metrics
- Review user feedback

## 🆘 Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Realtime Not Working

1. Check Supabase replication settings
2. Verify RLS policies
3. Check browser console for connection errors
4. Test connection:
```typescript
const channel = supabase.channel('test');
channel.subscribe((status) => console.log(status));
```

### PWA Not Installing

1. Check manifest.json loads
2. Verify service worker registered
3. Ensure HTTPS enabled
4. Check icons exist
5. Use Lighthouse PWA audit

### Images Not Loading

1. Add domain to `next.config.mjs`
2. Check image paths
3. Verify Supabase storage permissions

## 🎯 Success Metrics

Monitor these KPIs:
- **Installation Rate**: % of users who install PWA
- **Order Completion**: % of carts that convert to orders
- **Payment Success**: % of orders with completed payment
- **Page Load Time**: Average LCP
- **Error Rate**: % of requests with errors
- **User Retention**: % of returning users

---

## Quick Deploy Commands

```bash
# Vercel
cd client-pwa && vercel --prod

# Netlify
cd client-pwa && netlify deploy --prod

# Docker
docker build -t client-pwa . && docker push your-registry/client-pwa
```

Ready to go live! 🚀
