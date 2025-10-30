# easyMO Baskets — Architecture Blueprint (Phase 0)

## Objectives
- Connect Ibimina (community savings groups) with SACCO infrastructure.
- Maintain additive-only development path respecting guardrails and data privacy constraints.

## System Overview
- **Admin PWA (Baskets module):** new navigation surface for SACCO staff and committee oversight.
- **WhatsApp Flows:** menu-driven intents (DB-configured) for create/join ikimina, contributions, loans.
- **Edge Functions:**
  - `ibimina-ocr` (OpenAI Vision KYC parsing)
  - `momo-sms-hook` (MoMo SMS ingest via GSM or aggregator)
  - `momo-allocator` (allocation worker)
  - `deeplink-resolver` (joins/invites)
- **Supabase DB:** additive schema extensions for SACCOs, Ibimina, contributions, loans, SMS ingest, KYC.
- **Observability:** dashboards for deposits, allocation success, loan exposure; alerts on unmatched SMS, allocator failures, loan coverage.

## Data Flow (High-Level)
1. **Onboarding:** WhatsApp → `ibimina-ocr` → `kyc_documents` → admin review → create/activate ikimina.
2. **Membership:** Deep links + WhatsApp forms → membership records, enforcing single active ikimina per user.
3. **Contributions:** Member USSD payment → GSM SMS → `momo-sms-hook` → `momo_sms_inbox` → `momo-allocator` → `contributions_ledger` & cycles → rankings view.
4. **Loans:** Member request via WhatsApp → committee endorsements → SACCO staff decision → `sacco_loans` + `sacco_collateral` (LTV enforced) + `sacco_loan_events` timeline.
5. **Reminders:** Scheduler (`baskets-reminder` edge worker) processes `baskets_reminders`, respects quiet hours/throttle policies, queues WhatsApp templates, and records events in `baskets_reminder_events`.

## Guardrails & Compliance
- No edits to existing `wa-webhook` or legacy edge functions.
- All new behavior exposed via DB tables, templates, intents, or newly allowed edge functions.
- PII (IDs, MSISDN) stored in normalized tables; views mask sensitive fields for non-privileged roles.
- Audit log for every mutation path (admin UI, allocation, loans, KYC).

## Interfaces
- **Admin API:** additive routes under `/api/saccos/*`, `/api/baskets/*` for CRUD, reconciliations, reports.
- **WhatsApp:** uses template payload IDs stored in new tables; quiet hours enforced by scheduler.
- **Reports:** accessible via PWA reports section with CSV export endpoints.

## Outstanding Decisions
- Scheduler mechanism (Supabase cron vs external) for reminders. ✅ — Supabase cron (`baskets-reminder`)
- Thresholds for OCR confidence and manual review triggers.
- LTV ratios per SACCO branch (config via settings UI).
