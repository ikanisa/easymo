# Architecture Overview

This document summarises the end-to-end architecture for the easyMO platform and
captures how the new observability and deployment foundations fit into the
existing services.

## High-Level System Diagram

```
┌────────────────────┐        ┌───────────────────────┐
│ React + Vite SPA   │ <────> │ Next.js App Router    │
│ (`src/`, Netlify)   │        │ (`app/`, Netlify)      │
└────────────────────┘        └─────────────┬─────────┘
                                            │
                                            │ Edge/API routes
                                            ▼
                                    ┌─────────────┐
                                    │ Supabase    │
                                    │ (Postgres + │
                                    │  Auth + RLS)│
                                    └─────┬───────┘
                                          │
                                          │ Functions & Jobs
                                          ▼
                             ┌──────────────────────────┐
                             │ Supabase Functions       │
                             │ (TypeScript/Deno)        │
                             └────────┬─────────────────┘
                                      │
                                      ▼
                             ┌──────────────────────────┐
                             │ Background Services      │
                             │ (`services/`, containers)│
                             └──────────────────────────┘
```

### Front-End Clients
- **Mobility Admin SPA (`src/`)** – Built with Vite, React Router, and shared
  design system packages. Deployed to Netlify or a static host.
- **Next.js App Router (`app/`)** – Hosts authenticated admin APIs used by the
  SPA and Supabase Functions. Runs on Netlify and reuses the shared logging
  helpers in `app/api/_lib/observability.ts`.

### Backend & Data Plane
- **Supabase (Postgres + Auth)** – Provides the canonical data store,
  row-level security policies, and RPC functions. Migrations live under
  `supabase/migrations/` and are checked in CI via
  `infra/ci/supabase-migrations.yml`.
- **Supabase Functions** – Deno-based background jobs and webhooks living in
  `supabase/functions/`. Preview deployments run automatically in the
  `Preview Deployments` workflow.
- **Services (`services/` and `apps/`)** – Containerised services that depend on
  the same Supabase instance. Their telemetry integrates through shared OTEL
  components but are operated separately from the web deployment pipeline.

### Observability & Logging
- **API logging** – All App Router handlers opt-in to
  `withRouteInstrumentation` from `app/api/_lib/observability.ts`. Requests are
  wrapped in an `AsyncLocalStorage` scope that:
  - Emits structured JSON logs via `pino` with consistent `traceId` and
    `spanId` values.
  - Ships request summaries to optional drains (`LOG_DRAIN_URL` and
    `METRICS_DRAIN_URL`).
  - Tracks SLO samples for latency (`API_LATENCY_SLO_MS`, default 500 ms) and
    error budget consumption (`API_ERROR_BUDGET`, default 0.01).
- **Router telemetry** – The SPA registers `RouteObserver` inside
  `src/routes/AppRoutes.tsx`. It logs navigation start/complete events via
  `browserLogger` (`src/lib/observability/browser.ts`), preserves a session
  trace ID, and pushes metrics to the optional drains configured by
  `VITE_ROUTER_LOG_DRAIN_URL`/`VITE_ROUTER_METRICS_DRAIN_URL`.
- **SLO catalogue** – The API helper exports `sloCatalogue` while the client
  exposes `routerSloConfig`. Dashboards reference these values to stay in sync
  with code.

### CI/CD Overview
- `infra/ci/app-quality.yml` – Ensures linting, type-checking, testing, and
  builds succeed for every PR.
- `infra/ci/supabase-migrations.yml` – Validates Supabase migrations remain in
  sync with the linked preview project using Supabase CLI drift checks.
- `infra/ci/lighthouse.yml` – Runs Lighthouse against the built SPA to spot
  regressions in accessibility, performance, best practices, and SEO.
- `infra/ci/preview-deploy.yml` – Produces Netlify preview deployments and rolls
  Supabase Functions to the preview project, posting links to the job summary.

All workflows live under `infra/ci/` for discoverability and are symlinked into
`.github/workflows/` so GitHub Actions can execute them directly.

## Shared Libraries
- **`app/api/_lib/observability.ts`** – API logging, trace propagation, drain
  emission, and helper utilities for child spans.
- **`src/lib/observability/browser.ts`** – Browser-side structured logging,
  navigation SLO sampling, and preview drain emission helpers.
- **`src/routes/RouteObserver.tsx`** – React hook component that wires router
  events into the browser logger.

These modules centralise telemetry concerns so handlers and components avoid
copying logging boilerplate.

## Data Flows
1. User requests are routed through Netlify to App Router handlers which
   authenticate via Supabase headers and produce structured logs.
2. Handlers interact with Supabase (`supabase-js` service clients) or edge
   functions and return JSON responses via `jsonOk/jsonError`.
3. Logs fan out to console (for Netlify log drains) and optional HTTP drains
   configured in environment variables.
4. Front-end navigation instrumentation emits session-level metrics ensuring
   router performance regressions surface alongside API dashboards.

## Environment Boundaries
- **Local** – `.env.local` (not committed) drives local CLI runs. Observability
  drains can point to tools like `vector.dev` or `Grafana Loki`.
- **Preview** – Netlify preview deployments and Supabase preview projects use
  dedicated secrets managed through Netlify/Supabase dashboards. The preview
  workflow assumes `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and
  `SUPABASE_FUNCTIONS_PREVIEW_REF` are present.
- **Production** – Deployments promote the preview artefact after sign-off,
  ensuring logs and metrics align with the documented SLOs.

Refer to `docs/runbook.md` for operational procedures and
`docs/rollout.md` for release sequencing.
