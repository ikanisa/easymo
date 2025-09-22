# Admin API Routes

These Next.js route handlers provide the server interface for the Admin Panel. They currently return mock-backed
responses but already validate input/output with Zod so that wiring real Supabase queries and Edge Function bridges
is straightforward.

> Integration envelope: most write endpoints now include an optional `integration` object in their JSON responses.
> The shape is `{ target: string, status: 'ok' | 'degraded', reason?: string, message?: string }` and advertises
> whether we called a downstream bridge or fell back to mock behaviour. Surfaces can read this to surface degraded
> messaging to operators.

## `/api/dashboard`
- **Method:** `GET`
- **Query:** none
- **Response:**
  ```json
  {
    "kpis": DashboardKpi[],
    "timeseries": TimeseriesPoint[]
  }
  ```
- **Notes:** Under the mock configuration the handler returns fixture KPI values. Once Supabase aggregates are
  ready, update `getDashboardSnapshot` to pull the live data.

## `/api/users`
- **Method:** `GET`
- **Query Params:**
  - `search` *(optional)* – msisdn substring
  - `offset` *(optional, default 0)*
  - `limit` *(optional, default 25, max 500)*
- **Response:**
  ```json
  {
    "data": User[],
    "total": number,
    "hasMore": boolean
  }
  ```
- **Notes:** Validates query params and response payload. The front-end data provider automatically calls this route
  when running in the browser.

## `/api/vouchers`
- **Method:** `GET`
- **Query Params:**
  - `status` *(optional)* – `issued|sent|redeemed|expired|void`
  - `search` *(optional)* – voucher ID or msisdn
  - `offset`, `limit` *(optional, same semantics as `/api/users`)*
- **Response:**
  ```json
  {
    "data": Voucher[],
    "total": number,
    "hasMore": boolean
  }
  ```
- **Notes:** When the voucher preview/send bridges are implemented this route will switch from mock data to Supabase
  + Edge Function backed reads.

## `/api/campaigns`
- **Method:** `GET`
- **Query Params:** `status?`, `offset?`, `limit?`
- **Method:** `POST`
- **Body:** `{ name: string, type: 'promo' | 'voucher', templateId: string, metadata?: object }`
- **Response:** list returns `{ data, total, hasMore }`. Create returns `{ campaign, message, integration? }`.
- **Notes:** Draft creation inserts via Supabase when credentials are present and attempts to inform the dispatcher
  bridge. Missing integrations flag `integration.status = 'degraded'` so the UI can warn operators that the draft is
  local only.

### `/api/campaigns/:id/start|pause|stop`
- **Method:** `POST`
- **Response:** `{ id, state: 'running'|'paused'|'done', message, integration? }`
- **Notes:** Each action updates Supabase (when available) and calls the campaign dispatcher bridge. Responses include
  the integration envelope to highlight degraded pathways when the dispatcher is unavailable.

## `/api/vouchers/preview`
- **Method:** `POST`
- **Body:** `{ voucherId: string }`
- **Response:** `{ voucherId, status: 'ready'|'pending'|'degraded'|'not_configured', message?, imageUrl?, pdfUrl?, integration? }`
- **Notes:** Calls the voucher preview Edge Function when configured. If the bridge is missing or returns an
  unexpected payload the handler marks the response as `degraded` and populates `integration` with context for the UI.

## `/api/vouchers/generate`
- **Method:** `POST`
- **Headers:** `x-idempotency-key` *(optional)*
- **Body:** `{ amount, currency?, expiresAt?, stationScope?, recipients: [{ msisdn, userId? }] }`
- **Response:** `{ issuedCount, vouchers, message, integration? }`
- **Notes:** Attempts the voucher issuance bridge first, then falls back to Supabase inserts or mock data while reporting
  the integration state. Idempotency keys are persisted via Supabase where available and mirrored in-memory.

## `/api/vouchers/send`
- **Method:** `POST`
- **Headers:** `x-idempotency-key` *(optional)*
- **Body:** `{ voucherId, msisdn, templateId? }`
- **Response:** `{ voucherId, status, message, providerId?, integration? }` or `{ status: 'blocked', reason, message }` if
  policy checks fail.
- **Notes:** Applies outbound policy engine (opt-out → quiet hours → throttle) before calling the send bridge. Errors or
  missing integration endpoints surface as `integration.status = 'degraded'` so the UI can explain the degraded path.

