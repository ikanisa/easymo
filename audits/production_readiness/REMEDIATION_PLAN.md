# Remediation Plan

## Sprint 1 (Weeks 1-2)

### Security
- **Objective:** Eliminate lateral access to operational tables.
- **Artifacts:** New RLS policies for `voucher_events`, `campaign_targets`, `settings`; regression tests in Supabase migrations repo.
- **Acceptance Criteria:** Admin-only reads enforced; station/user contexts limited; automated tests pass in CI.
- **Dependencies:** Schema review with Data Platform; Supabase migration approvals.

### Data / RLS
- **Objective:** Ensure audit log writes persist even during transient outages.
- **Artifacts:** Deferred audit queue design doc; implementation ticket; monitoring dashboard spec.
- **Acceptance Criteria:** `recordAudit` pathway documented with retry strategy; fallback usage alert defined.
- **Dependencies:** Observability tooling selection.

### Observability
- **Objective:** Establish EF health monitoring.
- **Artifacts:** Supabase Edge Function probe definitions; Grafana/Looker dashboards; PagerDuty alerts.
- **Acceptance Criteria:** Simulated EF outage triggers alert within <5 minutes; dashboard shows OK/degraded status.
- **Dependencies:** Messaging of on-call rotation; access to monitoring stack.

### Docs / Runbooks
- **Objective:** Validate incident playbooks.
- **Artifacts:** Tabletop exercise notes appended to `audits/production_readiness/INCIDENT_RUNBOOKS.md`; sign-off checklist.
- **Acceptance Criteria:** On-call engineers acknowledge steps; gaps logged in risk register.
- **Dependencies:** Scheduling with ops team.

## Sprint 2 (Weeks 3-4)

### Reliability
- **Objective:** Harden station redeem flow against offline double-spend.
- **Artifacts:** Design ADR for client-side queue; server idempotency endpoint spec; QA plan updates.
- **Acceptance Criteria:** Prototype demonstrates single-use guarantee under simulated network flaps.
- **Dependencies:** Station PWA engineering bandwidth; Supabase function support.

### Messaging Policy
- **Objective:** Illuminate quiet hour/throttle enforcement.
- **Artifacts:** Structured logging spec; dashboard stories; policy alert runbook.
- **Acceptance Criteria:** Operators can view last 24h of blocked sends with reasons; alert thresholds defined.
- **Dependencies:** Observability backlog from Sprint 1.

### Voucher Integrity
- **Objective:** Formalize voucher PNG/QR integrity tests.
- **Artifacts:** Test plan covering QR binary diff, PNG metadata checks; automation story.
- **Acceptance Criteria:** QA scripts validate no re-encoding; station scope enforced in redeem tests.
- **Dependencies:** QA tooling updates.

### Admin UX / A11y
- **Objective:** Close WCAG gaps in Admin Panel.
- **Artifacts:** Accessibility audit report; ticket backlog for identified issues; updated `QA_MATRIX.md` scenarios.
- **Acceptance Criteria:** Critical flows keyboard accessible; contrast ratios meet AA; screen-reader smoke test complete.
- **Dependencies:** Design review sign-off.

## Sprint 3 (Weeks 5-6)

### Performance
- **Objective:** Validate campaign throughput and Supabase sizing.
- **Artifacts:** Load test scripts (Locust/K6); capacity model doc; results readout added to `LOAD_TEST_PLAN.md`.
- **Acceptance Criteria:** Campaign dispatcher sustains agreed TPS without WABA throttling; SLOs recorded.
- **Dependencies:** Messaging policy instrumentation; Supabase connection tuning.

### Station PWA UX
- **Objective:** Improve outdoor usability and offline cues.
- **Artifacts:** Design mockups, implementation tickets for high-contrast theme and offline banners; user testing plan.
- **Acceptance Criteria:** Field test with station operators; survey feedback ≥4/5 for readability.
- **Dependencies:** Voucher integrity updates; PWA release window.

### Docs / Runbooks
- **Objective:** Publish DR/backup procedure.
- **Artifacts:** Backup schedule doc; restore dry-run report; updates to `SYSTEM_CHECKLIST.md`.
- **Acceptance Criteria:** Backup jobs documented with SLAs; restore exercise completed within RTO.
- **Dependencies:** Coordination with Supabase support.

