---
description: "Implement OCR + structured extraction (Gemini primary) for WhatsApp media (prescriptions, invoices, product photos). Produces confidence-scored fields, safety checks, and a deterministic handoff into Moltbot context packs."
---

# Workflow 04 — OCR Pipeline (Gemini) + Safe Extraction

## Goal
Enable clients to send images/documents (e.g., medical prescriptions), extract structured info safely:
- Gemini is the default OCR/extraction engine
- Every extracted field has confidence + provenance
- Low confidence triggers clarification questions; never guess medical details
- OCR output is normalized into marketplace taxonomy

## Outputs
1) OCR worker/service module (async)
2) Gemini OCR + extraction prompt templates
3) `extracted` JSON schema + `confidence` schema (per-field)
4) Safety rules for prescriptions
5) Tests with fixture images

## Step 1 — Define OCR input routing rules
Create `.agent/rules/30_ocr_routing.md`:

Which messages create an OCR job?
- message_type in: `image`, `document`
- media_url present

Routing decision:
- If text implies medical → `ocr_type = medical_prescription`
- Else: `ocr_type = general_document_or_photo`

## Step 2 — Define the OCR output schemas
Create `docs/ocr/ocr-output.v1.json`:

### A) `extracted` object:
- `meta`: ocr_type, engine, source_message_id, processed_at
- `text_full`: complete OCR text
- `fields`: structured extraction

### B) `confidence` object:
- `text_full`: 0..1
- `fields`: per-field confidence
- `warnings`: array of strings

## Step 3 — Define structured fields

### Medical prescription (safe minimal):
- `patient_name`, `prescriber_name`, `facility`, `date`
- `items[]`: drug_name, dose, form, quantity, instructions

**Hard rule:** If `drug_name` confidence < 0.75 for any item, mark warning and do NOT claim certainty.

### General (marketplace-friendly):
- `product_keywords`, `brands`, `models`, `colors`, `quantities`
- `addresses_or_landmarks`, `phone_numbers`, `notes`

## Step 4 — Gemini prompts
Create `docs/ocr/gemini-prompts.v1.md`:

### Prompt A — medical_prescription
- Extract text faithfully
- Extract structured fields
- Include confidence per field
- If uncertain, say "uncertain" and lower confidence

### Prompt B — general
- Focus on product signals, brands/models, addresses/landmarks

## Step 5 — OCR worker implementation
Create: `src/ocr/worker.ts`

Worker loop:
1. Fetch next `ocr_jobs` where `status='queued'`
2. Set status = `processing`
3. Download media
4. Call Gemini with correct prompt
5. Validate output against schema
6. Write extracted + confidence
7. On failure: status = `failed`, create clarification path

### Safety for prescriptions
If warnings contain `uncertain_drug_name` OR >2 items with confidence < 0.75:
→ next action must be `ask_client` (clarify)

## Step 6 — Normalization
Create: `src/ocr/normalize.ts`

Medical → marketplace requirements:
- `requirements.category = "pharmacy"`
- `requirements_complete = true` only if confident

General → marketplace requirements:
- Infer category from keywords/brands
- If uncertain, force clarification

## Step 7 — Client messaging templates
Create `docs/ocr/client-messages.v1.md`:
- "Processing your image…"
- "I'm not fully sure about: [X]. Can you confirm?"
- "I couldn't read the image clearly. Please resend…"

## Step 8 — Tests
Fixtures: prescription, invoice, product photo

Assert:
1. Schema validation passes
2. Low confidence triggers clarify path
3. Worker is idempotent

## Done when
- Client sends image → OCR job → extracted + confidence → safe requirements update
