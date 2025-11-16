# Changelog

All notable changes to this repository are documented here.

## 2025-11-20 – Supabase onboarding refresh

- Added Supabase-first Quickstart and README instructions covering env vars, CLI setup, migrations, seeds, and function deploys.
- Published an admin invitation/access guide (`docs/admin-access-guide.md`) describing roles, token rotation, and revocation steps.
- Breaking: Removed legacy cleanup-era Quickstart content and rollback guidance; follow the new setup flow when configuring environments.
- Breaking: Local database resets now rely on `supabase db reset` plus `supabase/seeders/phase2_seed.sql`; older seed paths are no longer referenced.
- Removal: Deprecated `CLEANUP_*` progress notes are no longer linked from onboarding docs.

## 2025-10-22 – WhatsApp calling API alignment

- Added `waCalls` controller metadata to `@easymo/commons` so helper utilities resolve `/wa/webhook` (GET) and `/wa/events` (POST).
- Published reusable WhatsApp calling event schema + parser under `@va/shared/wa-calls`.
- Updated Nest controller to rely on shared helpers and validate incoming call events.
- Filtered webhook messaging topics to POST-only endpoints to avoid emitting verification paths.
- Documentation now references the `/wa/events` route for realtime call updates.

Migration notes
- Update any outbound integrations to post call events to `POST /wa/events` and consume the `webhooks.waCalls.events` topic.
- If you ingest WhatsApp call events, switch to `parseWaCallEvent` (from `@va/shared/wa-calls`) for validation before invoking business logic.
- Regenerate service endpoint caches/seeds if you mirror `ServiceEndpointRecord` data — new entries exist for the `waCalls` controller.

## 2025-10-21 – Supabase consolidation

- Breaking: Consolidated duplicate Supabase trees. The canonical tree is now `supabase/`.
  - Removed the deprecated mirror at `easymo/supabase/`.
  - Moved tests, migrations, and seeds to `supabase/` equivalents:
    - `supabase/functions/tests/*`
    - `supabase/migrations/20251112090000_phase2_mobility_core.sql`
    - `supabase/migrations/20251112091000_phase2_mobility_rls.sql`
    - `supabase/seed/fixtures/phase_b_seed.sql`
- Updated scripts and docs to reference canonical paths:
  - `tools/deploy_supabase_functions.sh` discovers only `supabase/functions/*`.
  - `docs/runbook.md` migration/seed commands now use `supabase/*` paths.
  - `package.json` test script now runs Deno tests from `supabase/functions/tests`.
- CI/openapi: Added OpenAPI lint workflow and published spec copies under `apispec/`, `admin-app/public/openapi.yaml`, and `public/openapi.yaml`.

Migration notes
- Update any local scripts or docs that referenced `easymo/supabase/*` to `supabase/*`.
- Optional validation:
  - Apply migrations: `supabase db push` (or per-file if needed).
  - Deploy functions: `supabase functions deploy <fn> --project-ref <ref>`.
  - Run function tests: `pnpm test:functions`.

