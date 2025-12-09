---
{
  "title": "Reference Token Best Practices (English)",
  "language_code": "en",
  "tags": ["reference", "reconciliation", "training"],
  "policy_tag": "reference",
  "scope": "global"
}
---

**Purpose of the reference**

- Connects MoMo transactions with Atlas ledger entries.
- Enables same-day reconciliation between SMS receipts, statements, and Atlas.

**Structure**

`GROUPCODE-MEMBERCODE-YYYYMMDD-SEQ`

- `GROUPCODE`: Four letters from the ikimina code (e.g., `IKAL`).
- `MEMBERCODE`: Member short code (e.g., `MA01`).
- `YYYYMMDD`: Meeting or transaction date.
- `SEQ`: Optional sequence if multiple payments in one day (`A`, `B`, `C`).

**Do's**

- Pre-fill the reference on group attendance sheets.
- Spell out the reference before handing the phone back to the member.
- Correct the reference immediately if the SMS receipt shows a mistake.

**Don'ts**

- Never reuse yesterday's reference; it breaks reconciliation automation.
- Avoid free text like "Savings"—the system cannot match it.
