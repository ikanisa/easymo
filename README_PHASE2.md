# EasyMO Phase 2 Implementation

This repository contains the implementation for Phase 2 of the EasyMO admin panel
and WhatsApp mobility backend.  The goal of this phase is to replace the
mocked API used during Phase 1 with a fully functional Supabase back end,
leveraging Supabase’s relational database, row‑level security and edge
functions.  The admin panel runs as a Vite React app and communicates
directly with Supabase Edge Functions and the database through the
`RealAdapter` class.

## Key Features

- **RealAdapter** (`src/lib/adapter.real.ts`): rewritten to use the Supabase
  client (`@supabase/supabase-js` v2) instead of REST endpoints.  It reads
  configuration from environment variables and exposes methods for
  retrieving and updating settings, listing users and trips, managing
  subscriptions and performing simulator operations.
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
  `supabase/migrations/20251017150000_phase2_init.sql` for the Phase 2
  schema.  New tables include `settings`, `profiles`, `driver_presence`,
  `trips` and `subscriptions`.  Row level security is enabled on all
  tables with permissive read policies and restrictive write policies.
- **Seeding**: a development seed file (`supabase/seeders/phase2_seed.sql`)
  inserts example settings, profiles, driver presence rows, trips and
  subscriptions for local testing.
- **Environment Variables**: `.env.example` documents all required
  variables such as `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
  `EASYMO_ADMIN_TOKEN`.
- **Deployment Configuration**: Supabase edge functions drive API routing;
  ensure your hosting environment forwards `/api/*` traffic to the Supabase
  functions layer.

## Development Notes

1. Copy `.env.example` to `.env` and fill in your Supabase and admin
   credentials.  Never commit your service role key to version control.
2. Run `pnpm install` (or `npm install`) to install dependencies.
3. Start the development server with `pnpm dev`.  The admin panel will
   communicate with your Supabase project using the RealAdapter.
4. To apply the database schema locally, install the Supabase CLI and run
   `supabase db push` inside the `easymo` directory.  Then execute the
   seed file via `supabase db query < supabase/seeders/phase2_seed.sql`.
5. Deploy edge functions via `supabase functions deploy --project-ref <ref>`,
   then publish the updated build through your hosting provider.

## Testing

Vitest is used for unit tests.  Example tests for the `RealAdapter` are
provided in `src/lib/adapter.real.spec.ts`.  Run `pnpm test` to execute
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