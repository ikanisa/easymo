# Incident Runbooks (Production Readiness Audit)

## Voucher Preview Edge Function Down
1. **Detection:** Integration badge shows degraded; alert from EF monitor.
2. **Triage:** Verify Supabase logs; check recent deployments.
3. **Mitigation:**
   - Inform Support to use design mock messaging.
   - Pause non-critical voucher issuance.
   - Investigate EF logs; redeploy if regression.
4. **Recovery:** Once EF healthy, run smoke test: generate preview, confirm image delivered.
5. **Postmortem:** Capture root cause; update `EF_AVAILABILITY_MATRIX.md` with findings.

## WhatsApp Throttle / 429 Errors
1. **Detection:** Campaign send metrics show spike; notifications resend failing.
2. **Triage:** Inspect WABA API responses; confirm policy engine not blocking.
3. **Mitigation:**
   - Pause campaign via `/api/campaigns/:id/stop`.
   - Enable backoff config (dispatcher) once available.
   - Communicate delay to stakeholders.
4. **Recovery:** Resume with reduced batch size. Monitor throttle counters.
5. **Postmortem:** Update dispatcher config, document root cause.

## Station Redeem Anomalies (Double Spend)
1. **Detection:** Audit log shows voucher redeemed twice; Support escalation.
2. **Triage:** Confirm Station PWA connectivity; inspect voucher events.
3. **Mitigation:**
   - Disable station redeem via feature flag (if available) or instruct manual fallback.
   - Manually adjust voucher state in Supabase.
4. **Recovery:** Deploy fix (idempotent redeem) after validation.
5. **Postmortem:** Add regression test; update risk register.

## Supabase Outage
1. **Detection:** Global alerts / API failures.
2. **Triage:** Check Supabase status page; confirm scope (DB, auth, storage).
3. **Mitigation:**
   - Activate DR plan: switch to read-only mode; pause campaigns.
   - Communicate ETA to business.
4. **Recovery:** After service restored, validate data consistency (pending vouchers, audit log backlog).
5. **Postmortem:** Document downtime, evaluate need for multi-region strategy.

## Edge Function Deployment Failure
1. **Detection:** CI pipeline fails or health probe goes red post-deploy.
2. **Mitigation:** Roll back to previous version via Supabase CLI; inform on-call.
3. **Validation:** Run health check and smoke test.

