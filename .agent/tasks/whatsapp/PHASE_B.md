---
description: "PHASE B — OCR (Gemini/OpenAI Vision). Additive only; no Moltbot decisions."
---

# PHASE B — OCR

## B1 — OCR Jobs + Worker + Confidence Gating
Implement:
- create OCR job on inbound media (idempotent)
- worker: fetch media → OCR → structured extraction → confidence
- write OCR output to DB
- update request.requirements ONLY when safe
- low confidence medical → ask clarification; block outreach

**Acceptance**:
- OCR job deduped
- high confidence updates requirements
- low confidence blocks outreach + triggers clarification message

**Rollback**:
- OCR_ENABLED=false
