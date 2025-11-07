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
- **Environment Variables**: `.env.example` now focuses on local hosting
  values including `APP_ENV`, `PORT`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- **Deployment Profile**: the internal release pipeline applies the rewrites
  and headers required for the admin panel and exposed API routes (see
  `docs/deployment/production-pipeline.md` for the full process).

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

## Local Setup (MacBook)

1. Install prerequisites via Homebrew: `brew install node pnpm supabase/tap/supabase`,
   then install local reverse proxy tooling by running `brew bundle --file=./Brewfile`
   from within `infra/mac`.
2. Clone this repository, then run `pnpm install` from the workspace root.
3. Duplicate `.env.example` to `.env` (shared defaults) and `.env.local`
   (Next.js-only overrides). Update every `CHANGEME_*` placeholder with your
   Supabase project reference and credentials.
4. Start Supabase locally with `supabase start` **or** configure the CLI to use
   a remote project (`supabase link --project-ref <ref>`). See [docs/local-hosting.md](docs/local-hosting.md)
   for the full workflow, including reverse proxy notes.
5. Launch the admin app with `pnpm dev` (Next.js) or `pnpm start` after a build
   to emulate the production bundle.

## Environment Variables

- `.env` holds settings shared by Node processes (Edge Functions, CLI tooling).
- `.env.local` is read only by Next.js at runtime—keep it out of version control
  to protect secrets during local development.
- Required values:
  - `APP_ENV` and `PORT` configure the admin runtime name and local port.
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` drive browser
    calls to Supabase.
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` mirror the `NEXT_PUBLIC_*`
    values for tooling (Cypress/Vitest) and must never contain service-role keys.
  - `VITE_SUPABASE_PROJECT_ID` stores the Supabase project ref (e.g.
    `vacltfdslodqybxojytc`) for diagnostics scripts.
  - `SUPABASE_SERVICE_ROLE_KEY` allows Edge Functions to bypass RLS; keep it on
    the server side.
  - `EASYMO_ADMIN_TOKEN` secures Supabase Edge Function routes.
  - `ADMIN_SESSION_SECRET` must be at least 16 characters to encrypt cookies.
- Optional helpers (`SUPABASE_DB_URL`, `DISPATCHER_FUNCTION_URL`, cron toggles,
  etc.) remain in `.env.example` for services that need them.

## Run Commands

- Install deps: `pnpm install`
- Shared packages: `pnpm --filter @va/shared build && pnpm --filter @easymo/commons build`
- Netlify build (same command used in CI): `pnpm netlify:build`
- Local dev server with hot reload: `pnpm dev`
- Production build: `pnpm build`
- Serve the compiled build: `pnpm start`
- Supabase connectivity check: `pnpm diagnostics:supabase [table_name]`
- Additional scripts for packages/services are documented in
  `docs/local-hosting.md` and individual service READMEs.

## Supabase Notes

- Add `http://localhost:3000` (or whatever `PORT` you set) to **Auth → URL
  configuration → Redirect URLs** and **API → Allowed CORS origins** in the
  Supabase dashboard. Include your tunnel/proxy hostnames if you expose the app
  beyond localhost.
- When using the local Supabase stack, the CLI injects matching service role and
  anon keys. For remote projects, create a `.env.local` using the dashboard’s
  `Project API` tab.
- Edge Functions expect the `EASYMO_ADMIN_TOKEN` header. Update the secret in
  both Supabase (project secrets) and your `.env`/`.env.local` files.
- The Supabase CLI stores credentials in `~/.config/supabase`. Run `supabase login`
  before `supabase link` to manage multiple environments.

## Platform Changes

- Removed `VERCEL_*` environment variables from `.env.example`; local hosting
  now depends on explicit Supabase and runtime values instead of platform
  defaults.
- We removed legacy hosting assumptions. Configure
  `NEXT_PUBLIC_APP_URL` (or rely on `localhost`) and update Supabase CORS origins
  manually.
- Added `.env.local` guidance plus [docs/local-hosting.md](docs/local-hosting.md)
  for pnpm-based builds (`pnpm install`, `pnpm build`, `pnpm start`) and reverse
  proxy placeholders to support self-hosting.
