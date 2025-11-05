# WhatsApp Webhook Refactor Plan

## Objectives
- Decompose the monolithic `index.ts` handler into focused modules that separate request parsing, validation, routing, and logging concerns.
- Improve testability by isolating pure utilities and enabling deterministic unit tests without heavy mocks.
- Provide stronger typing for inbound WhatsApp payloads and internal context so flows, AI agents, and retention logic can share consistent contracts.
- Preserve current behaviour, including signature verification, idempotency guarantees, Supabase persistence, and analytics logging.

## Scope
This refactor targets the Supabase function `supabase/functions/wa-webhook`. The existing public surface (HTTP contract) will remain unchanged. No schema updates or external API changes are planned.

## Work Streams
1. **Request Pipeline Module**
   - Extract request parsing (byte limits, JSON parsing) and verification into `router/pipeline.ts`.
   - Introduce a context object that holds the request body, resolved language, and Supabase client for downstream handlers.

2. **Locale & Language Utilities**
   - Move locale detection helpers into a new `utils/locale.ts` module with explicit unit-tested exports.
   - Ensure helper functions handle malformed data defensively and remain framework agnostic.

3. **Handler Simplification**
   - Update `index.ts` to orchestrate the pipeline, logging, and routing by delegating to extracted modules.
   - Preserve existing logging and error handling semantics while tightening branches for clarity.

4. **Test Coverage**
   - Update `index.test.ts` to exercise the new pipeline module and locale utilities directly where practical.
   - Maintain regression coverage for signature verification, idempotency, and message routing.

## Risk Mitigation
- Keep incremental commits and run `deno test supabase/functions/wa-webhook/index.test.ts` after changes.
- Add defensive runtime checks in extracted utilities to avoid silent behavioural changes.
- Retain environment-driven configuration via `config.ts` without modification.

## Rollout
- Ship as an internal refactor. No feature flags are necessary because the HTTP contract is stable.
- Merge to main and monitor WhatsApp inbound metrics for anomalies during the next deploy cycle.
