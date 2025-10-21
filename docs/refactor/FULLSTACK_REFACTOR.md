# Fullstack Refactor (Admin Panel + Supabase)

This refactor focuses on consistency, safety, and maintainability across the admin app and Supabase Edge Functions.

## Admin Panel

- Centralize Supabase service-role access:
  - Replaced per-route inline `createClient` calls with `getSupabaseAdminClient()`.
  - Files updated:
    - `admin-app/app/api/mobility/driver_location/route.ts`
    - `admin-app/app/api/mobility/collect_offer/route.ts`
- Benefit: single source of truth for credentials, consistent error handling, easier rotation.

## Supabase Edge Functions

- Standardize std imports via import map:
  - `supabase/functions/import_map.json`: bump `$std/` to `0.224.0`.
  - Prefer `$std/...` imports for Deno stdlib.
- Add shared helpers:
  - `supabase/functions/_shared/http.ts`: ok/error/json response helpers.
  - `supabase/functions/_shared/env.ts`: typed env accessors.
- Adopt shared helpers in:
  - `supabase/functions/ai-contact-queue/index.ts`
- Benefit: consistent responses, fewer copy/paste patterns, clearer env semantics.

## CI

- Add Deno unit tests step to CI workflow:
  - `deno test --allow-env --allow-read --allow-net supabase/functions`.
- Benefit: validates function helpers + behavior in PRs.

## Next candidates (not yet changed)

- Convert remaining functions to use `_shared/http.ts` and `_shared/env.ts`.
- Migrate direct std URLs to `$std/` alias.
- Consolidate repeated utilities in `supabase/functions/_shared`.
- Add Zod validation on function inputs where applicable.

## Notes

- Existing migration hygiene warnings remain non-blocking and unchanged.
- No breaking changes to runtime API contracts were introduced.

