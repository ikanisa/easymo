# Local Hosting Readiness

This checklist keeps the Vite SPA production-ready when self-hosting behind nginx or another reverse proxy.

## Stack Detection

Detected project stack: `vite`

- `vite.config.ts` present → Vite + React SPA build pipeline.
- No Next.js configuration found.

## PWA Asset Preparation

- `public/manifest.json` defines installability metadata and icon references.
- Placeholder icons live at `public/icons/icon-192.png` and `public/icons/icon-512.png` (solid #0b1020 background).
- `<link rel="manifest">` and `<meta name="theme-color">` tags ship with `index.html`.

## Reverse Proxy Configuration

- Use `infrastructure/nginx/easymo.conf` as the baseline. It forwards `/` to the SPA build output in `dist/`.
- Ensure `/api/*` routes proxy to Supabase Edge Functions or your broker API gateway.
- Apply security headers (`Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`) defined in the nginx template.

## Service Worker & Runtime Registration

- `public/service-worker.js` implements install, activate, and offline caching strategies.
- `src/main.tsx` registers the worker with basic error handling.
- When iterating locally set `VITE_SW_DEBUG=true` to log lifecycle events.

## Build & Runtime Scripts

- `pnpm run build` creates the production bundle under `dist/`.
- `pnpm run preview -- --port 5000` serves the bundle for smoke tests.
- `pnpm run analyze:pwa` runs Lighthouse in desktop/PWA mode.

## Environment Variables

- `.env.example` captures required settings for Supabase project `lhbowpbcpwoiparwnwgt`.
- `.gitignore` keeps `.env` private while allowing `.env.example` and `docs/env/env.sample` to be tracked.
- Mirror variables across `.env`, nginx/systemd/Kubernetes secrets, and Supabase:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_API_BASE`
  - `VITE_SUPABASE_SERVICE_ROLE_KEY` *(server only; keep out of the browser)*
  - `VITE_ADMIN_TOKEN` / `ADMIN_TOKEN` / `EASYMO_ADMIN_TOKEN`
  - `ADMIN_SESSION_SECRET`, `ADMIN_ACCESS_CREDENTIALS`
  - `DISPATCHER_FUNCTION_URL`
  - Optional toggles (`NEXT_PUBLIC_USE_MOCKS`, `VITE_ENABLE_AGENT_CHAT`, reminder cron variables, etc.)

## Local Verification

1. Install dependencies: `pnpm install`
2. Run the automated check: `pnpm exec node scripts/verify-pwa.mjs`
   - The script validates manifest/icon presence, service worker registration, runs `pnpm run build`, launches `pnpm run preview --port 5000`, and ensures it responds with HTTP 200.
   - Results append to this document under **Verification Run**.
3. Optional: `pnpm run analyze:pwa` to execute a Lighthouse PWA audit.

## Deployment Steps

1. Build the SPA (`pnpm run build`).
2. Copy `dist/` to the server and point nginx to the directory (see `infrastructure/nginx/easymo.conf`).
3. Reload nginx (`sudo systemctl reload nginx`) or restart the container.
4. Smoke test `/`, `/login`, and `/openapi.yaml`.
5. If you use a CDN, purge caches after deployment.

### Admin App Coordination

- Deploy the Next.js admin panel container documented in `docs/deployment/admin-app-self-hosting.md`.
- Ensure both the SPA and admin app share consistent environment secrets.

## Acceptance Checklist

- [ ] `pnpm exec node scripts/verify-pwa.mjs`
- [ ] `pnpm run build`
- [ ] `pnpm run preview -- --port 5000`
- [ ] Lighthouse PWA score ≥ 90 (`pnpm run analyze:pwa`)
- [ ] Hosting environment variables configured (nginx/systemd/Kubernetes)
- [ ] Admin login succeeds on deployed host (`/login` → `/dashboard`, cookie present)

## Troubleshooting

- **PWA won’t install** → Confirm `<link rel="manifest">`, valid icons, and that the service worker registers without errors (`navigator.serviceWorker` console logs).
- **404 on refresh** → Ensure nginx rewrites SPA routes back to `/index.html` (see `try_files` in the example config).
- **Environment variable missing** → Sync `.env` with host secrets and reload the service.
- **Slow assets** → Prefer optimized formats (WebP/AVIF) and enable gzip/brotli in nginx.
- **Stale app after deploy** → Bump `CACHE_VERSION` in `public/service-worker.js` or clear service worker caches via DevTools.

## Verification Run (2025-10-09T13:24:43.972Z)

- ✅ manifest.json includes 192 & 512 icons
- ✅ PWA icons present
- ✅ index.html has <link rel="manifest">
- ✅ index.html has theme-color meta
- ✅ Service worker registration in src/main.tsx
- ✅ pnpm run build
- ❌ Preview server probe

## Verification Run (2025-10-09T13:26:12.097Z)

- ✅ manifest.json includes 192 & 512 icons
- ✅ PWA icons present
- ✅ index.html has <link rel="manifest">
- ✅ index.html has theme-color meta
- ✅ Service worker registration in src/main.tsx
- ✅ pnpm run build
- ✅ Preview server probe (skipped)
