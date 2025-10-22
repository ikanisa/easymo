# EasyMO Phase 2 Implementation

This repository contains the implementation for Phase 2 of the EasyMO admin panel
and WhatsApp mobility backend.  The goal of this phase is to replace the
mocked API used during Phase 1 with Supabase Edge Functions backed by a
relational database with row‑level security.  The admin panel runs as a
Vite React app and communicates with those Edge Functions through the
`RealAdapter` class.

## Key Features

- **RealAdapter** (`src/lib/adapter.real.ts`): delegates to the `AdminAPI`
  helper which calls Supabase Edge Functions secured by an admin token.
  This keeps the Supabase service role key server-side while exposing a
  simple asynchronous API for settings, users, trips, subscriptions and
  simulator workflows.
- **Supabase Edge Functions**: located under `supabase/functions`, these
  functions handle admin API requests.  Each function verifies an
  `x-api-key` header against `EASYMO_ADMIN_TOKEN` and uses the service
  role key to bypass RLS for writes.  Functions include:
  - `admin-settings`: get/update settings
  - `admin-stats`: compute operational metrics
  - `admin-users`: list users and derive subscription status
  - `admin-trips`: list trips or close a trip
  - `admin-subscriptions`: list, approve or reject subscriptions
  - `simulator`: simulate driver/passenger operations
- **Database Schema & Migrations**: see
  `supabase/migrations/20251112100000_phase2_init.sql` for the Phase 2
  schema.  New tables include `settings`, `profiles`, `driver_presence`,
  `trips` and `subscriptions`.  Row level security is enabled on all
  tables with permissive read policies and restrictive write policies.
- **Seeding**: a development seed file (`supabase/seeders/phase2_seed.sql`)
  inserts example settings, profiles, driver presence rows, trips and
  subscriptions for local testing.
- **Environment Variables**: `.env.example` documents all required
  variables such as `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
  `EASYMO_ADMIN_TOKEN`.
- **Deployment Configuration**: the admin APIs are exposed through Supabase
  edge functions; ensure your hosting platform forwards `/api/*` requests to
  the Supabase functions layer.

## Phase 4 & 5 Highlights

- **Realtime bridges**: `services/voice-bridge` ingests Twilio Media Streams,
  relays audio to the OpenAI Realtime API, emits Kafka telemetry, and exposes a
  `/analytics/live-calls` snapshot consumed by the admin console. `services/sip-ingress`
  normalises SIP webhook events with Redis-backed idempotency.
- **Marketplace & wallet services**: new microservices (`wallet-service`,
  `ranking-service`, `vendor-service`, `buyer-service`, `broker-orchestrator`)
  coordinate intents → quotes → purchases and double-entry ledger postings.
- **Admin console upgrades**: the Next.js panel now ships dedicated surfaces for
  live call monitoring, lead management (opt-in/tag updates via Agent-Core), and
  marketplace oversight (vendor ranking, intent pipeline, purchase audits). The
  UI remains PWA-ready with offline awareness and CSV exports.
- **Testing & observability**: acceptance tests cover ledger invariants,
  payment helpers (MoMo USSD / Revolut), opt-out flows, and ranking logic. New
  Grafana-ready dashboards (`dashboards/phase4/*.json`) and Kafka topic manifests
  document the expanded footprint.

## Development Notes

1. Copy `.env.example` to `.env` and fill in your Supabase and admin
   credentials.  Never commit your service role key to version control.
2. Run `pnpm install` to install workspace dependencies (`pnpm-workspace.yaml`
   wires `services/*` and `packages/*`).
3. Start the admin panel with `pnpm dev`.  The app talks to Supabase through
   the RealAdapter and Edge Functions once environment variables are present.
4. Apply the Supabase schema with `supabase db push`, then load the additive
   fixtures from `supabase/seed/fixtures/admin_panel_core.sql` and
   `supabase/seed/fixtures/admin_panel_marketing.sql`.  The legacy
   `supabase/seeders/phase2_seed.sql` remains available for quick smoke runs.
5. Bootstrap the Phase 4/5 workspace: `pnpm --filter @easymo/db prisma:migrate:dev`
   against the Agent-Core Postgres URL, then `pnpm --filter @easymo/db seed` to
   generate tenants, agent configs, leads, intents, wallet accounts, and sample
   quotes/purchases.
6. Bring up dependencies with `docker compose -f docker-compose.agent-core.yml up`.
   This runs Postgres, Redis, Kafka, and dev instances for voice bridge, SIP
   ingress, wallet, ranking, vendor, buyer, WhatsApp bot, broker orchestrator,
   and Agent-Core.  Each service can also be launched individually via
   `pnpm --filter @easymo/<service> start:dev`.
7. Run the acceptance suites when wiring integrations:  
   `pnpm --filter @easymo/wallet-service test`,  
   `pnpm --filter @easymo/ranking-service test`,  
   `pnpm --filter @easymo/vendor-service test`,  
   `pnpm --filter @easymo/buyer-service test`, and  
   `pnpm --filter @easymo/agent-core test`.  Tests cover payment helpers
   (MoMo USSD / Revolut), opt-out flows, intent/quote ranking, and ledger
   invariants.
8. Deploy Supabase edge functions via `supabase functions deploy --project-ref <ref>`,
   then promote the updated container/image through your hosting platform. Import the Grafana dashboards
   in `dashboards/phase4/*.json` and provision Kafka topics per
   `infrastructure/kafka/topics.yaml` during staging cut-overs.

## Package Manager

- Use `pnpm` (>=8) for all workspace installs and scripts. `npm install` / `npm audit fix` reintroduce TypeScript peer dependency conflicts between `typescript@5.9.x` and `typescript-eslint@8.x`.
- Install dependencies with `pnpm install` and run workspace scripts via `pnpm <script>`.

## Database Seeding (Remote)

1. Fetch the service-role connection string from Supabase Dashboard → Settings → Database and export it:
   ```bash
   export SUPABASE_DB_URL="postgresql://postgres:<password>@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres"
   ```
2. Run the Phase-2 seed fixture:
   ```bash
   pnpm seed:remote
   ```
   The script pipes `supabase/seeders/phase2_seed.sql` through `psql` with `ON_ERROR_STOP`, so it will fail fast if anything breaks.
3. If `psql` is not available, use the same SQL file inside the Supabase SQL editor or run:
   ```bash
   PGPASSWORD=<password> psql "postgresql://postgres@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres" \
     -v ON_ERROR_STOP=1 \
     -f supabase/seeders/phase2_seed.sql
   ```

## Testing

Vitest is used for admin panel unit tests (`src/lib/adapter.real.test.ts`, etc.).
Run `pnpm test` for the SPA, and rely on the per-package Jest suites noted above
for the realtime and marketplace services.

## Next Steps

This Phase 2 implementation lays the groundwork for a fully integrated
WhatsApp mobility platform.  Future enhancements could include:

- Adding tables and functions for campaigns, vouchers, stations,
  insurance quotes and audit logging.
- Implementing PostGIS geospatial queries for precise distance calculations.
- Extending the simulator to enforce credit usage and subscription
  expiration rules.
- Improving error handling and logging with structured outputs.
