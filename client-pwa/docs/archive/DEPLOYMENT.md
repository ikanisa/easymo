# Deployment Guide - EasyMO Client PWA

> Complete guide for deploying the Client PWA to production

## 🎯 Overview

This guide covers deploying the EasyMO Client PWA to **Netlify** (recommended) or **Vercel**.

## ✅ Pre-Deployment Checklist

- [ ] All tests passing (`pnpm test` if configured)
- [ ] TypeScript checks pass (`pnpm type-check`)
- [ ] ESLint passes (`pnpm lint`)
- [ ] Production build succeeds (`pnpm build`)
- [ ] Environment variables configured
- [ ] Supabase migrations applied
- [ ] Domain/subdomain ready (optional)

## 🚀 Deployment Options

### Option 1: Netlify (Recommended)

#### Initial Setup

1. **Install Netlify CLI**
```bash
npm install -g netlify-cli
netlify login
```

2. **Link Project**
```bash
cd client-pwa
netlify init
```

3. **Configure Build Settings**
```toml
# netlify.toml
[build]
  command = "pnpm build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

4. **Set Environment Variables**
```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://your-project.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your-anon-key"
```

5. **Deploy**
```bash
# Test deploy (preview)
netlify deploy

# Production deploy
netlify deploy --prod
```

#### Continuous Deployment

```bash
# Connect to Git repository
netlify link

# Auto-deploy on git push
git push origin main
```

### Option 2: Vercel

#### Initial Setup

1. **Install Vercel CLI**
```bash
npm install -g vercel
vercel login
```

2. **Deploy**
```bash
cd client-pwa
vercel --prod
```

3. **Set Environment Variables**
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

#### Continuous Deployment

```bash
# Connect to Git - auto-deploy on push
vercel --prod
# Follow prompts to link repository
```

### Option 3: Self-Hosted (Docker)

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.18.3
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
# Build and run
docker build -t easymo-client-pwa .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  easymo-client-pwa
```

## 🔒 Environment Variables

### Required (Public - Client-Side)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Optional

```bash
NEXT_PUBLIC_APP_URL=https://client.easymo.app  # For PWA manifest
NEXT_PUBLIC_MOMO_MERCHANT_ID=your-merchant-id
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

## 🧪 Post-Deployment Verification

### 1. Smoke Tests

```bash
# Health check
curl https://your-domain.com/api/health

# Menu API
curl https://your-domain.com/api/menu/[venue_id]
```

### 2. Manual Testing

- [ ] QR code scanner works
- [ ] Menu loads correctly
- [ ] Cart persists across sessions
- [ ] Payment flow completes
- [ ] Order tracking updates in real-time
- [ ] PWA installs correctly on mobile

### 3. Performance Checks

```bash
# Lighthouse CI (if configured)
npx lighthouse https://your-domain.com --view

# Expected scores:
# Performance: > 90
# Accessibility: > 95
# Best Practices: > 90
# SEO: > 90
# PWA: 100
```

## 🔄 Rollback Procedure

### Netlify

```bash
# List deployments
netlify deploy:list

# Restore previous deployment
netlify rollback [deployment-id]
```

### Vercel

```bash
# Via dashboard: deployments → previous → promote to production
# Or via CLI:
vercel --prod [deployment-url]
```

## 🐛 Troubleshooting

### Build Failures

**Issue**: `Module not found` errors
```bash
# Solution: Clear cache and rebuild
rm -rf node_modules .next
pnpm install --frozen-lockfile
pnpm build
```

**Issue**: TypeScript errors
```bash
# Solution: Regenerate types
pnpm supabase gen types typescript > src/types/database.types.ts
pnpm build
```

### Runtime Errors

**Issue**: 500 errors on deployed site
```bash
# Check logs
netlify logs  # or vercel logs

# Verify environment variables
netlify env:list
```

**Issue**: Supabase connection fails
```bash
# Verify environment variables are set
# Check Supabase URL is accessible
curl $NEXT_PUBLIC_SUPABASE_URL/rest/v1/
```

### Performance Issues

**Issue**: Slow page loads
```bash
# Optimize images
pnpm add sharp  # For Next.js image optimization

# Enable compression in netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

## 📊 Monitoring

### Recommended Tools

- **Error Tracking**: Sentry
- **Analytics**: Vercel Analytics or Google Analytics
- **Performance**: Lighthouse CI
- **Uptime**: UptimeRobot

### Setup Example (Sentry)

```bash
# Install
pnpm add @sentry/nextjs

# Configure
npx @sentry/wizard@latest -i nextjs

# Add to environment
NEXT_PUBLIC_SENTRY_DSN=your-dsn
```

## 🔐 Security Checklist

- [ ] HTTPS enabled (automatic on Netlify/Vercel)
- [ ] Security headers configured
- [ ] No secrets in client-side code
- [ ] Supabase RLS policies enabled
- [ ] Rate limiting configured (via Supabase or CDN)
- [ ] CORS properly configured

### Security Headers

```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(self)"
```

## 📱 PWA Deployment

### Manifest Configuration

```json
// public/manifest.json
{
  "name": "EasyMO Client",
  "short_name": "EasyMO",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker

Next.js handles service workers automatically with PWA configuration.

## 🆘 Support

- **Build Issues**: Check build logs in deployment dashboard
- **Runtime Errors**: Check application logs and Sentry
- **Performance**: Run Lighthouse audit
- **Database**: Check Supabase logs and dashboard

---

**Last Updated**: December 1, 2025  
**Deployment Target**: Netlify (primary), Vercel (secondary)
