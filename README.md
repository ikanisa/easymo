
## Supported Countries

### ❌ NOT Supported (DO NOT USE)
- ~~KE~~ (Kenya) - Removed 2025-11-27
- ~~UG~~ (Uganda) - Removed 2025-11-27

**Default Country**: `RW` (Rwanda)

See [COUNTRIES.md](./COUNTRIES.md) for complete country documentation, feature availability, and compliance guidelines.

### Code Usage
```typescript
// ✅ CORRECT
const SUPPORTED_COUNTRIES = ['RW', 'CD', 'BI', 'TZ'];

// ❌ WRONG - NEVER USE
const countries = ['RW', 'KE', 'UG']; // NO!
```

**All database migrations, TypeScript code, and configuration must only use: RW, CD, BI, TZ**


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

## Local Setup

1. Install prerequisites: `pnpm` (≥10.18.3), Node 18.18+, and the Supabase CLI (`brew install supabase/tap/supabase` on macOS).
2. Clone this repository and install dependencies from the root: `pnpm install`.
3. Copy `.env.example` to `.env` (backend/shared) and `.env.local` (Next.js only),
   then populate every `CHANGEME_*` placeholder with your Supabase project values.
4. Start Supabase locally with `supabase start` or link to a remote project with
   `supabase link --project-ref <project-ref> && supabase db pull`.
5. Apply migrations and seed data (local stack):
   - `supabase db reset` to recreate the database from `supabase/migrations`.
   - `supabase db seed --file supabase/seeders/phase2_seed.sql` to load sample data.
6. Deploy the Edge Functions used by the admin API when targeting a remote project:
   - `pnpm functions:deploy` (core admin routes)
   - `pnpm functions:deploy:agents` (agent-specific helpers)
7. Launch the admin app:
   - Dev: `pnpm dev`
   - Production build + serve: `pnpm build && pnpm start`

## Environment Variables

