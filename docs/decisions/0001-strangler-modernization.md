# ADR 0001: Strangler Modernization Topology

- **Date:** 2025-02-15
- **Status:** Accepted

## Context

The current Easymo monorepo routes most product surfaces through a handful of legacy entry points:

- `admin-app/` hosts the Next.js powered admin console.
- `apps/api/` serves the HTTP/REST endpoints for both first- and third-party clients.
- `services/*` and `infrastructure/` contain bespoke operational scripts and background workers.
- Database assets live under `supabase/` and are mirrored inside `infrastructure/` migrations.

The modernization initiative introduces new surfaces that must coexist without destabilizing the running system. We are applying the strangler fig pattern so that new capabilities can launch beside the old ones while we gradually reroute traffic.

## Decision

1. Introduce explicit workspaces for the future stack:
   - Front-end: `apps/admin-pwa/`
   - API routers: `apps/router-fn/`
   - Modular HTTP services: `apps/app-apis/`
   - Shared packages: `packages/config/`, `packages/ui/`, `packages/clients/`, `packages/utils/`
   - Infrastructure: `infra/supabase/`, `infra/ci/`
2. Wire each workspace into `pnpm` and the TypeScript project graph (`tsconfig.strangler.json`) so tooling recognises them even while they only contain placeholders.
3. Centralise strangler feature flags and endpoint aliases inside `packages/config/` so both the legacy (`admin-app/`, `apps/api/`, `services/*`) and new surfaces can check the same rollout switches.
4. Capture modernization rationale and migration choreography inside `docs/` (this ADR plus future notes) to keep implementation and operations aligned.

## Consequences

- **Coexistence plan:**
  - Feature flags default to the legacy behaviour and must be explicitly enabled before new routes run.
  - Legacy directories remain the source of truth until the feature flags are flipped and parity tests pass.
  - Each placeholder README describes how its area will progressively absorb functionality from the matching legacy directory.
- **Tooling impact:**
  - TypeScript and pnpm no longer need ad-hoc configuration changes when the first files land in the new workspaces.
  - `tsconfig.strangler.json` provides an opt-in project reference graph that can be used for isolated builds without touching the production pipeline.
- **Documentation:**
  - Future ADRs should link back here when they graduate a feature out of the legacy directories.
  - Runbooks in `docs/` must call out which feature flags gate which pieces of infrastructure during the migration.

## Links

- Legacy admin console: [`admin-app/`](../../admin-app)
- Legacy API: [`apps/api/`](../../apps/api)
- Legacy background services: [`services/`](../../services)
- Legacy infrastructure scripts: [`infrastructure/`](../../infrastructure)
- Legacy database migrations: [`supabase/`](../../supabase)
