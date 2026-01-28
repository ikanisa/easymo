# Pilot Operations Schedule

> **Version:** 1.0  
> **Created:** 2026-01-28

---

## Weekly Cadence

| Day | Activity | Owner | Docs |
|-----|----------|-------|------|
| **Monday** | QA Review (10 random requests) | Ops Lead | [qa-checklist.v1.md](./qa-checklist.v1.md) |
| **Wednesday** | KPI Dashboard Review | Ops Lead | [pilot-kpis.v1.md](./pilot-kpis.v1.md) |
| **Friday** | Improvement Loop Meeting | All Teams | [weekly-improvement.v1.md](./weekly-improvement.v1.md) |

---

## Vendor Onboarding Workflow

When adding a new vendor:

1. **Add to database** with correct phone number
2. **Send intro message** using template from [vendor-onboarding.v1.md](./vendor-onboarding.v1.md)
3. **Confirm receipt** (wait for vendor acknowledgment or reply)
4. **Set preferences** via admin panel:
   - `preferred_language` (en/fr/rw)
   - `preferred_categories` (optional filtering)

---

## Escalation Contacts

| Role | Contact | Responsibility |
|------|---------|----------------|
| Ops Lead | [TBD] | QA reviews, vendor issues |
| AI Team Lead | [TBD] | Moltbot prompt issues |
| Backend Lead | [TBD] | Parsing bugs, rate limits |

See [human-escalation.v1.md](./human-escalation.v1.md) for escalation triggers.

---

## Quick Links

- [Vendor Onboarding](./vendor-onboarding.v1.md)
- [Human Escalation](./human-escalation.v1.md)
- [QA Checklist](./qa-checklist.v1.md)
- [Weekly Improvement](./weekly-improvement.v1.md)
- [Pilot KPIs](./pilot-kpis.v1.md)
- [Rate Limits Rule](../../.agent/rules/96_vendor_rate_limits.md)
