# Supabase Cron Runbook

This note captures everything we know about the cron-driven edge functions in
project `lhbowpbcpwoiparwnwgt` and the steps required to confirm they are
running in staging/production. Attach the results of each verification to
`docs/go-live-readiness.md` before signing off Phase 3.

---

## 1. Functions & Environment Flags

| Function | Schedule Variables | Description |
| --- | --- | --- |
| `cart-reminder` | `CART_REMINDER_CRON_ENABLED`, `CART_REMINDER_CRON`, `CART_REMINDER_MINUTES`, `CART_REMINDER_BATCH_SIZE`, `CART_REMINDER_LANGUAGE` | Sends WhatsApp reminders for abandoned carts. |
| `order-pending-reminder` | `ORDER_PENDING_REMINDER_CRON_ENABLED`, `ORDER_PENDING_REMINDER_CRON`, `ORDER_PENDING_REMINDER_MINUTES`, `ORDER_PENDING_REMINDER_BATCH_SIZE`, `ORDER_PENDING_REMINDER_LANGUAGE` | Nudges vendors when an order has been pending too long. |
| `baskets-reminder` | `BASKETS_REMINDER_CRON_ENABLED`, `BASKETS_REMINDER_BATCH_SIZE`, `BASKETS_REMINDER_MAX_PER_HOUR` | Reminds Ibimina members about contribution deadlines. |
| `notification-worker` | `NOTIFICATION_WORKER_CRON_ENABLED`, `NOTIFY_*` backoff settings | Drains the notification outbox. |

All variables live in the root `.env` template. Copy the values into Vercel
(Production & Preview) **and** Supabase function secrets before enabling a
schedule.

---

## 2. Creating / Inspecting Schedules

Supabase CLI commands (requires `supabase login --token …` and `--project-ref lhbowpbcpwoiparwnwgt`):

```bash
# List existing schedules
supabase functions schedule list

# Create or update a schedule (example: cart reminder every 10 minutes)
supabase functions schedule create cart-reminder \
  --cron "*/10 * * * *" \
  --payload '{"type":"cron"}'

# Delete a schedule if you need to reset it
supabase functions schedule delete cart-reminder
```

Notes:

- As of CLI v2.51 the `functions schedule` sub-commands are not exposed; use the
  Supabase Dashboard (Edge Functions → Schedules) if the commands above are not recognised.
- Schedules are stored per function slug. If you change the cron expression,
  re-run `schedule create` with `--replace`.
- Supabase currently emits schedule execution logs under **Edge Functions → Logs**.
  Filter by function name to confirm invocations.

---

## 3. Verification Checklist

1. **Environment** – Ensure the relevant `*_ENABLED` flag is set to `"true"`
   and all other required variables are non-empty.
2. **Schedule** – `supabase functions schedule list` shows the function with
   the expected cron expression and payload.
3. **Edge Function Logs** – After the next scheduled run, check the Supabase
   dashboard logs. Successful runs should log an info-level entry (all edge
   functions in this repo log `*.request` / `*.response` pairs).
4. **Side Effects** – Verify the function writes the expected rows:
   - `cart-reminder`: new entries in `notifications` with `type = 'cart_reminder'`.
   - `order-pending-reminder`: new outbox records targeting vendors.
   - `baskets-reminder`: `notifications` or audit entries referencing baskets.
   - `notification-worker`: updates `notifications.status` from `queued` → `sent`/`failed`.
5. **Alerting** – If a function fails, the CLI output or Supabase dashboard will
   show the error. Capture the error text and open an incident if production
   schedules are impacted.

---

## 4. Disabling Schedules

For maintenance windows or incidents:

1. Flip the `*_ENABLED` flag(s) to `"false"` in Vercel and redeploy (prevents
   the function from processing any work during manual invocations).
2. Delete the schedule via `supabase functions schedule delete <slug>` to stop
   automatic triggers.
3. After resolving the issue, recreate the schedule and re-enable the flag.

---

## 5. Future Enhancements

- Automate the verification via a CI job that runs nightly:
  `node scripts/health-check.mjs` followed by `supabase functions schedule list`.
- Consider adding dead-letter queues for failed notifications so retries can be
  audited from the admin panel.
- Wire metrics to Logflare/Sentry so cron failures generate alerts rather than
  relying on manual dashboard checks.
