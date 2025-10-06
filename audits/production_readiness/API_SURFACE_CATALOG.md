# API Surface Catalog

## Admin Panel Route Handlers

### `/api/dashboard`

- **Purpose:** Provide KPIs and voucher timeseries for landing dashboard.
- **Inputs:** None.
- **Outputs:** `{ kpis: DashboardKpi[], timeseries: TimeseriesPoint[] }`.
- **Idempotency:** GET only.
- **Auth Boundary:** Service component; server components fetch directly.
- **Policy Checks:** None (read-only).
- **Errors:** `500` on provider failure.

### `/api/users`

- **Purpose:** Paginated user lookup.
- **Inputs:** `search`, `offset`, `limit` (validated with Zod)
  (`admin-app/app/api/users/route.ts`).
- **Outputs:** `{ data, total, hasMore }` (user schema).
- **Idempotency:** GET.
- **Auth:** Admin context.
- **Policies:** Implicit via service role; relies on future RLS.
- **Errors:** `400 invalid_query`, `500 users_list_failed`.

### `/api/vouchers`

- **Purpose:** Filter vouchers by status, search.
- **Inputs:** `status`, `search`, pagination.
- **Outputs:** `{ data, total, hasMore }` (voucher schema).
- **Idempotency:** GET.
- **Auth:** Admin.
- **Policies:** Should respect RLS.

### `/api/vouchers/generate`

- **Purpose:** Issue vouchers in bulk.
- **Inputs:** `{ amount, currency?, expiresAt?, stationScope?, recipients[] }`,
  optional `x-idempotency-key`.
- **Outputs:** `{ issuedCount, vouchers[], message, integration }`
  (`admin-app/app/api/vouchers/generate/route.ts`).
- **Idempotency:** Yes (with Supabase table + in-memory fallback).
- **Auth:** Admin; uses service role.
- **Policy Checks:** None at endpoint; rely on forthcoming rules.
- **Errors:** `400 invalid_payload`, `500 voucher_generate_failed`.

### `/api/vouchers/send`

- **Purpose:** Mark voucher as sent then dispatch via WhatsApp bridge.
- **Inputs:** `{ voucherId, msisdn, templateId? }`, idempotency header.
- **Outputs:** `{ voucherId, status, message, integration }`.
- **Idempotency:** Enforced via helper.
- **Auth:** Admin.
- **Policy:** `evaluateOutboundPolicy` ensures opt-out → quiet hours → throttle.
- **Errors:** `409` for policy block, `400`, `500` fallback.

### `/api/vouchers/preview`

- **Purpose:** Retrieve voucher preview assets.
- **Inputs:** `{ voucherId }`.
- **Outputs:** `{ status, message, imageUrl?, pdfUrl?, integration }`.
- **Idempotency:** N/A (read).
- **Auth:** Admin.
- **Policy:** None.

### `/api/campaigns`

- **Purpose:** List and create campaigns.
- **Inputs:** `GET` filters; `POST` body validated with Zod; optional
  idempotency header.
- **Outputs:** List payload or `{ campaign, message, integration }`.
- **Idempotency:** Yes (withIdempotency).
- **Auth:** Admin.
- **Policy:** Campaign creation currently open to admins; dispatcher bridge
  handles throttle later.

### `/api/campaigns/:id/start|pause|stop`

- **Purpose:** Transition campaign state.
- **Inputs:** Path `id` (Zod); no body.
- **Outputs:** `{ id, state, message, integration }`.
- **Idempotency:** Not explicit; recommend use of headers.
- **Auth:** Admin.
- **Policy:** None; rely on dispatcher for quotas.

### `/api/insurance/:id/approve`

- **Purpose:** Approve insurance quote.
- **Inputs:** `{ reviewerId? }`.
- **Outputs:** `{ quoteId, status, message, integration }`.
- **Idempotency:** Not enforced; action-level confirm dialog.
- **Auth:** Admin (support).
- **Policy:** None.

### `/api/insurance/:id/request-changes`

- **Purpose:** Request modifications with comment.
- **Inputs:** `{ reviewerId?, comment }`.
- **Outputs:** `{ quoteId, status, comment, message, integration }`.
- **Idempotency:** None.

### `/api/stations`

- **Purpose:** Manage station directory entries.
- **Inputs:** POST body with station metadata; optional idempotency key.
- **Outputs:** `{ station, integration }`.
- **Idempotency:** Yes (`withIdempotency`).

### `/api/stations/:id`

- **Purpose:** Update or delete station.
- **Inputs:** `PATCH` body (partial updates); delete path ID.
- **Outputs:** `{ station, integration }` or `{ id, integration }`.
- **Idempotency:** No.

### `/api/orders/:id/override`

- **Purpose:** Nudge/cancel/reopen order.
- **Inputs:** `{ action, reason? }`.
- **Outputs:** `{ orderId, status, message, integration }`.
- **Policy:** No direct policy; rely on audit logging.

### `/api/notifications`

- **Purpose:** List outbound notifications.
- **Outputs:** `{ data, total, hasMore, integration }`.

### `/api/notifications/:id`

- **Purpose:** Resend/cancel notifications.
- **Inputs:** `{ action: 'resend'|'cancel' }`.
- **Outputs:** `{ notificationId, status, message, integration }`.
- **Policies:** Should respect WABA quiet hours via upstream bridging; manual
  operations currently.

### `/api/settings`

- **Purpose:** Retrieve/persist messaging policy settings.
- **Outputs:** `GET` returns quiet hours/throttle/opt-out with integration;
  `POST` returns `{ status, integration }`.
- **Policy:** Enforced by `evaluateOutboundPolicy` consumer.

### `/api/logs`

- **Purpose:** Aggregated audit log + voucher events.
- **Outputs:** `{ audit[], events[], integration }`.
- **Policy:** Admin-only.

### `/api/files/signed-url`

- **Purpose:** Generate signed storage URL.
- **Inputs:** `bucket`, `path` (query).
- **Outputs:** `{ url, expiresIn, integration }`.
- **Security:** Requires service role.

### `/api/qr/generate`

- **Purpose:** Create QR tokens.
- **Inputs:** `{ barName, tableLabels[], batchCount }` with idempotency key.
- **Outputs:** `{ tokens[], integration }`.
- **Policy:** No throttle yet; design for station scope.

### `/api/dashboard` supporting routes

- `listLatestOrderEvents`, `listLatestWebhookErrors` now read from Supabase via
  `/api/orders/events` and `/api/webhooks/errors`.

## Edge Function Bridges

- Voucher preview (`voucherPreview`) – expects `{ voucherId }` POST; returns
  asset links.
- Voucher send (`voucherSend`) – expects dispatch payload; returns provider
  status.
- Voucher generate (future) – mass issuance.
- Campaign dispatcher (`campaignDispatch`) – actions: create/start/pause/stop.
- Insurance workflow (`insuranceWorkflow`) – approves or requests changes.
- Station directory (`stationDirectory`) – syncs create/update/delete.

Each bridge call records integration status via `edge-bridges` helper to expose
degraded UX.
