# EasyMO Cloudflare Pages Deployment Guide

Internal deployment guide for EasyMO Admin Panel and Client Portal PWAs.

> **Note**: These deployments are for internal/in-house users only, not publicly available.

## Overview

| App | Project Name | Port (Dev) | Purpose |
|-----|--------------|------------|---------|
| Admin Panel | `easymo-admin` | 3000 | Operations hub for staff |
| Client Portal | `easymo-client-portal` | 3002 | Customer-facing PWA |

## Prerequisites

1. Cloudflare account with Pages access
2. Wrangler CLI installed: `npm install -g wrangler`
3. Authenticated: `wrangler login`
4. Node.js 20.x and pnpm 8+

## Admin Panel Deployment

### 1. Build for Cloudflare

```bash
cd admin-app
pnpm install
pnpm pages:build
```

### 2. Preview Locally

```bash
pnpm pages:preview
```

### 3. Deploy to Cloudflare Pages

```bash
pnpm pages:deploy
```

### 4. Environment Variables (Set in Cloudflare Dashboard)

Navigate to: Pages > easymo-admin > Settings > Environment variables

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `EASYMO_ADMIN_TOKEN` - Admin API token

**Optional:**
- `NEXT_PUBLIC_USE_MOCKS` = `false`
- `NEXT_PUBLIC_UI_V2_ENABLED` = `true`

## Client Portal Deployment

### 1. Build for Cloudflare

```bash
cd client-pwa
pnpm install
pnpm pages:build
```

### 2. Preview Locally

```bash
pnpm pages:preview
```

### 3. Deploy to Cloudflare Pages

```bash
pnpm pages:deploy
```

### 4. Environment Variables (Set in Cloudflare Dashboard)

Navigate to: Pages > easymo-client-portal > Settings > Environment variables

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

## Access Control (Internal Only)

Since these are internal deployments, configure access restrictions:

### Option 1: Cloudflare Access (Recommended)

1. Go to Cloudflare Zero Trust Dashboard
2. Create an Access Application for each deployment
3. Configure authentication (email domain, identity provider, etc.)
4. Apply policy to restrict to in-house users only

### Option 2: Custom Domain with Access

1. Add custom domain in Pages settings
2. Configure Cloudflare Access on the custom domain
3. Restrict by email domain: `@yourcompany.com`

## PWA Features

Both apps are configured as Progressive Web Apps:

### Admin Panel PWA
- Offline dashboard access
- Push notifications for alerts
- Install prompt for desktop/mobile
- Service worker caching

### Client Portal PWA
- QR code scanning
- Offline menu viewing
- Order status updates
- Mobile-first design

## Build Configuration

### Admin Panel (`admin-app/wrangler.toml`)
```toml
name = "easymo-admin"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"
```

### Client Portal (`client-pwa/wrangler.toml`)
```toml
name = "easymo-client-portal"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".next"
```

## Troubleshooting

### Build Fails with Node.js Compatibility

Ensure `nodejs_compat` flag is set in wrangler.toml:
```toml
compatibility_flags = ["nodejs_compat"]
```

### Service Worker Not Registering

Check that `sw.js` is in the `public` directory and headers allow service worker scope.

### Environment Variables Not Loading

1. Verify variables are set in Cloudflare Dashboard
2. Prefix client-side variables with `NEXT_PUBLIC_`
3. Redeploy after changing environment variables

## Supported Countries

Both apps operate in exactly 4 countries:
- 🇷🇼 RW - Rwanda (Primary)
- 🇨🇩 CD - DR Congo
- 🇧🇮 BI - Burundi
- 🇹🇿 TZ - Tanzania

## Quick Commands

```bash
# Admin Panel
cd admin-app
pnpm pages:build && pnpm pages:deploy

# Client Portal
cd client-pwa
pnpm pages:build && pnpm pages:deploy
```

## Related Documentation

- [Cloudflare Pages Next.js Guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/)
- [PWA Deployment Checklist](./admin-app/PWA_DEPLOYMENT_CHECKLIST.md)
