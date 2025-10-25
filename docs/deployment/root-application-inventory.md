# Root Application Inventory

This catalog tracks every application surface that lives at the repository root.
It captures framework details, routing strategy, and the expected production
deployment so Vercel/other operators can map projects correctly.

| Directory | Stack | Purpose | Typed routing status | Production deployment |
| --- | --- | --- | --- | --- |
| `/` (Mobility Admin SPA) | Vite + React Router + TypeScript | Primary mobility operator dashboard served as a SPA. | ✅ Uses `@va/shared` route helpers; NotFound view now consumes `appRoutePaths.dashboard` to enforce typed navigation. | Vercel project with root directory `.` (build command `pnpm run build`, output `dist`). |
| `/admin-app` | Next.js App Router + TypeScript | Admin control panel with server components and API routes. | ✅ Uses `@va/shared` admin route helpers; navigation menus consume `NavigableAdminRoutePath` for typed `Link`/`href`. | Deployed via the internal release pipeline (framework preset `Next.js`). |
| `/angular` | Angular CLI scaffold | Historical Angular prototype. No active routes or deployment footprint. | ⚪️ No typed routing — skeleton only; enable once real routes exist. | Not deployed; exclude from production targets. |
| `/station-app` | Planned high-contrast PWA | Placeholder for station voucher redemption PWA. | ⚪️ No router yet — postpone typed routing until implementation begins. | Not deployed; backlog item before promotion. |
| `/apps/*` (NestJS services) | NestJS/Express | Voice/agent microservices powering telephony flows. | N/A — server HTTP handlers; typed web routing handled by Nest decorators. | Deploy via container services (not Vercel). |
| `/services/*` (Go/Node workers) | Mixed (TypeScript, Go) | Background and API services for marketplace, wallet, etc. | N/A — RPC/REST services with their own transport typing. | Deployed to internal infrastructure (non-Vercel). |

## Deployment Notes

- Maintain two deployment targets: one for the SPA at repo root and another
  targeting `admin-app`. Shared rewrites now live in the infrastructure repo—keep
  them aligned with `docs/deployment/production-pipeline.md`.
- Record project IDs/domains in `docs/deployment/status/` updates so reviewers
  can confirm which artifacts represent production surfaces.
- If additional root-level apps appear, append them to this table together with
  typed routing status and deployment owner.
