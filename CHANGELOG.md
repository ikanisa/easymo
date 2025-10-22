# Changelog

All notable changes to this repository are documented here.

## 2025-12-07 – Voice agent ops routes & contracts

- Added `/voice-ops` admin route, lazy loader, and navigation entry to expose the
  Voice Agent Ops dashboard.
- Expanded shared voice DTOs and validation schemas (Zod) to cover voice call
  telemetry, dialer requests, warm handoffs, payment confirmations, and WhatsApp
  webhook envelopes.
- Extended API route registry to include new dialer, handoff, payment, and
  WhatsApp webhook endpoints and surfaced typed Kafka webhook topics for all
  controllers.
- Normalised voice Supabase helpers to validate responses against the shared
  schemas when listing calls or loading details.

Migration notes

- Update consumers that import `VoiceCall` (and related types) to pull from
  `@va/shared` or the new `voice` DTO exports instead of bespoke definitions.
- Downstream services should regenerate service endpoint caches to pick up the
  new `/dialer/outbound`, `/handoff/warm`, `/payment/confirm`, and
  `/whatsapp/webhook` endpoints.
- Messaging consumers can subscribe to the new webhook topics by referencing
  `getWebhookTopicsForController('dialer' | 'handoff' | 'payment' | 'whatsapp')`.

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