- Added first-class Netlify support via `netlify.toml` and the official Next.js
  plugin so the admin app deploys on a Node runtime without extra config.

## Deploying to Netlify

1. Connect this repository in the Netlify UI (New site → Import from Git).
2. Netlify reads `netlify.toml`; the important bits are:

   - `command`: `pnpm netlify:build` (builds shared workspaces then the admin app).
   - `publish`: `admin-app/.next`.
   - `[[plugins]]`: `@netlify/plugin-nextjs` so API routes become Netlify Functions.
   - `NETLIFY_USE_PNPM=true` and `NODE_VERSION=18.18.0` ensure the correct toolchain.

3. Configure the required environment variables under Site settings → Environment
   (mirrors the `.env` table above; never expose service-role keys in `NEXT_PUBLIC_*`).
4. `netlify dev` can simulate the build locally if you install the CLI
   (`npm install -g netlify-cli`).

## Development Notes

1. Copy `.env.example` to `.env` and fill in your Supabase and admin
   credentials.  Never commit your service role key to version control.
   - When enabling WhatsApp callbacks, set `WABA_PHONE_NUMBER_ID`,
     `WABA_ACCESS_TOKEN`, and `WA_APP_SECRET`; the backend now fails fast if
     these values are missing or left at defaults.
2. Run `pnpm install` to install workspace dependencies (`pnpm-workspace.yaml`
   wires `services/*` and `packages/*`).
3. Start the admin panel with `pnpm dev`.  The app talks to Supabase through
   the RealAdapter and Edge Functions once environment variables are present.
4. Apply the Supabase schema with `supabase db push`, then load the additive
   fixtures from `supabase/seed/fixtures/admin_panel_core.sql` and
   `supabase/seed/fixtures/admin_panel_marketing.sql`.  The legacy
   `supabase/seeders/phase2_seed.sql` remains available for quick smoke runs.
   After running new migrations or exporting the schema, run
   `pnpm schema:verify` to ensure `latest_schema.sql` (with its checksum marker)
   matches the contents of `supabase/migrations/**/*.sql`.
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
   or let Netlify handle deployment if configured.  Import the Grafana dashboards
   in `dashboards/phase4/*.json` and provision Kafka topics per
   `infrastructure/kafka/topics.yaml` during staging cut-overs.

## Package Manager

- Use `pnpm` (>=8) for all workspace installs and scripts. `npm install` / `npm audit fix` reintroduce TypeScript peer dependency conflicts between `typescript@5.9.x` and `typescript-eslint@8.x`.
- Install dependencies with `pnpm install` and run workspace scripts via `pnpm <script>`.

## Database Seeding (Remote)

1. Fetch the service-role connection string from Supabase Dashboard → Settings → Database and export it:
   ```bash
   export SUPABASE_DB_URL="postgresql://postgres:<password>@db.vacltfdslodqybxojytc.supabase.co:5432/postgres"
   ```
2. Run the Phase-2 seed fixture:
   ```bash
   pnpm seed:remote
   ```
   The script pipes `supabase/seeders/phase2_seed.sql` through `psql` with `ON_ERROR_STOP`, so it will fail fast if anything breaks.
3. If `psql` is not available, use the same SQL file inside the Supabase SQL editor or run:
   ```bash
   PGPASSWORD=<password> psql "postgresql://postgres@db.vacltfdslodqybxojytc.supabase.co:5432/postgres" \
     -v ON_ERROR_STOP=1 \
     -f supabase/seeders/phase2_seed.sql
   ```

## Development Ground Rules

**All development MUST follow the ground rules for observability, security, and feature flags.**

See [docs/GROUND_RULES.md](docs/GROUND_RULES.md) for comprehensive guidelines on:

- **Observability**: Structured logging, event counters, and metrics for all APIs and jobs
- **Security**: Secret management, webhook signature verification, and data protection
- **Feature Flags**: Controlling feature rollout with flags that default to OFF in production

Key principles:
- Use structured logs (JSON format) with correlation IDs
- Never expose secrets client-side (validated in `prebuild` script)
- Verify webhook signatures (WhatsApp, Twilio, etc.)
- Gate all new features behind feature flags
- Record metrics for significant actions
- Mask PII in all logs

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

## Setup
Copy env template:

```
cp .env.example .env
```
