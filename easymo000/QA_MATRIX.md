# QA Matrix – Admin Panel & Station PWA

Each item lists Preconditions, Steps, Expected UI, Expected Data State, and
Priority (M = mandatory before release, N = nice-to-have).

## Admin Panel

1. **Dashboard KPIs (M)**
   - Preconditions: Fixture data loaded; integrations status green or amber.
   - Steps: Open `/dashboard`.
   - Expected UI: Six KPI tiles populated, time-series chart renders last 30
     days.
   - Expected Data: API `/api/dashboard/kpis` returns cached aggregates (≤1s
     response).

2. **Dashboard Degraded State (N)**
   - Preconditions: Force voucher PNG probe to red.
   - Steps: Refresh `/dashboard`.
   - Expected UI: KPI badge shows dotted outline with tooltip "voucher service
     offline".
   - Expected Data: Probe result cached with status `red`.

3. **Users List & Drawer (M)**
   - Preconditions: At least one user with vouchers and quotes.
   - Steps: Filter by msisdn, open drawer.
   - Expected UI: Profile section, vouchers table (paginated), insurance cards.
   - Expected Data: No writes; API logs access in audit (action `user_view`).

4. **Users Empty State (N)**
   - Preconditions: Filter outside dataset.
   - Steps: Apply filter.
   - Expected UI: Empty state with CTA to clear filters.
   - Expected Data: None.

5. **Insurance Approve (M)**
   - Preconditions: Pending quote available.
   - Steps: Open drawer → Approve → confirm.
   - Expected UI: Success toast; status badge switches to Approved; audit entry
     visible.
   - Expected Data: `insurance_quotes.status` = `approved`, `approved_at` set,
     audit log record created.

6. **Insurance Request Changes (M)**
   - Preconditions: Pending quote.
   - Steps: Request changes with comment.
   - Expected UI: Comment displayed; status `needs_changes`.
   - Expected Data: Quote updated; audit entry `insurance_request_changes`
     saved.

7. **Vouchers List Filters (M)**
   - Preconditions: Mixed-status vouchers.
   - Steps: Filter by status, campaign, date.
   - Expected UI: Table updates, filter chips visible, export available.
   - Expected Data: API returns filtered page.

8. **Voucher Preview – Available (M)**
   - Preconditions: Voucher with PNG EF available.
   - Steps: Click Preview.
   - Expected UI: Modal displays PNG; download button enabled.
   - Expected Data: `/api/vouchers/preview` logs probe success.

9. **Voucher Preview – Degraded (M)**
   - Preconditions: Disable EF.
   - Steps: Click Preview.
   - Expected UI: Modal with "service not configured" copy.
   - Expected Data: No errors; response `503` equivalent with reason.

10. **Generate Voucher Single (M)**
    - Preconditions: Admin user role.
    - Steps: Fill form → submit.
    - Expected UI: Result summary card with voucher code.
    - Expected Data: `vouchers` row inserted; `voucher_events` entry `issued`
      recorded.

11. **Generate Voucher Batch (M)**
    - Preconditions: Provide CSV of msisdn.
    - Steps: Upload → review summary.
    - Expected UI: Batch summary with counts; CSV errors listed.
    - Expected Data: Voucher rows created transactionally; duplicates ignored.

12. **WhatsApp Send Blocked by Quiet Hours (M)**
    - Preconditions: Quiet hours active.
    - Steps: Attempt resend.
    - Expected UI: Toast with quiet hours message, button disabled.
    - Expected Data: No send; audit entry reason `quiet_hours`.

13. **Campaign Wizard Draft (M)**
    - Preconditions: Template exists.
    - Steps: Walk wizard, save draft.
    - Expected UI: Progress indicator, summary screen.
    - Expected Data: `campaigns` row created with status `draft`.

14. **Campaign Targets Import (M)**
    - Preconditions: Draft campaign selected.
    - Steps: Upload CSV, map columns.
    - Expected UI: Mapping UI with validation, import results.
    - Expected Data: `campaign_targets` upserted; duplicates flagged.

15. **Campaign Start – Available (M)**
    - Preconditions: Dispatcher EF reachable.
    - Steps: Click Start.
    - Expected UI: Status badge `Running`, toast success.
    - Expected Data: EF call returns `running`; audit event logged.

16. **Campaign Start – Unavailable (M)**
    - Preconditions: Dispatcher EF offline.
    - Steps: Click Start.
    - Expected UI: Inline alert with degraded copy; state remains `Draft` or
      `Paused`.
    - Expected Data: API returns reason `not_configured`.

17. **Stations CRUD (M)**
    - Preconditions: Admin role.
    - Steps: Create station → edit fields → delete (soft delete recommended).
    - Expected UI: Forms with validation, confirmation dialog for delete.
    - Expected Data: New row inserted; edits persisted; `audit_log` entries for
      each action.

18. **Files Browser Preview (N)**
    - Preconditions: Storage objects exist.
    - Steps: Open preview for PNG and PDF.
    - Expected UI: Image lightbox; PDF fallback message.
    - Expected Data: Signed URL generated with TTL < 60m.

19. **Settings Update Quiet Hours (M)**
    - Preconditions: Settings accessible.
    - Steps: Adjust hours → save.
    - Expected UI: Success toast, change reflected in policy engine.
    - Expected Data: `settings` row updated; audit record `settings_update`.

