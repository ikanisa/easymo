# Phase 2 – Admin Panel ↔ Supabase Alignment

This guide documents the concrete steps required to make the easyMO Admin Panel
(`admin-app/`) load real data from the Supabase project
`lhbowpbcpwoiparwnwgt`. It expands on the Phase 1 environment refresh by
covering table ownership, row-level security (RLS), seed scripts, and smoke
tests once the data is in place.

---

## 1. Table & Function Inventory

| Admin surface | API path | Supabase touchpoints |
| --- | --- | --- |
| Dashboard | `/api/dashboard` (RPC) | `dashboard_snapshot` RPC summarises `orders`, `subscriptions`, `driver_presence`, `notifications` |
| Users | `/api/users` | `profiles`, `subscriptions`, `wallet_accounts`, `insurance_leads` |
| Insurance | `/api/insurance` | `insurance_leads`, `insurance_documents`, `storage.objects` |
| Orders | `/api/orders` | `orders`, `order_items`, `order_events`, `contacts` |
| Vouchers | `/api/vouchers` | `vouchers`, `voucher_events`, `campaign_targets` |
| Campaigns | `/api/campaigns` | `campaigns`, `campaign_targets`, Supabase edge function `campaign-dispatch` |
| Settings | `/api/settings` | `public.settings` table & Supabase secret `EASYMO_ADMIN_TOKEN` |
| Simulator | Supabase function `simulator` | `driver_presence`, `trips`, `settings`, `profiles` |

> **Service role requirement**  
> All server-side fetches must use `SUPABASE_SERVICE_ROLE_KEY`; RLS is locked
> down for anon access. The admin panel already creates a service-role client
> (`lib/server/supabase-admin.ts`) and the edge functions call `createClient`
> with the service key. Double-check every new API route continues this pattern.

---

## 2. Row Level Security Checklist

RLS is already enabled for the Phase 2 mobility tables via migration
`20251017150000_phase2_init.sql`. Service-role keys bypass policies, so the
admin panel can read/write without additional changes. To keep dashboards
reachable for support staff using anon/preview clients, we keep the read-only
policies enabled:

- `public.settings`: `settings_read`
- `public.profiles`: `profiles_read`
- `public.driver_presence`: `driver_presence_read`
- `public.trips`: `trips_read`
- `public.subscriptions`: `subscriptions_read`

If you introduce new tables (e.g. `admin_audit_log`, `wallet_accounts`),
mirror the pattern:

```sql
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS wallet_accounts_read
  ON public.wallet_accounts
  FOR SELECT
  USING (true);

-- Writes remain locked behind service role
CREATE POLICY IF NOT EXISTS wallet_accounts_block_writes
  ON public.wallet_accounts
  FOR ALL
  USING (false)
  WITH CHECK (false);
```

The repository now ships migration
`supabase/migrations/20251118120000_admin_panel_rls_support.sql`, which applies
these policies to all tables referenced by the admin UI. Use it as a template
whenever new surfaces are added. Service-role clients automatically skip RLS
checks, so you do not need a dedicated “admin” JWT.

---

## 3. Seed Data

Run the new fixture scripts after applying migrations:

```bash
supabase db remote commit --file supabase/seed/fixtures/admin_panel_core.sql
# or paste the contents into the Supabase SQL editor.

supabase db remote commit --file supabase/seed/fixtures/admin_panel_marketing.sql
# optional, but recommended for campaigns/vouchers/orders coverage
```

The script creates three confirmed auth users, corresponding `public.profiles`,
active/expired subscriptions, driver presence rows, open trips, and a populated
`public.settings` row. The data matches the Admin Panel expectations:

- Dashboard KPIs show non-zero counts.
- Users table lists at least three profiles with subscription status.
- Simulator “Nearby drivers” uses the seeded `driver_presence` points.
- Settings screen loads real values rather than “No data”.
- Campaigns, vouchers, orders, and insurance pages now show representative
  records thanks to `admin_panel_marketing.sql`.

If you already have production fixtures, adjust the WhatsApp numbers, emails,
and ref codes inside the script before running it. Re-executing the script is
idempotent; it updates existing rows where appropriate.

---

## 4. Dispatcher & Edge Functions

1. Confirm the following secrets are set in Supabase (Functions → Secrets):
   - `EASYMO_ADMIN_TOKEN`
   - `DISPATCHER_FUNCTION_URL`
   - WhatsApp / Meta credentials required by `campaign-dispatch`

2. Deploy the edge functions from the repository root:

   ```bash
   npm run functions:deploy \
     admin-settings admin-stats admin-users admin-trips admin-subscriptions simulator
   ```

3. Manually invoke one function to confirm connectivity:

   ```bash
   curl \
     -H "x-api-key: $EASYMO_ADMIN_TOKEN" \
     https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/admin-stats
   ```

Expect HTTP 200 with KPI counts > 0 after seeding.

---

## 5. Post-Seed Smoke Tests

1. **Login flow** – Visit `https://admin.easymo.dev/login`, submit an operator
   token from `ADMIN_ACCESS_CREDENTIALS`, and confirm redirect to `/dashboard`
   with the `admin_session` cookie present.
2. **Dashboard** – KPIs show counts > 0 and the webhook error list is populated.
3. **Users** – Each fixture user displays subscription status and created date.
4. **Simulator** – “Nearby drivers” query returns at least one result. When
   drivers open “Nearby passengers” or schedule a trip for the first time,
   the flow now performs onboarding (vehicle plate + vehicle type) and stores
   the defaults. Confirm subsequent attempts skip the selector and that the
   “Change vehicle type” option still works. Schedule a simulated passenger
   trip and verify it appears in Supabase.
5. **Settings** – Values match the seeded row and `POST /api/settings` updates
   persist (verify via SQL or a second page refresh).
6. **Campaigns** – Ensure `DISPATCHER_FUNCTION_URL` resolves to the Supabase
   function; trigger a dry-run and inspect Supabase logs for success.

Log the results inside `docs/go-live-readiness.md` so the whole team can see
when the environment is ready for QA.

---

## 6. Maintenance Tips

- Re-run the seed script after each schema change or create an updated version
  alongside the migration to keep fixtures in sync.
- If you rotate the `EASYMO_ADMIN_TOKEN`, update **all** locations simultaneously:
  `.env.local`, Vercel Project → Environment Variables, Supabase secrets, and
  the CLI used for local testing.
- Add automated checks in CI to run `node scripts/health-check.mjs` with the
  admin token to catch regressions early.
- Keep the Admin Panel pointed at service-role clients only. Exposing the anon
  key on the server will reintroduce RLS failures.

By following this checklist each time a new environment comes online, the
admin panel will stay fully aligned with Supabase data and edge functions.
