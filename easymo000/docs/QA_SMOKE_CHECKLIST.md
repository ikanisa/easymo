# QA Smoke Checklist — Dine-In + WhatsApp

## Customer Journey

- [ ] Trigger `flow.cust.bar_browser.v1` → search + pagination works.
- [ ] Open a bar → `flow.cust.bar_menu.v1` loads categories/items.
- [ ] Add item to cart, edit quantities, share table number, place order.
- [ ] Confirm payment screen shows USSD tel link and fallback text.
- [ ] `flow.cust.order_tracker.v1` lists open order and timeline updates as
      vendor updates status.

## Vendor Journey

- [ ] Run `flow.vend.onboard.v1`: set identity, contacts, upload menu (OCR queue
      triggered), publish draft.
- [ ] `flow.vend.menu_review.v1`: rename/move categories, toggle items, bulk
      price change.
- [ ] `flow.vend.orders.v1`: view queue, mark order paid/served/cancelled
      (notifications fire).
- [ ] `flow.vend.staff.v1`: add and remove staff numbers.
- [ ] `flow.vend.settings.v1`: update MoMo code, service %, prep time, chat
      toggle.

## Notifications

- [ ] Vendor receives text when customer places order.
- [ ] Customer receives text for paid / served / cancelled transitions.
- [ ] `notifications` table records status transitions (queued → sent).
- [ ] `/api/notifications/retry` re-queues a failed notification in staging;
      admin UI surfaces success toast and audit entry appears.

## Webhook & Exchange

- [ ] `/wa-webhook` signature check passes; invalid signatures rejected.
- [ ] `/flow-exchange` logs `{flow_id, action_id}` for every round-trip.
- [ ] `/health` returns `{ ok: true }` and confirms `app_config` row.

## Database

- [ ] Supabase tables populated: bars, menus, categories, items, carts, orders,
      order_events, notifications.
- [ ] RLS enforced: vendor can only see own bar; customer only own orders.
- [ ] `menu_items_snapshot` refreshes when publishing menu.
- [ ] `order_events` includes `vendor_nudge` rows after reminder job runs.

## QR Deep Link

- [ ] Generate QR via `bar_tables` row; scanning opens browser deep link to
      WhatsApp with tokens parsed.

## Reminder Workers

- [ ] Confirm Supabase cron shows `order-pending-reminder` and `cart-reminder`
      enabled with recent success run.
- [ ] Manually invoke HTTP endpoint for each worker and verify `summary` in
      response plus `logStructuredEvent` entries.
- [ ] Check alert webhook receives `ORDER_PENDING_REMINDER_*` or
      `CART_REMINDER_*` payload when forcing a failure (e.g., remove staff
      numbers, run job).