20. **QR Generator (M)**
    - Preconditions: Bars exist.
    - Steps: Select bar, enter table labels, generate tokens.
    - Expected UI: Success toast, generated token list appears.
    - Expected Data: `qr_tokens` table receives new rows; audit entry
      `qr_generate` recorded.

21. **Notifications Resend (M)**
    - Preconditions: Notification in `failed` status.
    - Steps: Resend via table action.
    - Expected UI: Success toast, status transitions to `queued`.
    - Expected Data: `notifications.status` updated; audit `notification_resend`
      recorded.

22. **Notifications Cancel (M)**
    - Preconditions: Notification in `queued` status.
    - Steps: Cancel via table action.
    - Expected UI: Success toast, status becomes `cancelled`.
    - Expected Data: `notifications.status` updated; audit `notification_cancel`
      recorded.

23. **Logs Filtering (N)**
    - Preconditions: Multiple audit entries.
    - Steps: Apply actor and target filters on `/logs`.
    - Expected UI: Filtered list updates, empty state shown when no matches.
    - Expected Data: `/api/logs` responds within 1s; client polling refreshes
      every 30s.

24. **Logs Viewer Filter (N)**
    - Preconditions: Logs present.
    - Steps: Filter by event type and entity.
    - Expected UI: Combined timeline with JSON drawer.
    - Expected Data: API respects pagination and filter.

## Station PWA

21. **Login Flow (M)**
    - Preconditions: Operator user with credentials / magic link.
    - Steps: Access app, authenticate.
    - Expected UI: High-contrast login, success routes to Home.
    - Expected Data: Session token stored securely.

22. **Home Screen Layout (N)**
    - Preconditions: Login completed.
    - Steps: Inspect Home.
    - Expected UI: Large buttons for Scan, Enter Code, Balance, History.
    - Expected Data: None.

23. **Redeem via QR (M)**
    - Preconditions: Valid voucher with QR.
    - Steps: Scan code.
    - Expected UI: Confirmation screen with amount, masked msisdn.
    - Expected Data: `/api/station/redeem` transitions voucher to `redeemed`;
      events logged.

24. **Redeem via Code – Happy Path (M)**
    - Preconditions: Valid 5-digit code.
    - Steps: Enter code, submit.
    - Expected UI: Success toast; voucher summary.
    - Expected Data: Same as QR path.

25. **Redeem via Code – Wrong Code (M)**
    - Preconditions: Use random code.
    - Steps: Submit.
    - Expected UI: Error message "Voucher not found"; no state change.
    - Expected Data: No DB updates; security log entry optional.

26. **Redeem via Code – Replay (M)**
    - Preconditions: Redeemed voucher.
    - Steps: Enter same code again.
    - Expected UI: Error "Voucher already redeemed at <time>".
    - Expected Data: No new events; existing redemption unaffected.

27. **Balance View (N)**
    - Preconditions: Station has redeemed vouchers.
    - Steps: Open Balance.
    - Expected UI: Totals by status, high contrast.
    - Expected Data: Read-only query returns aggregated numbers.

28. **History Pagination (N)**
    - Preconditions: ≥30 redemption events.
    - Steps: Scroll / paginate.
    - Expected UI: Infinite scroll or pager working; event detail accessible.
    - Expected Data: API supports pagination token.

29. **Offline Handling (N)**
    - Preconditions: Simulate offline after login.
    - Steps: Attempt redemption.
    - Expected UI: Offline banner; actions disabled with guidance.
    - Expected Data: Local queue optional; no duplicate redeems.

30. **Accessibility Contrast (M)**
    - Preconditions: Device brightness high.
    - Steps: Inspect UI outdoors / use accessibility tools.
    - Expected UI: WCAG AA contrast for buttons and text.
    - Expected Data: N/A.

31. **Policy Settings Badge (N)**
    - Preconditions: Run without Supabase credentials.
    - Steps: Open `/settings`, observe form before saving.
    - Expected UI: Integration badge reports `Policy storage` degraded with
      helper copy.
    - Expected Data: GET `/api/settings` returns
      `integration.status = 'degraded'`.

32. **Signed URL Degraded Fallback (N)**
    - Preconditions: Storage credentials absent.
    - Steps: On `/files`, copy signed URL.
    - Expected UI: Toast warns about mock URL; clipboard contains
      `example.com/mock/...`.
    - Expected Data: `/api/files/signed-url` returns
      `integration.reason = 'mock_signed_url'`.

33. **Logs Viewer Degraded State (N)**
    - Preconditions: Supabase audit table inaccessible.
    - Steps: Open `/logs`.
    - Expected UI: Integration badge indicates logs running on fixtures.
    - Expected Data: `/api/logs` response includes
      `integration.status = 'degraded'`.

34. **Notifications Action Integration (N)**
    - Preconditions: Notification available; Supabase credentials toggled off.
    - Steps: Trigger resend.
    - Expected UI: Post-action badge warns of mock acknowledgement.
    - Expected Data: `/api/notifications/:id` response includes degraded
      integration envelope.

## Execution Notes

- Mark results in test management sheet after each pass.
- Mandatory tests must pass before promoting a build beyond staging.
- Nice-to-have tests should pass before production rollout unless blocked by
  known issues with documented mitigation.
