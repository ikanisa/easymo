# Loan Policy — Baskets Module (Skeleton)

## Eligibility
- Contribution streak requirements
- Group savings LTV thresholds (enforced via `saccos.ltv_min_ratio`)
- Borrower must belong to an active ikimina

## Workflow
1. Member request
2. Committee endorsements
3. SACCO review & decision
4. Disbursement & repayment tracking with reminder scheduling

## Collateral
- Group savings pledged via `sacco_collateral` (sources: group_savings, member_savings, guarantor, asset).
- Loan snapshots (`sacco_loans.collateral_total`, `sacco_loans.ltv_ratio`) refresh automatically on insert/update/delete of collateral rows.
- LTV enforcement blocks transitions to `approved`/`disbursed` when coverage is below the configured threshold.

## Audit & Timeline
- `sacco_loan_events` captures status transitions including source, actor, and notes.
- Committee votes update `sacco_loan_endorsements` and transition loans to `endorsing` or `rejected` when thresholds met.

## Audit & Compliance
- Decisions logged with rationale.
- Notifications for approvals/rejections.
- Reminder scheduler logs notification blocks (quiet hours, throttles) in `baskets_reminder_events`.
