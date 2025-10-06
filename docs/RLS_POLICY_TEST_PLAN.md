# RLS Policy Test Plan

Purpose: verify the policies defined in `20251002123000_rls_core_policies.sql`
enforce tenant isolation and role permissions for platform, vendor, and customer
contexts.

## Assumptions

- JWT claims follow helpers: `role`, `wa_id`, `bar_id`, `customer_id`.
- Supabase test harness can set `request.jwt.claim.<key>` using `set_config`.
- Seed dataset prepared per `docs/SEED_DATA_PLAN.md` (two bars, two customers,
  etc.).

## Matrix

| Test ID | Role                   | Table         | Operation                   | Scenario                 | Expected            |
| ------- | ---------------------- | ------------- | --------------------------- | ------------------------ | ------------------- |
| T1      | platform               | any           | select/insert/update/delete | Platform actor           | Allowed             |
| T2      | vendor_manager (bar A) | bars          | select                      | bar A                    | Allowed             |
| T3      | vendor_manager (bar A) | bars          | select                      | bar B                    | Denied              |
| T4      | vendor_manager (bar A) | bars          | update                      | bar A                    | Allowed             |
| T5      | vendor_staff (bar A)   | bars          | update                      | bar A                    | Denied              |
| T6      | vendor_staff (bar A)   | bar_numbers   | select                      | bar A entries            | Allowed             |
| T7      | vendor_staff (bar A)   | bar_numbers   | select                      | bar B entries            | Denied              |
| T8      | vendor_manager (bar A) | bar_numbers   | insert/update               | bar A                    | Allowed             |
| T9      | vendor_manager (bar A) | bar_settings  | update                      | bar A                    | Allowed             |
| T10     | vendor_manager (bar A) | bar_settings  | update                      | bar B                    | Denied              |
| T11     | customer (cust1)       | menus/items   | select                      | bar A published          | Allowed             |
| T12     | customer (cust1)       | carts         | select/update               | own cart                 | Allowed             |
| T13     | customer (cust1)       | carts         | select                      | other customer cart      | Denied              |
| T14     | customer (cust1)       | orders        | select                      | own order                | Allowed             |
| T15     | customer (cust1)       | orders        | select                      | other customer order     | Denied              |
| T16     | vendor_staff (bar A)   | orders        | update                      | bar A order              | Allowed             |
| T17     | vendor_staff (bar A)   | orders        | update                      | bar B order              | Denied              |
| T18     | vendor_staff (bar A)   | order_events  | insert                      | bar A order              | Allowed             |
| T19     | vendor_staff (bar A)   | order_events  | insert                      | bar B order              | Denied              |
| T20     | customer (cust1)       | order_events  | select                      | own order                | Allowed             |
| T21     | customer (cust1)       | order_events  | select                      | other order              | Denied              |
| T22     | vendor_manager (bar A) | ocr_jobs      | select                      | bar A                    | Allowed             |
| T23     | vendor_manager (bar A) | ocr_jobs      | select                      | bar B                    | Denied              |
| T24     | customer (cust1)       | bar_tables    | select                      | all                      | Allowed (read-only) |
| T25     | vendor_manager (bar A) | bar_tables    | update                      | bar A                    | Allowed             |
| T26     | vendor_staff (bar A)   | bar_tables    | update                      | bar A                    | Denied              |
| T27     | customer (cust1)       | notifications | select                      | to_wa_id = cust1         | Allowed             |
| T28     | vendor_manager (bar A) | notifications | select                      | order belonging to bar A | Allowed             |
| T29     | vendor_manager (bar A) | notifications | select                      | order belonging to bar B | Denied              |
| T30     | any                    | audit_log     | select                      | non-platform             | Denied              |

## Execution approach

1. Use `alter role` or `pgjwt` claims in test scripts to mimic each role.
2. For each test, attempt the CRUD statement and assert `SQLSTATE 42501`
   (insufficient privilege) for denied cases.
3. Store these scripts under `supabase/tests/rls/` for automated regression.

## Automation hook

- Integrate with `supabase-test` or a Vitest suite hitting Supabase via
  service-role key but setting `request.jwt.claims` before each query.
- Include in CI once Phase 2 APIs are stable.
