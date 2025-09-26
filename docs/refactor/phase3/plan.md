# Phase 3 — Edge Function Modularization Plan (Draft)

## Objectives
- Restructure `supabase/functions/wa-webhook` into cohesive packages: `router/`, `state/`, `services/`, `domains/<feature>`.
- Remove or archive deprecated flows (insurance legacy, duplicate marketplace flows, legacy vendor staff flow).
- Extract shared client libraries (logging, Supabase client, config) into `_shared` for reuse across edge functions.
- Prepare for integration tests/Postman coverage once restructuring stabilises.

## Current Layout Snapshot
| Module | Files | Notes |
|--------|-------|-------|
| `exchange/` | 35 | Flow orchestration actions and admin helpers intermixed. |
| `flows/` | 29 | Mix of TS logic + JSON flows (admin, dine-in, mobility, wallet). |
| `utils/` | 14 | Shared utilities, some domain-specific. |
| `router/` | 7 | Message guards + entrypoints. |
| `rpc/` | 6 | RPC wrappers for Supabase calls. |
| `notify/`, `observe/`, `state/`, `wa/`, `vouchers/` | 2–3 each | Distinct concerns but tightly coupled to current structure. |

## Target Structure
```
wa-webhook/
  main.ts (entry point)
  router/
    guards.ts
    pipelines/
  state/
    idempotency.ts
    session_store.ts
  services/
    notifications/
    profiles/
    menu/
  domains/
    dinein/
    marketplace/
    mobility/
    wallet/
    admin/
    support/
  shared/
    config.ts
    supabase.ts
    logging.ts
```

## Candidate Removals / Archives
| Flow / Module | Rationale | Next Step |
|---------------|-----------|-----------|
| `flows/json/flow.vend.staff.v1.legacy.bak` | Legacy backup file. | Archive or drop after confirming no references. |
| `flows/insurance/ocr.ts` + JSON | Insurance flow flagged as deprecated in plan. | Confirm with product; move to `domains/archive/` or remove. |
| `flows/marketplace.ts` overlap with `exchange/actions/vend_*` | Possible redundancy. | Audit usage; merge into domain service. |
| `flows/mobility/nearby.ts` & `flows/mobility/schedule.ts` | Evaluate after Phase 2 matching changes. |

## Immediate Next Steps
1. Build detailed module inventory (map files → proposed `domains/` or `services/`).
2. Draft refactor backlog: e.g., move exchange actions into `domains/<feature>/actions.ts`.
3. Create shared client skeleton under `supabase/functions/_shared/` (logging, Supabase client factory, env schema).
4. Plan phased rollout (keep entrypoint stable, migrate modules incrementally).

## References
- Existing bundle map: `docs/refactor/phase0/wa_webhook_map.md`
- Phase 3 checklist: `docs/refactor/PHASE_PLAN.md`

## Scaffolding (2025-09-25)
- Created `shared/` module (`shared/supabase.ts`, `shared/logging.ts`) re-exporting existing helpers.
- Added `services/notifications/` re-export to prepare for notifier move.
- Established `domains/` placeholder for feature-specific logic.

## Archives
- Insurance OCR flow + admin flow moved to `flows/archive/` in Phase 3 (2025-09-25).

## Migration Backlog
- **Notifications**: extracted to `services/notifications/` (done).
- **Dine-in**: moved to `domains/dinein/` (done).
- **Mobility**: migrate trip/nearby flows into `domains/mobility/` after cross-checking RPC usage (TBD).
- **Wallet**: migrate wallet flows + vouchers into `domains/wallet/` (TBD).

Estimated timeline: migrate one domain per day, starting with marketplace, followed by mobility, then wallet.
- **Marketplace**: moved to `domains/marketplace/` (2025-09-25).
- **Mobility**: moved to `domains/mobility/` (2025-09-25).
- **Wallet**: moved to `domains/wallet/` (2025-09-25).

## Test & CI Prep
- pgTAP/SQL scripts staged in `tests/sql/`; integrate via pg_prove once domain migrations complete.
- Update Postman collection folders to align with `domains/` structure (see integration plan).
- Once CI harness ready, run SQL + Postman suites before Phase 3 sign-off.
