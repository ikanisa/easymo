# Edge Function Availability Matrix

| Edge Function                 | Endpoint (env var)                   | Purpose                                   | Healthy Response                        | Degraded UX Mapping                                                                    | Observability Needs                                              |
| ----------------------------- | ------------------------------------ | ----------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Voucher Preview               | `VOUCHER_PREVIEW_ENDPOINT`           | Render voucher PNG/metadata               | 200 with `{ status:'ready', imageUrl }` | Modal displays preview. If missing, UI shows mock + badge (`voucherPreview` degraded). | Add probe hitting `/health`, alert if >5m downtime.              |
| Voucher Send                  | `VOUCHER_SEND_ENDPOINT`              | Dispatch voucher message via WABA         | 200 `{ status:'queued' }`               | Operator sees success toast; on failure, API returns degraded status with message.     | Monitor queue latency, failure rate; alerts for HTTP 5xx spike.  |
| Voucher Generate              | `VOUCHER_GENERATE_ENDPOINT`          | Mass issuance                             | 200 list of vouchers                    | Falls back to Supabase insert; integration badge warns degraded.                       | Track issuance latency, success rate; alert when bridge missing. |
| Campaign Dispatcher           | `CAMPAIGN_DISPATCHER_ENDPOINT`       | Start/pause/stop campaigns                | 200 `{ state }`                         | UI shows integration badge; dispatcher failure leaves campaign local only.             | Create SLO for start ack <60s; alert on failure.                 |
| Insurance Workflow            | `INSURANCE_WORKFLOW_ENDPOINT`        | Process approvals/change requests         | 200 `{ status }`                        | Drawer shows success; degraded state instructs manual follow-up.                       | Alert on >3 failures/hour.                                       |
| Station Directory             | `STATION_DIRECTORY_ENDPOINT`         | Sync station data with downstream systems | 200 ack                                 | API returns degraded; operators must sync manually.                                    | Add heartbeat & diff monitoring.                                 |
| WhatsApp Send (Notifications) | `NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT` | Resend notifications                      | 200 ack                                 | Notifications table badge flagged; require manual resend post-recovery.                | Track success vs fail ratio.                                     |

## Degraded UX Summary

- UI surfaces integration badge per call (`IntegrationStatusBadge`); include
  actionable copy in runbooks.
- System checklist requires operator to log degraded events and follow
  `INCIDENT_RUNBOOKS.md`.

## Monitoring Plan

- Provision Supabase Edge Function health checks hitting `/health` route every
  minute.
- Emit metrics (latency, success rate) to monitoring stack.
- Configure PagerDuty alerts for `>=3` consecutive failures or missing heartbeat
  > 5 minutes.

## Validation Steps

- Disable each EF in staging; confirm badge indicates degraded and alert fires.
- Re-enable and ensure badge clears after successful call.
