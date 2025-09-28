# Notification & Bridge Integration Plan (Phase 4)

## Goals

1. Deliver WhatsApp template notifications for vendor and customer events (order
   created, paid, served, cancelled, cart reminder).
2. Centralize outbound messaging logic so Edge Functions or RPCs can trigger
   notifications reliably.
3. Ensure idempotent sends with auditing (`notifications` table) and graceful
   degradation when templates fail.
4. Prepare for future bridge integrations (voucher issuance, campaign
   dispatcher) by sharing the HTTP send helper.

## Architecture Overview

- **Trigger sources**: `flow-exchange` handlers (customer cart/order lifecycle,
  vendor order actions) write to `orders` / `order_events`. After Phase 4, these
  same handlers enqueue notifications via the helper that writes rows to
  `notifications` (implemented in
  `supabase/functions/wa-webhook/notify/sender.ts`).
- **Notification helper**: `queueNotification` records an entry in the table,
  sets `next_attempt_at` when deferred, and is now used by admin
  broadcast/templates as well as order flows.
- **Retry strategy**: handled centrally by `processNotificationQueue` with
  exponential backoff (`retry_count`, `next_attempt_at`). Admin review occurs in
  `admin_broadcast` flow to surface failures.
- **Bridge helper**: future work; existing implementation relies on direct fetch
  calls inside sender.
  - Note: `notification-worker` Edge Function has both HTTP entrypoint and
    Supabase cron (`*/1 * * * *`); confirm scheduled trigger is enabled in
    Supabase dashboard.

## Template Mapping

| Event                          | Template                                      | Variables                                      | Trigger                     |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------- | --------------------------- |
| New order (vendor)             | `order_created_vendor`                        | `order_code`, `table_label`, `total_formatted` | After customer places order |
| Pending reminder (vendor)      | `order_pending_vendor`                        | `order_code`, `table_label`, `age_minutes`     | Scheduled job (Phase 5)     |
| Paid (customer)                | `order_paid_customer`                         | `order_code`, `bar_name`                       | Vendor marks paid           |
| Served (customer)              | `order_served_customer`                       | `order_code`, `table_label`                    | Vendor marks served         |
| Cancelled (customer)           | `order_cancelled_customer`                    | `order_code`, `reason`                         | Vendor/admin cancels        |
| Cart reminder (customer)       | `cart_reminder_customer`                      | `bar_name`                                     | Optional scheduled job      |
| Fuel voucher issue (customer)  | `voucher_issue_client` (media via signed URL) | `code_5`, `policy_number`, PNG link            | After insurance policy sale |
| Fuel voucher redeemed (admins) | `voucher_redeemed_notice`                     | `code_5`, `station`, `timestamp`               | Upon redemption             |

## Implementation Steps

1. **Shared helper** (`supabase/functions/wa-webhook/notify/sender.ts`)
   - Handles template / flow / text / media channels, queues rows in
     `notifications`, and posts to WhatsApp Cloud API.
   - Media support uses signed URLs (private Supabase bucket) for fuel voucher
     PNGs.

2. **Flow-exchange integration**
   - Hook into existing handlers where order events are created (customer place
     order, vendor paid/served/cancel). After DB transaction, call
     `sendTemplateNotification` for each recipient using the helper.
   - Ensure calls happen after `order_events` insert so notifications reflect
     final state.
   - Catch errors; if send fails, add an `order_events` note with status
     `degraded` and return integration info to flow UI.

3. **Admin retry endpoint (future)**
   - Expose API route `/api/notifications/retry` to allow manual resend (not in
     scope for Phase 4 but keep DB structure ready).

4. **Configuration**
   - Environment variables already present: `WHATSAPP_API_BASE_URL`,
     `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
     `WHATSAPP_TEMPLATE_NAMESPACE`.
   - Ensure Cloud API permission includes messaging for templates.

5. **Testing Plan**
   - Use sandbox numbers from `.env` (`TEST_CUSTOMER_WA_ID`,
     `TEST_VENDOR_WA_ID`).
   - Simulate events via `flow-exchange` API (e.g., call `a_place_order`,
     `a_mark_paid`) and confirm template payload captured in `notifications`
     table with status `sent` or `failed`.
   - Validate error path by forcing invalid template name.

## Deliverables

- `supabase/functions/_shared/notifications.ts` helper module.
- Updates to `flow-exchange/customer-cart.ts` and `vendor-orders.ts` to call
  helper after order events.
- Documentation updates in this plan and runbook snippet describing notification
  retries.
