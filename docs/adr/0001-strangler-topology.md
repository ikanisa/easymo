# ADR: Strangler Topology For Easymo Platform

- Status: Accepted
- Deciders: Platform Engineering
- Date: 2025-02-14

## Context

The current platform mixes application, API, and infrastructure assets inside monolithic folders such as [`admin-app/`](../../admin-app), [`apps/api/`](../../apps/api), [`supabase/`](../../supabase), and [`infrastructure/`](../../infrastructure). This layout makes it difficult to evolve new surfaces like a modern admin PWA or modular edge functions without risky big-bang rewrites.

To de-risk the migration we are adopting a strangler-fig topology. The new workspaces (`apps/admin-pwa`, `apps/app-apis`, `apps/router-fn`, `packages/ui`, `packages/clients`, `packages/config`, `packages/utils`, `infra/supabase`, `infra/ci`) will host incremental replacements that run alongside the existing systems until they are ready to take over.

## Decision

1. Introduce dedicated workspace folders for each target domain while keeping the legacy directories intact.
2. Add pnpm workspace and TypeScript project references so editors, CI, and builders are aware of the new projects without altering current build pipelines.
3. Provide configuration helpers in [`packages/config`](../../packages/config) that proxy today’s environment variables and expose feature-flag friendly accessors to orchestrate gradual cutovers.
4. Document the dual-topology plan here and inside each placeholder directory to guide future contributors.

## Consequences

- Teams can start shipping new functionality behind feature flags inside the strangler folders while continuing to serve production traffic from the legacy code paths.
- Build tooling recognises the new projects, enabling dependency graphing and pre-commit checks before any code is migrated.
- The coexistence period demands discipline to keep parity between old and new implementations, but it drastically reduces deployment risk compared to a full rewrite.
