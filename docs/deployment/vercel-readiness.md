# Vercel PWA Readiness

## Stack Detection

Detected project stack: `vite`

- `vite.config.ts` present → using Vite + React SPA build pipeline.
- No Next.js configuration found.

Additional steps below will ensure Vercel deployment as a Progressive Web App.

## PWA Asset Preparation

- Added `public/manifest.json` with installability metadata and icon references.
- Generated placeholder icons at `public/icons/icon-192.png` and `public/icons/icon-512.png` (solid #0b1020 background).
- Injected `<link rel="manifest">` and `<meta name="theme-color">` tags into `index.html` head.

## Vercel Configuration

- Added `vercel.json` with security & caching headers, SPA rewrites, and default deployment region `fra1`.
- Update `regions` to match deployment needs (set `VERCEL_REGION` project env or adjust file before deploy).

## Service Worker & Runtime Registration

- Added `public/service-worker.js` implementing install, activate, and offline caching strategies.
- Registered the service worker in `src/main.tsx` with basic error handling.

> Note: `vite-plugin-pwa` was not installed because the sandbox does not have outbound network access. The project uses a handcrafted service worker that accomplishes the required caching and installability. When network access is available, you may optionally add `vite-plugin-pwa` for auto-generated Workbox integration.

## Build & Runtime Scripts

- Updated `package.json` scripts with `preview --port 5000` and `analyze:pwa` Lighthouse helper.
- Declared Node engine requirement `>=18.18.0` for Vercel compatibility.

## Environment Variables

- Added `.env.example` capturing required settings for the Supabase project `lhbowpbcpwoiparwnwgt`.
- `.gitignore` keeps local `.env` files private while allowing `.env.example` and `docs/env/env.sample` to be tracked.
- In Vercel: Settings → Environment Variables → add the following keys for Development, Preview, and Production:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_API_BASE`
  - `SUPABASE_SERVICE_ROLE_KEY` *(server only; keep out of the browser; do not prefix with `VITE_`)*
  - `VITE_ADMIN_TOKEN` / `ADMIN_TOKEN` / `EASYMO_ADMIN_TOKEN`
  - `ADMIN_SESSION_SECRET`, `ADMIN_ACCESS_CREDENTIALS`
  - `DISPATCHER_FUNCTION_URL`
  - Optional toggles (`NEXT_PUBLIC_USE_MOCKS`, `VITE_ENABLE_AGENT_CHAT`, reminder cron variables, etc.)
- Redeploy after updating secrets so both the public app and the admin panel pick up the new configuration.

## Local Verification

1. Install dependencies: `pnpm install`
2. Run the automated check: `pnpm exec node scripts/verify-pwa.mjs`
   - The script validates manifest/icon presence, service worker registration, runs `pnpm run build`, launches `pnpm run preview --port 5000`, and ensures it responds with HTTP 200.
   - Results are appended to this document under **Verification Run**.
3. Optional: `pnpm run analyze:pwa` to execute a Lighthouse PWA audit.

## Vercel Deployment Steps

1. Push the branch and open a PR (`chore/vercel-pwa-readiness`). After approval, merge to `main`.
2. In Vercel, select **New Project** → import this GitHub repository.
3. Framework detection: choose **Vite** (Build Command `pnpm run build`, Output Directory `dist`).
4. Configure Environment Variables (Development/Preview/Production):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`, `VITE_API_BASE`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_ADMIN_TOKEN` / `ADMIN_TOKEN` / `EASYMO_ADMIN_TOKEN`
   - `ADMIN_SESSION_SECRET`, `ADMIN_ACCESS_CREDENTIALS`
   - `DISPATCHER_FUNCTION_URL`
   - Optional toggles (`NEXT_PUBLIC_USE_MOCKS`, `VITE_USE_MOCK`, `VITE_DEV_TOOLS`, `VERCEL_REGION`, etc.)
5. Deploy. Static assets receive immutable caching; `manifest.json` and `service-worker.js` have tailored headers.
6. (Optional) Add a custom domain under **Settings → Domains**. HTTPS is automatic.
7. Rollback by selecting any deployment in Vercel → **Promote to Production**.

### Monorepo deployment tips

- Deploy the public SPA and the admin panel from their respective directories:
  - `cd app && vercel deploy --prod`
  - `cd admin-app && vercel deploy --prod`
- The repository root should **not** be deployed directly; doing so causes the
  CLI to inspect `supabase/functions/` and fails with “Function Runtimes must
  have a valid version” errors.
- Keep `vercel.json` at the root for shared rewrites/headers, but override any
  app-specific configuration inside each subproject as needed.

## Acceptance Checklist

- [ ] `pnpm exec node scripts/verify-pwa.mjs`
- [ ] `pnpm run build`
- [ ] `pnpm run preview -- --port 5000`
- [ ] Lighthouse PWA score ≥ 90 (`pnpm run analyze:pwa`)
- [ ] Vercel project uses `vercel.json` headers/rewrites
- [ ] Environment variables configured in Vercel
- [ ] Admin login succeeds on production (`/login` → `/dashboard`, cookie present)

## Troubleshooting

- **PWA won’t install** → Confirm `<link rel="manifest">`, valid icons, and that the service worker registers without errors (`navigator.serviceWorker` console logs).
- **404 on refresh** → Vercel rewrites in `vercel.json` must route `/(.*)` back to `/`.
- **Environment variable missing** → Ensure variables are added for all Vercel environments and redeploy.
- **Slow images** → Prefer optimized formats (WebP/AVIF) and leverage the immutable caching already set.
- **Stale app after deploy** → The service worker uses `skipWaiting`; ask users to refresh once or bump `CACHE_VERSION` in `public/service-worker.js` for immediate cache busting.


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
