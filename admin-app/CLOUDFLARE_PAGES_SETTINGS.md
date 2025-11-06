# Cloudflare Pages Dashboard Settings

## Quick Setup for Cloudflare Pages Dashboard

### Framework Settings
- **Framework preset**: `Next.js`
- **Node version**: `20` (specified in .nvmrc)

### Build Configuration

**Build command**:
```bash
pnpm -w --filter @va/shared build && pnpm -w --filter @easymo/commons build && pnpm -w --filter @easymo/ui build && cd admin-app && pnpm build && npx @cloudflare/next-on-pages@latest --skip-build
```

**Build output directory**:
```
admin-app/.vercel/output/static
```

**Root directory**: _(leave empty)_

### Environment Variables

#### Production Environment

| Variable | Value | Type |
|----------|-------|------|
| `NODE_VERSION` | `20` | Plain text |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Plain text |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | Plain text |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | **Secret (encrypted)** |
| `EASYMO_ADMIN_TOKEN` | `your-token` | **Secret (encrypted)** |
| `ADMIN_SESSION_SECRET` | `min-16-chars-random` | **Secret (encrypted)** |

#### Preview Environment  
_(Same as production, can use different Supabase project for testing)_

### Build Cache Settings
- **Enable build caching**: ✅ Yes (recommended)
- This will speed up subsequent builds significantly

### Deploy Settings
- **Production branch**: `main`
- **Preview deployments**: Enable for all branches
- **Deployment notifications**: Enable (optional)

## Copy-Paste Build Command

For easy copy-paste into Cloudflare dashboard:

```
pnpm -w --filter @va/shared build && pnpm -w --filter @easymo/commons build && pnpm -w --filter @easymo/ui build && cd admin-app && pnpm build && npx @cloudflare/next-on-pages@latest --skip-build
```

## Troubleshooting

### Build Fails: "pnpm not found"
**Solution**: Cloudflare should auto-detect pnpm from `pnpm-lock.yaml`. If it doesn't:
1. Check that `pnpm-lock.yaml` is committed to git
2. Try adding `packageManager: "pnpm@10.11.1"` to root `package.json`

### Build Fails: "Could not read .vercel/output/config.json"
**Solution**: Ensure build command includes `pnpm build` (Next.js build) BEFORE running `@cloudflare/next-on-pages`

### Build Timeout
**Solution**: 
1. Enable build caching in Cloudflare settings
2. Check that shared packages are being cached properly
3. Consider increasing timeout in Cloudflare dashboard (if available)

### Environment Variables Not Working
**Solution**:
1. Verify variables are set for the correct environment (Production/Preview)
2. Click "Redeploy" after adding/changing variables
3. Check variable names match exactly (case-sensitive)

## Verification After Deployment

Once deployed, verify these URLs work:

1. **PWA Manifest**: `https://your-domain.pages.dev/manifest.webmanifest`
2. **Service Worker**: `https://your-domain.pages.dev/sw.js`
3. **Offline Page**: `https://your-domain.pages.dev/offline.html`
4. **Icons**: `https://your-domain.pages.dev/icons/icon-512.png`

## Performance Tips

1. **Use Cloudflare's Smart Tiered Caching**
   - Automatically enabled for Pages
   - Reduces build times and improves delivery

2. **Enable Cloudflare Analytics**
   - Free for Pages projects
   - Monitor Core Web Vitals

3. **Set up Custom Domain**
   - Better for SEO and branding
   - Automatic SSL/TLS

4. **Enable Early Hints**
   - Speeds up page loads
   - Available in Cloudflare dashboard under Speed > Optimization

## Migration from Other Platforms

### From Vercel
- Build output structure is compatible
- Just update build command and env vars
- DNS changes may take 24-48 hours

### From Netlify  
- Similar setup process
- May need to adjust build command slightly
- Environment variables transfer easily

## Cost Estimates

Cloudflare Pages is **FREE** for:
- Unlimited requests
- Unlimited bandwidth  
- 500 builds per month
- 1 build at a time

For higher limits, consider Cloudflare Pages Pro.

## Support Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Community Discord](https://discord.cloudflare.com)
- [GitHub Issues](https://github.com/cloudflare/next-on-pages/issues)
