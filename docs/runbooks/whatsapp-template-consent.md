# WhatsApp Consent & Template Operations Runbook

This runbook documents the daily procedures for verifying customer consent and
managing WhatsApp template approvals across the EasyMO messaging stack. It
applies to the Supabase `wa-webhook` function, the Kafka webhook worker, and the
pricing server that posts to the Meta Graph API.

## 1. Consent verification checklist

1. **Confirm opt-in source**
   - Query `wa_interactions` for the latest inbound message from the MSISDN.
   - Confirm the conversation metadata contains `consent_source` or an inbound
     user action (menu selection, keyword trigger, or CTA reply).
   - For automated flows, check `webhook_logs` entries emitted by
     `AI_AGENT_REQUEST_SUCCESS` for a recent conversational message. Phone
     numbers are stored in masked form (see `msisdn_masked`).

2. **Validate quiet-hour compliance**
   - Use the `agent_context` session data to confirm that
     `preferred_contact_window` is either unset or includes the current slot.
   - If a quiet-hour override exists, verify a human operator recorded the
     exception in the CRM ticket referenced by `wa_interactions.metadata.ticket`.

3. **Double-check opt-out state**
   - Run the `ai_contact_queue` edge function with the MSISDN to confirm the
     contact is not listed in `do_not_contact`.
   - Audit trail: `AI_RATE_LIMIT_EXCEEDED` events are masked but persist the
     correlation ID. Operators can pass the ID to the webhook worker metrics
     endpoint (`GET /health`) to confirm the latest delivery outcome.

4. **Record the verification**
   - Append a note to the account in the admin panel with the template key and
     correlation ID that will be used for the send.
   - If manual approval is required, capture a screenshot of the consent
     evidence and store it in the shared drive with the naming convention
     `consent-<msisdn>-<timestamp>.png`.

## 2. Template approval workflow

The AI agent orchestrator now maps every conversation intent to an approved
WhatsApp template (see `shared/template_registry.ts`). Operators must ensure the
catalog stays in sync with business policy.

1. **Review mappings weekly**
   - Visit the `whatsapp_templates` table in Supabase and filter on the
     `metadata.intent` JSON field.
   - Verify each intent that is currently used (`customer_service`, `booking`,
     `wallet`, `marketplace`, `support`, `general`) has an `is_active = true`
     template with `approval_status = 'approved'`.

2. **Add or rotate templates**
   - Insert the new template row with the Meta template name, locale, and
     metadata `{ "intent": "<intent>" }`.
   - Populate `body` variables in `variables` JSON in the order the placeholders
     should be filled (e.g. `[{ "name": "agent_message" }, { "name": "customer_name" }]`).
   - Once approved in Meta, update `meta_template_id` with the Graph API ID to
     enable template-based sends.

3. **Audit automated sends**
   - Use the structured log `WA_OUTBOUND_TEMPLATE` to confirm the message was
     delivered via template. Entries include the masked MSISDN, template key,
     locale, and correlation ID.
   - If the worker falls back to free-form text you will see
     `AI_TEMPLATE_DELIVERY_FALLBACK`. Investigate and re-submit the template for
     approval if Meta rejected it.

4. **Handle template changes**
   - Update the Supabase record first to point to the new template name and
     variables.
   - Restart the webhook worker after rotating secrets or template IDs so the
     cached Secrets Manager values refresh.
   - Monitor `/metrics` on the worker for `deadLettered` spikes that may indicate
     template mismatches.

## 3. Secret management SOP

Facebook access tokens and Supabase service-role keys are now pulled from
managed secrets.

1. **AWS Secrets Manager rotation**
   - Store WhatsApp tokens under the ARN referenced by
     `WHATSAPP_TOKEN_SECRET_ARN` (pricing server) and
     `WHATSAPP_TOKEN_SECRET_NAME` if using a friendly name.
   - Store the scoped Supabase service-role key under
     `SUPABASE_SERVICE_ROLE_SECRET_ARN` for the webhook worker.
   - Update the secret and invoke `pnpm run build` (worker/pricing server) to
     ensure new revisions are used.

2. **Local overrides**
   - Developers may still supply `env://VARIABLE_NAME` references for local
     testing. Production deployments **must** use the secret ARNs.

3. **Auditing**
   - Queue metrics (`outbound.queue.*` logs) expose masked recipients for each
     send.
   - Use the worker `/health` endpoint or CloudWatch metrics for end-to-end
     confirmation.

## 4. Incident response

- If a template send fails repeatedly, capture the correlation ID from the
  fallback log and replay the message after confirming the template status in
  Business Manager.
- For consent disputes, retrieve the `wa_interactions` record and the associated
  `AI_AGENT_REQUEST_SUCCESS` log entry to show the conversational context.
- Notify the compliance channel with the masked MSISDN, correlation ID, and the
  template key involved.