| Variable | Purpose | Scope |
| --- | --- | --- |
| `APP_ENV` | Names the runtime (e.g., `local`, `staging`, `prod`) for logging. | `.env` |
| `PORT` | Admin app port (defaults to 3000). | `.env`, `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL for browser traffic. | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser anon key; **never** use the service role. | `.env.local` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Mirrors the `NEXT_PUBLIC_*` pair for tooling (Vitest/Cypress). | `.env`, `.env.local` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref used by diagnostics scripts. | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key used only by Edge Functions. | `.env` |
| `EASYMO_ADMIN_TOKEN` | Shared secret validated by admin Edge Functions. | `.env`, `.env.local` |
| `ADMIN_SESSION_SECRET` | 16+ chars to encrypt cookies in the admin app. | `.env` |

Optional helpers such as `SUPABASE_DB_URL`, `DISPATCHER_FUNCTION_URL`, and cron toggles
remain in `.env.example` for services that require them.

## Run Commands

- Install deps: `pnpm install`
- Local dev server with hot reload: `pnpm dev`
- Production build: `pnpm build`
- Serve the compiled build: `pnpm start`
- Netlify build (CI-equivalent): `pnpm netlify:build`
- Deploy Edge Functions: `pnpm functions:deploy` or `pnpm functions:deploy:agents`
- Supabase connectivity check: `pnpm diagnostics:supabase [table_name]`
- Reset local database: `supabase db reset && supabase db seed --file supabase/seeders/phase2_seed.sql`

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

## Supabase MCP Server

LLM tooling that speaks the [Model Context Protocol](https://modelcontextprotocol.io/)
(Cursor, Windsurf, Claude desktop/code, Cline, etc.) can inspect this Supabase
project via the official `@supabase/mcp-server-supabase` bridge.

1. [Generate a Supabase personal access token](https://supabase.com/dashboard/account/tokens)
   dedicated to MCP usage. Grant only the projects you need.
2. Export the environment expected by the helper script:

   ```bash
   export SUPABASE_MCP_ACCESS_TOKEN=<your-pat>
   export SUPABASE_MCP_PROJECT_REF=<project-ref> # lhbowpbcpwoiparwnwgt for dev
   # VITE_SUPABASE_PROJECT_ID already stores the same ref for local tooling.
   ```

3. (Optional) Toggle behavior with:
   - `SUPABASE_MCP_READ_ONLY=false` to allow write queries (defaults to read-only).
   - `SUPABASE_MCP_EXTRA_ARGS="--schema public"` to pass additional CLI flags.
4. Run the server whenever your MCP client asks for it:

   ```bash
   pnpm mcp:supabase
   ```

   or call the script directly with inline env variables for one-offs:

   ```bash
   SUPABASE_MCP_ACCESS_TOKEN=pat SUPABASE_MCP_PROJECT_REF=lhbowpbcpwoiparwnwgt pnpm mcp:supabase
   ```

5. Point your MCP client at the spawned process. For example, Cursor’s
   `.cursor/mcp.json` entry would be:

   ```json
   {
     "mcpServers": {
       "supabase": {
         "command": "pnpm",
         "args": ["mcp:supabase"],
         "env": {
           "SUPABASE_MCP_ACCESS_TOKEN": "pat",
           "SUPABASE_MCP_PROJECT_REF": "lhbowpbcpwoiparwnwgt"
         }
       }
     }
   }
   ```

Review Supabase’s [MCP security best practices](https://supabase.com/docs/guides/getting-started/mcp#security-risks)
before granting write access or sharing tokens.

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
   fixtures from `supabase/seed/fixtures/admin_panel_core.sql`.  The legacy
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

## Deprecated Feature Guard

Legacy promo flows have been fully decommissioned. The guard script
(`pnpm guard:deprecated`) scans runtime code for prohibited tokens and fails if
they reappear outside the historical Supabase schema. Pre-commit hooks invoke
the same check automatically.

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

- Adding tables and functions for stations,
  insurance quotes and audit logging.
- Implementing PostGIS geospatial queries for precise distance calculations.
- Extending the simulator to enforce credit usage and subscription
  expiration rules.
- Improving error handling and logging with structured outputs.
- Tracking the deferred inventory console rebuild; see
  [`docs/inventory-app-assessment.md`](docs/inventory-app-assessment.md) for the
  guardrails and roadmap impact.【F:docs/inventory-app-assessment.md†L1-L44】

## macOS Code Signing (Desktop Apps)

EasyMO includes **two macOS desktop applications** (Admin Panel + Client/Staff Portal) that require code signing for distribution. We provide a complete, production-ready signing infrastructure.

### 🚀 Quick Start (5 minutes)

```bash
# 1. Read the quick start guide
open SIGNING_QUICK_START.md

# 2. Create certificate (via Keychain Access GUI - see guide)
# 3. Verify setup
./scripts/check_certificate.sh

# 4. Sign both apps
./scripts/sign_all_apps.sh

# 5. Verify signatures
./scripts/verify_apps.sh
```

### 📚 Documentation

- **[SIGNING_QUICK_START.md](./SIGNING_QUICK_START.md)** - 5-minute setup guide
- **[docs/internal_mac_signing.md](./docs/internal_mac_signing.md)** - Complete reference
- **[docs/github_actions_signing.md](./docs/github_actions_signing.md)** - CI/CD automation
- **[docs/SIGNING_REFERENCE.md](./docs/SIGNING_REFERENCE.md)** - Master index

### 🔧 Scripts

```bash
./scripts/list_identities.sh      # List signing certificates
./scripts/check_certificate.sh    # Verify certificate setup
./scripts/sign_all_apps.sh         # Sign both apps (main entry point)
./scripts/verify_apps.sh           # Verify signatures
./scripts/test_signing_workflow.sh # Run test suite
```

See [scripts/README.md](./scripts/README.md) for all available scripts.

### 🤖 CI/CD (GitHub Actions)

Automated signing workflow at `.github/workflows/macos-signing.yml` triggers on:
- Version tags (`git push --tags v1.0.0`)
- Manual dispatch (Actions tab in GitHub)
- PR changes to signing scripts (validation only)

**Features:** Automated signing, DMG creation, secure certificate storage, notarization-ready.

See [docs/github_actions_signing.md](./docs/github_actions_signing.md) for setup instructions.

---

## Setup
Copy env sample:

```
cp .env.example .env
```
