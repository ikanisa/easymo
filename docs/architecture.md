# EasyMO Architecture Overview

EasyMO is composed of a collection of TypeScript and Deno services that expose
digital customer-care workflows across voice, WhatsApp, and the admin console.
The repository is organised as a pnpm workspace with the following pillars:

- **Client applications** (`src/`, `admin-app/`, `apps/voice-agent/`): React and
  Next.js front-ends that interact with the core APIs and Supabase Edge
  Functions.
- **APIs and services** (`apps/api`, `services/*`): NestJS- and Express-based
  services that orchestrate AI agents, telecom integrations, and marketplace
  flows. Shared logic and observability utilities are published via
  `@easymo/commons` and `@va/shared` packages.
- **Supabase Edge Functions** (`supabase/functions`): serverless business logic
  that powers WhatsApp automation, routing, and webhook processing.
- **Infrastructure and observability** (`infra/`, `.github/workflows/`): Docker
  recipes, CI workflows, and dashboards that define the deployment and runtime
  posture for the platform.

Key supporting components include:

- **Messaging orchestration** via Kafka and Redis (see `services/broker-*` and
  `services/voice-bridge`) for high-volume communication between agents,
  telephony, and back-office systems.
- **Database access** through the shared `@easymo/db` package which wraps Prisma
  migrations (PostgreSQL) and supplies runtime configuration helpers.
- **Observability** delivered through structured JSON logging, OpenTelemetry
  trace identifiers, and Lighthouse/SLO checks that are enforced in CI.

The architecture emphasises modularity—features are encapsulated in feature
folders and services, with shared contracts exported from `packages/` and
`supabase/`. All new code is expected to use the shared logging utilities from
`@easymo/commons` so that events can be correlated across services using
trace IDs propagated by the request middleware.
