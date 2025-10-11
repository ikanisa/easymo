# Edge-Function Availability Probe

Goal: Detect whether key Supabase Edge Functions are deployed and reachable,
then surface graceful degraded states in the Admin Panel.

## Functions to Probe

1. **Voucher PNG Generator**
   - **Expected URL**:
     `POST https://<project-ref>.functions.supabase.co/voucher-preview`
   - **Request Body**: `{ "voucher_id": string, "format": "png" }`
   - **Success Response**: `200 OK` with
     `{ "signed_url": string, "expires_in": number }`
   - **Failure Handling**: Treat `404` or network failure as "not configured".
2. **WhatsApp Media Send**
   - **Expected URL**:
     `POST https://<project-ref>.functions.supabase.co/wa-send-media`
   - **Request Body**:
     `{ "msisdn": string, "template_id": string, "media_url": string, "context": object }`
   - **Success Response**: `202 Accepted` with `{ "message_id": string }`
   - **Failure Handling**: `5xx` or timeout triggers degraded state; `4xx`
     should bubble a user-readable error.
3. **Campaign Dispatcher**
   - **Expected URL**:
     `POST https://<project-ref>.functions.supabase.co/campaign-dispatcher/<action>`
     where `<action>` ∈ `start|pause|stop|status`.
   - **Request Body**: `{ "campaign_id": string }`
   - **Success Response**: `200 OK` with
     `{ "state": "running" | "paused" | "stopped" }`
   - **Failure Handling**: `404` or missing action considered "not configured";
     `409` conflicts should display inline.

## Probe Strategy

- Implement `/api/integrations/status` route that:
  1. Performs lightweight `HEAD` or `POST` requests with short timeouts (1–2
     seconds).
  2. Caches positive results for 5 minutes to avoid rate limits.
  3. Returns structured payload:
     ```json
     {
       "voucher_png": { "status": "green|amber|red", "message": string },
       "wa_media_send": { "status": "green|amber|red", "message": string },
       "campaign_dispatcher": { "status": "green|amber|red", "message": string }
     }
     ```
- `green`: success response.
- `amber`: reachable but returned 4xx/partial failure.
- `red`: unreachable/timeout/not deployed.

## Integrations Status View

- Location: `/settings/integrations` or a card on the Dashboard.
- UI Elements:
  - Colored status badges for each function.
  - Timestamp of last successful probe.
  - CTA links to run manual recheck.
  - Copy describing feature impact when status is amber/red.

## Degraded Mode UX Copy

- **Voucher Preview Modal**
  - Title: "Voucher preview unavailable"
  - Body: "The voucher image service is not configured in this environment. You
    can still issue vouchers; recipients will see the standard code view."
- **Send via WhatsApp**
  - Toast: "Send blocked – media sender is offline. Check Integrations Status or
    schedule during availability."
- **Campaign Start/Pause/Stop Buttons**
  - Inline alert: "Campaign dispatcher endpoint is unavailable. Try again after
    deployment or contact Ops."
- **Dashboard KPI Cards (optional)**
  - Show dotted badge with tooltip: "Live metrics paused: voucher PNG service
    offline."

## Alerting Hooks

- If probes return `red` for >30 minutes, log an entry in `audit_log` with
  action `integration_probe_failed` for visibility.
- Optional: wire into Ops notification channel once messaging policies are
  finalized.
