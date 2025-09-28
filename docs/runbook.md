# easyMO Operational Runbook

## WhatsApp Webhook outage
- **Detection:** Monitoring sees `SIG_VERIFY_FAIL` spike or 5xx from `/functions/v1/wa-webhook`.
- **Mitigation:** Check Meta App credentials (`WA_APP_SECRET`, `WA_TOKEN`). Redeploy function with `supabase functions deploy wa-webhook`. Review `webhook_logs` table for request payloads.

## Flow binding failure
- **Detection:** Flow exchange logs `Unknown flow` or action.
- **Mitigation:** Re-publish Flow JSON in WhatsApp Manager and ensure Data Channel URI points to `/flow/exchange`. Verify requests using Postman collection.

## OCR backlog
- **Detection:** `ocr_jobs` remains in `queued` status for >15 minutes.
- **Mitigation:** Trigger `/notification-worker` manually (if OCR worker pending) or run the OCR edge function once built. Check OpenAI credentials.

## Notification template rejection
- **Detection:** Notifications rows with status `failed` and error text from Meta.
- **Mitigation:** Adjust template variables, ensure template name matches; requeue by resetting status to queued and clearing error message.

## Vendor double-update conflicts
- **Detection:** Order events show repeated status toggles or race conditions.
- **Mitigation:** Review `order_events` and audit logs. Consider locking order rows on update.

## MoMo dialer fallback
- **Detection:** Users report tel URI failing.
- **Mitigation:** Provide human-readable USSD string (`formatUssdText`) and manual instructions. Update `buildMomoUssd` if format changes.
