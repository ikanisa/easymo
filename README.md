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
- **Vercel Configuration**: `vercel.json` rewrites API routes to the
  corresponding edge functions and configures them to run on Vercel’s
  Edge Runtime.

## Development Notes

1. Copy `.env.example` to `.env` and fill in your Supabase and admin
   credentials.  Never commit your service role key to version control.
2. Run `pnpm install` (or `npm install`) to install dependencies.
3. Start the development server with `pnpm dev`.  The admin panel will
   communicate with your Supabase project via the RealAdapter and Edge
   Functions.
4. To apply the database schema locally, install the Supabase CLI and run
   `supabase db push` inside the `easymo` directory.  Then execute the
   seed file via `supabase db query < supabase/seeders/phase2_seed.sql`.
5. Deploy edge functions via `supabase functions deploy --project-ref <ref>`,
   or let Vercel handle deployment if configured.

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

Vitest is used for unit tests.  Example tests for the `RealAdapter` are
provided in `src/lib/adapter.real.test.ts`.  Run `pnpm test` to execute
tests.

## Next Steps

This Phase 2 implementation lays the groundwork for a fully integrated
WhatsApp mobility platform.  Future enhancements could include:

- Adding tables and functions for campaigns, vouchers, stations,
  insurance quotes and audit logging.
- Implementing PostGIS geospatial queries for precise distance calculations.
- Extending the simulator to enforce credit usage and subscription
  expiration rules.
- Improving error handling and logging with structured outputs.
