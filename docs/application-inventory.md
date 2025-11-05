# Application Inventory

This document enumerates the applications that live at the root of the EasyMO monorepo, the routing strategy applied to each one, and their expected deployment targets.

## Frontend surfaces

| Application | Location | Tech stack | Typed routing status | Deployment target |
| --- | --- | --- | --- | --- |
| Admin SPA (Phase 2) | `/` (`package.json`, `src/`) | Vite + React + React Router | ✅ Uses shared `@va/shared` route definitions for strongly typed navigation helpers. | Not deployed; consumed via local tooling and Supabase functions. |
| Admin App (Phase 4/5) | `/admin-app` | Next.js 14 App Router | ✅ Next.js typed routes enabled and wrapped helpers expose `Route`-aware navigation utilities. | Deployed via the internal release pipeline. |
| Station PWA shell | `/station-app` | Planned PWA (no framework wired) | 🚧 No routes exist yet; typed routing will be introduced with the first navigable screen. | Not yet deployed. |

### Typed routing notes

- The Vite admin SPA consumes route keys and helpers exported from `packages/shared/src/routes/app.ts`, ensuring that navigation can only target known paths and that required params are enforced at compile time.
- The Next.js admin app now opts into framework-level typed routes and surfaces `toAdminRoute`/`getAdminRoutePath` helpers that return `Route`-compatible strings for `<Link>` usage and router redirects.
- The station operator PWA does not expose navigable pages yet; once flows land we can either reuse the shared route utilities or adopt framework-native typed routing.

## Backend and realtime services

| Service | Location | Purpose | Routing applicability | Deployment notes |
| --- | --- | --- | --- | --- |
| Agent Core API | `/apps/agent-core` | NestJS orchestration service for AI agents | N/A – HTTP/WS handlers defined programmatically rather than declarative routes. | Runs via workspace scripts / Docker (see `docker-compose.agent-core.yml`).【F:apps/agent-core/package.json†L1-L22】【F:docker-compose.agent-core.yml†L1-L82】 |
| Voice API | `/apps/api` | NestJS voice control plane | N/A – Programmatic route handlers. | Docker/Node service managed alongside agent-core.【F:apps/api/package.json†L1-L30】【F:docker-compose.agent-core.yml†L1-L82】 |
| SIP Webhook | `/apps/sip-webhook` | Twilio SIP ingress handler | N/A – Event-driven handlers. | Ships as Node service via workspace scripts.【F:apps/sip-webhook/package.json†L1-L26】 |
| Voice Bridge | `/apps/voice-bridge` | WS bridge to OpenAI Realtime | N/A – WebSocket server. | Deployed as container/Node service.【F:apps/voice-bridge/package.json†L1-L24】 |
| Marketplace, wallet, ranking, vendor, buyer, broker, attribution, WhatsApp bot, reconciliation, SIP ingress (services/*) | `/services/*` | Microservices backing the marketplace, wallet ledger, realtime ingestion, and messaging flows | N/A – Each exposes REST/WS endpoints via NestJS/Fastify; no declarative front-end router. | Brought up together through Docker Compose; see `docker-compose.agent-core.yml` for port and dependency wiring.【F:docker-compose.agent-core.yml†L1-L120】 |

## Deployment targets

- **Release pipeline** builds the Next.js admin app exclusively. The infrastructure manifests point the builder at `admin-app/next.config.mjs`, ensuring other workspaces are not accidentally deployed as production frontends.
- **Containerised services** (agent core, voice bridge, SIP ingress, marketplace stack) are orchestrated locally and in staging via `docker-compose.agent-core.yml`, clarifying which services form the production backend surface.
- Frontend experiment (`station-app`) remains out of band and is not wired into any automated deployment target until its roadmap resumes.
