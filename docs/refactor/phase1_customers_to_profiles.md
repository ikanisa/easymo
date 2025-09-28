# Phase 1 Migration Plan — Deprecate `public.customers`

## Problem Statement

We have two parallel identity tables:

- `public.customers` (legacy, keyed by `id`, populated by WA flows).
- `public.profiles` (newer, keyed by `user_id`, used by wallets, baskets,
  mobility, vouchers).

Maintaining both causes duplication, inconsistent data, and awkward migrations.
Core order/cart tables still point to `customers`, while most new features rely
on `profiles`. The goal is to converge on `profiles` as the single source of
truth.

## Affected Objects

Tables with `customer_id` FK → `public.customers.id`:

- `public.carts`
- `public.orders`
- `public.sessions`

Supporting code paths:

- Edge functions (`flow-exchange/customer-cart.ts`,
  `wa-webhook/exchange/helpers.ts`, dine-in services) create/read rows via
  `customers`.
- RLS helpers (`auth_customer_id()`) feed policies for `carts`, `orders`,
  `sessions`.

## Target State

1. `profiles` becomes the canonical identity table; all foreign keys point to
   `profiles.user_id`.
2. Edge functions create/read profiles only (no more `ensureCustomer`).
3. RLS uses a new `auth_profile_id()` helper, retiring `auth_customer_id()`.
4. `public.customers` is dropped (post archive) once data is migrated and code
   updated.

## Migration Steps

### 1. Data Alignment

- Create script to ensure every row in `customers` has a matching `profiles`
  entry:
  ```sql
  INSERT INTO public.profiles (user_id, whatsapp_e164, display_name)
  SELECT gen_random_uuid(), c.wa_id, c.display_name
  FROM public.customers c
  LEFT JOIN public.profiles p ON p.whatsapp_e164 = c.wa_id
  WHERE p.user_id IS NULL;
  ```
- Add temporary mapping table `legacy_customer_profile` capturing
  `(customer_id, profile_id)`.

### 2. Schema Changes

- Add nullable `profile_id uuid REFERENCES public.profiles(user_id)` columns to:
  - `public.carts`
  - `public.orders`
  - `public.sessions`
- Backfill `profile_id` using mapping table.
- Update NOT NULL / default constraints: once populated, set `profile_id`
  `NOT NULL` (except where `customer_id` was optional).
- Add indexes on new columns (e.g., `idx_carts_profile_status`).

### 3. Code Updates

- Replace `ensureCustomer` helper with `ensureProfile` (already exists) in edge
  functions.
- Update Supabase queries to join/filter on `profile_id` + `profiles`.
- Remove `customer_id` usage in TypeScript types.

### 4. RLS & Auth Claims

- Introduce `auth_profile_id()` (similar to existing `auth_customer_id()` but
  reading `profile_id`).
- Update policies on `carts`, `orders`, `sessions` to use `profile_id`.
- Deprecate `auth_customer_id()`.

### 5. Decommissioning

- Drop FKs/indexes referencing `customer_id`.
- Drop `customer_id` columns from `carts`, `orders`, `sessions`.
- Archive `public.customers` to `archive.customers_<timestamp>`.
- Remove mapping table.

## Testing Strategy

- SQL integration tests covering carts/orders/sessions creation & RLS.
- Edge function smoke tests (Deno) verifying carts & orders flow still work.
- Data validation queries comparing counts pre/post migration.

## Risks & Mitigations

| Risk                                | Mitigation                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Missing profile for legacy customer | Pre-migration sync ensures coverage; abort if mapping rows < customers rows.  |
| RLS regression                      | Write automated policy tests (`pgTAP` or SQL) before change.                  |
| Edge functions caching old schema   | Deploy functions immediately after migration; add runtime checks.             |
| Rollback complexity                 | Keep `public.customers` archived until QA passes; simple revert script ready. |

## Timeline (draft)

1. **T0**: Run data alignment script in staging; verify mapping counts.
2. **T1**: Apply migration adding `profile_id` columns and backfill (staging →
   prod).
3. **T2**: Update code, deploy edge functions; run smoke tests.
4. **T3**: Drop old columns/table; final validation.

## Open Questions

- Any external integrations still reading `public.customers` directly? Need
  audit (look for references outside repo).
- Do we retain `wa_id` column anywhere else for quick lookup? (Profiles already
  stores `whatsapp_e164`).
- How do we expose profile ID to admin UI? Possibly extend API responses.

_This document will evolve as we execute Phase 1. Add findings + decisions as
comments._
