# Routing Inventory

## Webhook (`wa-webhook/index.ts`)

- GET: verification, `SIG_VERIFY_OK/FAIL`
- POST: signature verification, idempotency via `wa_events`, structured logging
  (`WEBHOOK_*`).
- STOP/START: updates `contacts` opt-out flag and logs guard events.
- Routes to router (`router/router.ts`) with media handling + match logs.

## Flow Exchange (`exchange/router.ts`)

- Customer flows: `flow.cust.bar_browser.v1`, `flow.cust.bar_menu.v1`,
  `flow.cust.order_tracker.v1`.
- Vendor flows: `flow.vend.onboard.v1`, `flow.vend.menu_review.v1`,
  `flow.vend.orders.v1`, `flow.vend.staff.v1`, `flow.vend.settings.v1`.
- Admin flows: `flow.admin.*` guarded via PIN + audit modules.
- Each action triggers audit/log entries; placeholders remain for
  broadcast/templates.

## State keys

- Mobility: `mobility_nearby_select`, `mobility_nearby_results`,
  `schedule_role`, `schedule_results`, etc.
- Cart & QR: `qr_session`, `basket_*`, `wallet_*` states stored in `chat_state`.

## Deep links

- `makeQrPayload` / `verifyQrPayload` produce `B:<slug> T:<table> K:<sig>`
  tokens resolved via `/qr-resolve` to set `qr_session` state.

## UI constraints

- List titles trimmed to ≤24 chars; multi-option screens rely on data_exchange
  for server decisions.
