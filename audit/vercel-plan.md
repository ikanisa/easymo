# Vercel Deployment Plan

## Projects Overview

| Project | Root Directory | Install Command | Build Command | Output Directory | Runtime |
|---------|----------------|-----------------|---------------|------------------|---------|
| Marketing Web (Vite) | `.` | `pnpm install --frozen-lockfile` | `pnpm build` | `dist` | Static |
| Admin App (Next.js) | `admin-app` | `pnpm install --frozen-lockfile` | `pnpm build` | `.next` (standalone) | Node.js 18 |

- Enable [Corepack](https://nodejs.org/api/corepack.html) in build environments to guarantee pnpm availability.
- Set the Vercel project Node version to **18.x** and pin `PNPM_HOME` via `corepack`.  
- Disable automatic framework detection for non-web services; deploy them separately (Fly.io/Render/Kubernetes) via Docker images.

## Marketing Web (Vite)
- **Framework**: Vite + React (SPA).  
- **Build output**: `dist`. Configure Vercel project as a static site.  
- **Environment**: requires Supabase anon key + optional feature toggles validated via `src/env.ts`.  
- **Post-build**: No server functions. Use Vercel Edge Network static hosting.

## Admin App (Next.js 14)
- **Framework**: Next.js App Router with route handlers.  
- **Build**: `pnpm build` (runs `next build`).  
- **Output**: `.next/standalone` with automatically generated serverless functions.  
- **Install**: `pnpm install --frozen-lockfile` after `corepack enable`.  
- **Env**: Production builds require Supabase credentials, session secrets, and marketplace service URLs validated via `lib/env.server.ts`.  
- **Images**: No custom domains yet; default configuration suffices.  
- **Edge**: Keep all route handlers on Node.js runtime (no `runtime: 'edge'`).

## Preview & Production Settings
- Run `vercel pull --yes --environment={preview|production}` before builds to hydrate env files.  
- Configure [Deployment Protection](https://vercel.com/docs/concepts/deployments/deployment-protection) secrets via `VERCEL_AUTOMATION_BYPASS_SECRET` if gating previews.  
- Ensure the GitHub Action mirrors Vercel settings (Node 18, pnpm install, `vercel build`).

## Redirects/Rewrites
- Legacy rewrites live in `admin-app/vercel.json`. Keep API route rewrites consolidated there. Remove root-level `vercel.json` once Vercel project rootDirectory is set to `admin-app`.

## Environment Promotion
- Maintain `.env.example` files at the app level and sync Vercel env groups via `vercel env pull`.  
- Use the preflight script before merges to catch missing env/config mismatches.
