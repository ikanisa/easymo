# Deployment Readiness Report

## Summary
- **Status**: Amber – Admin app requires verified Supabase + session secrets for production builds. Marketing web can deploy as static but depends on Supabase credentials for live data.  
- **Primary blockers**: Ensure Vercel env groups include all required secrets; verify downstream services (Nest microservices) have their own deployment targets (not Vercel).  
- **Actions completed**: Inventory, Vercel plan, env validation, CI parity workflow, preflight script, env templates.

## Inventory Highlights
- Package manager normalized to **pnpm** (`packageManager` metadata added, npm lockfiles removed).  
- Frontend apps: marketing web (`vite build -> dist`) and admin app (Next.js 14).  
- Services: 10+ NestJS/Express microservices require containerized deployment; not targeted for Vercel.  
- See [`audit/inventory.json`](audit/inventory.json) for the full matrix.

## Vercel Configuration
- Admin app uses `admin-app/vercel.json` (`pnpm build`, output `.next`).  
- Marketing web deploys as static output (`dist`) when Vercel project root points to repository root; consider a separate project.  
- Recommended: configure Vercel project rootDirectory=`admin-app` and connect secrets via Vercel Env Groups.  
- Root `vercel.json` removed; rely on per-app config.  
- Detailed notes in [`audit/vercel-plan.md`](audit/vercel-plan.md).

## Environment Management
- Env matrix recorded in [`audit/env-matrix.csv`](audit/env-matrix.csv).  
- `.env.example` added for marketing web and admin app with production-safe defaults.  
- New runtime validators:  
  - `src/env.ts` guards Vite flags + Supabase requirements.  
  - `admin-app/lib/env.server.ts` enforces Supabase + session secrets and normalizes URLs.  
- Downstream modules now consume typed env (runtime-config, session tokens, logging, Sentry, metrics).

## CI / Automation
- New workflow `.github/workflows/vercel-preview-build.yml` mirrors Vercel (Node 18, pnpm, `vercel pull` + `vercel build` in `admin-app`).  
- `scripts/vercel-preflight.mjs` ensures local parity (Node version, env completeness, preview build) before merging.

## Risks & Follow-ups
- Populate Vercel secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `ADMIN_SESSION_SECRET`, marketplace service URLs).  
- Confirm marketing web either uses mocks or receives its own Supabase credentials.  
- Back-end Nest services require separate CI/CD (Docker builds) – outside Vercel scope.  
- Ensure `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets exist in GitHub for the new workflow.

## Time to Green (Estimates)
- **Admin App**: Green once secrets configured and preview build verified (≈0.5 day).  
- **Marketing Web**: Green after Supabase anon key/URL added or mocks enabled (≈0.25 day).  
- **Microservices**: Out of Vercel scope; track separately.
