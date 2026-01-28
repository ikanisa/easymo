# Data Classification — Moltbot System

This document classifies all Moltbot-related tables by sensitivity level and defines access patterns.

---

## Sensitivity Levels

### 🔴 Highly Sensitive (Server-Only)

These tables contain PII, medical data, or sensitive behavioral data. Access is restricted to service role only.

| Table | Contains | Retention |
|-------|----------|-----------|
| `moltbot_conversation_messages` | Client messages, media URLs | 90 days |
| `moltbot_ocr_jobs` | Photo of prescriptions, extracted medical data | 90 days |
| `moltbot_call_consents` | Consent records, timestamps | Indefinite |
| `moltbot_call_attempts` | Call logs, recordings (if any) | 90 days |
| `moltbot_audit_events` | Full audit trail with input/output hashes | 1 year |

### 🟠 Medium Sensitivity (Server-Only in v1)

Business logic and vendor interaction data. Currently service-role-only but may be exposed via controlled APIs in future.

| Table | Contains | Access Pattern |
|-------|----------|----------------|
| `moltbot_marketplace_requests` | Requirements, shortlist, state | Backend API only |
| `moltbot_vendor_outreach` | Outreach messages, vendor responses | Backend API only |

### 🟢 Low Sensitivity (Potentially Public)

Business directory data that could be exposed publicly in future.

| Table | Contains | Future Access |
|-------|----------|---------------|
| `vendors` | Business name, categories, location | Public read (after vetting) |

---

## PII Fields Reference

| Field | Table | Current Handling |
|-------|-------|------------------|
| `client_phone` | `moltbot_conversations` | Masked in logs/exports |
| `body` | `moltbot_conversation_messages` | Redacted in exports |
| `media_url` | `moltbot_ocr_jobs` | Signed URL, short TTL |
| `extracted` | `moltbot_ocr_jobs` | Summarized in exports |
| `vendor_phone` | `vendors` | Masked until final handoff |

---

## Retention Policy

- **Conversations/Messages**: 90 days after `closed` state, then archive/delete
- **OCR Jobs**: 90 days after completion
- **Audit Events**: 1 year for compliance
- **Call Records**: 90 days (or per legal requirements)

---

## Compliance Notes

- All PII handling follows GDPR/local privacy law principles
- Data subject access requests can be fulfilled via reconciliation pack export
- Deletion requests honored within retention window constraints
