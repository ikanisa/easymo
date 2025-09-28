# Operator Guide – easyMO Admin Panel

This guide covers the day-to-day flows for support agents and on-call engineers
using the Admin Panel.

## 1. Voucher Issuance & Delivery

1. Navigate to **Vouchers → Generate**.
2. Paste recipient MSISDNs (one per line) and set amount/expiry.
3. Submit and review the result list. A success toast plus a green integration
   badge confirms Supabase + Edge Function writes.
4. If the badge reports degraded mode, issue vouchers manually via the Ops
   script and log the incident. See `docs/DEGRADED_STATES.md`.
5. Use the preview modal to download the PNG. When degraded, share the design
   mock until the bridge recovers.

## 2. Campaign Drafting

1. Go to **Campaigns → New draft**.
2. Select a template, upload the CSV, and set the campaign metadata.
3. Press **Save campaign draft**. A success state with a healthy badge means the
   dispatcher bridge acknowledged the draft.
4. If degraded, coordinate with Growth before activating the campaign manually.

## 3. Insurance Reviews

1. From **Insurance**, open a pending quote drawer.
2. Review documents, provide mandatory comments for request changes, and use the
   Approve/Request buttons.
3. Approvals prompt for confirmation to avoid accidental clicks.
4. Monitor the badge. Degraded outcomes require manual follow-up with
   underwriting.

## 4. Order Escalations

1. In **Orders**, select an order to open the override modal.
2. Provide a reason (required) and choose Nudge, Cancel, or Reopen.
3. Destructive actions display a confirmation dialog.
4. If overrides run in degraded mode, note the message and reapply once Supabase
   connectivity returns.

## 5. Notifications Controls

1. Filter the notifications table to locate failed or queued items.
2. Use **Resend** for immediate retries; **Cancel** now requires confirmation.
3. A degraded badge indicates the dispatcher was offline—retry once resolved.

## 6. Settings & Policies

1. Adjust quiet hours, throttles, and opt-out lists on the Settings page.
2. Integration badges reveal whether settings persisted to Supabase.
3. Always verify the badge is green before closing the incident. Otherwise,
   record the fallback in the ops log.

## 7. Logs & Files

1. Visit **Logs** to audit recent actions. Filters and integration badges
   clarify when data is from Supabase vs fixtures.
2. The **Files** page allows copying signed URLs. A degraded warning means the
   link is mock-only—never share externally.

## 8. Troubleshooting Checklist

- Check `/api/integrations/status` via the Integrations widget.
- Review Supabase status dashboard for outages.
- Inspect the relevant Edge Function logs.
- Consult `docs/DEGRADED_STATES.md` for playbooks.
- Update `QA_MATRIX.md` entries after each incident drill.
