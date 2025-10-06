# Release Checklist — Baskets Module (Skeleton)

## Pre-Launch Gates
- Schema migrations applied (staging → production).
- RLS policies verified with role-based tests.
- Edge functions deployed and smoke-tested.
- Admin UI end-to-end walkthrough (SACCO staff + committee + member journeys).
- WhatsApp flows QA (create, join, contribute, loan request).

## Feature Flags / Toggles
- Baskets module navigation
- SMS allocator activation
- Loan workflow

## Observability
- Dashboards configured (deposits, allocation success, loans).
- Alerts for unmatched SMS, allocator failures, loan coverage.

## Support Runbooks
- Allocation runbook published.
- Loan policy & KYC SOPs shared with operations.

## Go/No-Go Criteria
- Zero unmatched SMS backlog > threshold
- Quiet hours compliance in staging dry-run
- Committee endorsements & SACCO decisions validated for sample data

