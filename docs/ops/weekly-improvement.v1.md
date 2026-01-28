# Weekly Improvement Loop

> **Version:** 1.0  
> **Last Updated:** 2026-01-28

---

## Cadence

**When:** Every Friday  
**Duration:** 1–2 hours  
**Participants:** Ops lead, AI team rep, Backend team rep

---

## Weekly Tasks

### 1. Taxonomy Updates
- [ ] Review unrecognized needs from the week
- [ ] Add 3–5 new synonyms to taxonomy
- [ ] Update category mappings if needed
- [ ] Test normalizeNeed with new entries

### 2. Vendor Tagging
- [ ] Review vendors with low match rates
- [ ] Update `preferred_categories` for active vendors
- [ ] Add inventory tags for high-volume vendors
- [ ] Remove stale or inactive vendors from rotation

### 3. E2E Scenario Expansion
- [ ] Add 2–3 new golden scenarios from real requests
- [ ] Include edge cases discovered during QA
- [ ] Run E2E suite and verify all pass

### 4. Stop Condition Tuning
- [ ] Review requests that over-expanded (too many batches)
- [ ] Review requests that under-expanded (stopped too early)
- [ ] Adjust stop thresholds in rules if needed

### 5. Cost Review
- [ ] Check AI token usage for the week
- [ ] Review outreach message counts
- [ ] Flag any budget overruns
- [ ] Adjust rate limits if costs too high

---

## Improvement Log

Track weekly improvements in `docs/ops/improvement-log.md`:

```
## Week of [Date]

### Taxonomy
- Added: [synonyms]
- Updated: [categories]

### Vendors
- Tagged: [count] vendors
- Removed: [count] inactive

### E2E
- Added scenarios: [count]
- All tests: ✅ / ❌

### Costs
- Token usage: [amount]
- Outreach messages: [count]
- Budget status: OK / WARNING
```

---

## Escalation

If any metric is out of bounds for 2+ consecutive weeks:
1. Create a dedicated task for deep investigation
2. Assign owner from relevant team
3. Set 1-week deadline for resolution proposal
