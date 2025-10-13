# Incident Runbook Tabletop Exercise Plan

## Purpose

Validate incident response readiness for critical scenarios before production
launch.

## Participants

- Incident Commander (on-call engineer)
- Data Platform Lead
- Messaging Operations Lead
- Support Manager
- Observer/Recorder

## Scenarios

1. **Voucher Preview EF Outage**
   - Inject: Health check fails, Admin shows degraded badge.
   - Expected Actions: Follow Voucher Preview runbook, notify support, reroute
     to mock messaging, redeploy EF.
2. **WhatsApp Throttle Spike**
   - Inject: Campaign send receives multiple 429 responses.
   - Expected: Pause campaign, adjust throttle, communicate delay, resume with
     reduced batch.
3. **Supabase Partial Outage**
   - Inject: Audit log writes fail (observability captured), RLS fallback
     triggered.
   - Expected: Activate DR plan, assess data impact, restore from snapshot if
     needed.

## Timeline

- 90-minute tabletop session.
- 15 min briefing, 20 min per scenario, 15 min debrief.

## Evaluation Criteria

- Time to identify incident and assign roles.
- Adherence to `INCIDENT_RUNBOOKS.md` steps.
- Communication effectiveness (internal/external).
- Documentation captured in postmortem template.

## Deliverables

- Completed checklist per scenario.
- Identified gaps appended to risk register or remediation plan.
- Updated runbooks with clarifications post-session.

## Scheduling

- Target week after Sprint 1 completion.
- Use staging environment to inject simulated issues (no production impact).