## `/api/insurance/:id/approve`
- **Method:** `POST`
- **Body:** `{ reviewerId?: string }`
- **Response:** `{ quoteId, status: 'approved', message, integration? }`
- **Notes:** Updates Supabase when credentials exist, otherwise acknowledges the approval in mock mode. The
  `integration` envelope surfaces degraded behaviour when the insurance workflow bridge is unavailable.

## `/api/insurance/:id/request-changes`
- **Method:** `POST`
- **Body:** `{ reviewerId?: string, comment: string }`
- **Response:** `{ quoteId, status: 'needs_changes', comment, message, integration? }`
- **Notes:** Calls the insurance workflow bridge with the reviewer comment. When the bridge is missing the endpoint
  returns `integration.status = 'degraded'` so the UI can flag the manual fallback.

## `/api/stations`
- **Method:** `GET`
- **Response:** `{ data: Station[], total, hasMore }`
- **Method:** `POST`
- **Body:** `{ name, engencode, ownerContact?, status? }`
- **Notes:** Creates a station via Supabase when configured and pings the station directory bridge. Responses include
  `integration` metadata describing whether the bridge acknowledged the update.

### `/api/stations/:id`
- **PATCH Body:** `{ name?, engencode?, ownerContact?, status? }`
- **DELETE:** removes the station.
- **Notes:** Mutations attempt Supabase updates then fall back to mock responses while still emitting audit log entries.
  Integration metadata highlights when the external directory is running in degraded mode.

## Implementation Notes
- All routes are marked `dynamic = 'force-dynamic'` so they always serve fresh data (no Next.js caching yet).
- Errors return JSON envelopes `{ error: string }` with `400` for validation issues and `500` for server errors.
- The shared data-provider calls these routes automatically in the browser while server components continue to access
  the helper functions directly.
- Idempotency and audit helpers live under `lib/server/` and currently use in-memory/mock data; replace with real
  persistence when wiring Supabase writes.

## Roadmap
- Add routes for campaign targets import/list, station CRUD, files signed URLs, logs search, settings updates,
  notifications resend.
- Replace mock idempotency/audit/policy stores with Supabase-backed implementations and ensure EF bridges are invoked
  for voucher preview/send and campaign dispatch.

## `/api/qr/generate`
- **Method:** `POST`
- **Headers:** `x-idempotency-key` *(optional)*
- **Body:** `{ barName: string, tableLabels: string[], batchCount: number }`
- **Response:** `{ tokens: [{ id, barName, tableLabel, token, createdAt }] }`
- **Notes:** Inserts into Supabase `qr_tokens` when available; otherwise stores values in mock dataset and logs an audit entry.

## `/api/orders/:id/override`
- **Method:** `POST`
- **Body:** `{ action: 'cancel'|'nudge'|'reopen', reason?: string }`
- **Response:** `{ orderId, status, message }`
- **Notes:** Updates Supabase order state when credentials exist (cancel/reopen). Always records an audit entry and returns a mock acknowledgement if the database update is unavailable.

## `/api/notifications`
- **Method:** `GET`
- **Query Params:** `limit?`
- **Response:** `{ data: Notification[], total, hasMore }`

### `/api/notifications/:id`
- **Method:** `POST`
- **Body:** `{ action: 'resend' | 'cancel' }`
- **Response:** `{ notificationId, status, message, integration? }`
- **Notes:** Resends or cancels a notification. Updates Supabase status when configured; otherwise returns mock acknowledgements.
  Integration metadata highlights when the dispatcher bridge is unavailable.

## `/api/settings`
- **Method:** `GET`
- **Response:** `{ quietHours: string, throttlePerMinute: number, optOutList: string[], integration? }`
- **Method:** `POST`
- **Body:** `{ quietHours: { start, end }, throttlePerMinute: number, optOutList: string[] }`
- **Response:** `{ status: 'saved', integration? }`
- **Notes:** Persists policy settings to Supabase when credentials exist. Falls back to mock storage otherwise while still
  emitting audit entries. The integration metadata flags when settings are buffered in memory only.

## `/api/logs`
- **Method:** `GET`
- **Query Params:** `limit?`
- **Response:** `{ audit: AuditLogEntry[], events: OrderEvent[], integration? }`
- **Notes:** Reads from Supabase audit log when available; otherwise returns mock entries. The integration envelope exposes
  when the viewer is running against fixtures.

## `/api/files/signed-url`
- **Method:** `GET`
- **Query Params:** `bucket`, `path`
- **Response:** `{ url: string, expiresIn: number, integration? }`
- **Notes:** Generates signed URLs through Supabase storage when credentials are configured. Falls back to a mock URL and
  marks the response as `integration.status = 'degraded'` when storage credentials are unavailable.
