# OCR Routing Rules

## Purpose
Define which incoming messages trigger an OCR job and classify the extraction type.

## Trigger Conditions

An OCR job is created when:
1. `message_type` is `image` OR `document`
2. `media_url` is present and non-empty
3. Message belongs to an active `moltbot_marketplace_request`

## OCR Type Classification

### Medical Prescription (`medical_prescription`)
Triggered when ANY of these signals are present:
- Message text (caption) contains: "prescription", "medicine", "medication", "drug", "pharmacy", "doctor", "clinic", "hospital", "ordonnance", "médicament"
- Prior conversation context indicates medical request
- Document filename contains: "prescription", "rx", "script"

### General Document/Photo (`general_document_or_photo`)
Default for all other image/document messages, including:
- Product photos
- Invoices
- Business cards
- General documents

## Processing Priority

1. `pending` jobs processed in FIFO order
2. Maximum 3 concurrent OCR jobs per conversation
3. Rate limit: 10 jobs per minute per client

## Idempotency Rules

- Dedup key: `message_id + request_id`
- If job exists for same message, skip creation
- Never process same media twice within 5 minutes

## Engine Selection

1. **Primary**: Gemini Vision (gemini-1.5-flash)
2. **Fallback**: OpenAI (gpt-4o-mini) if Gemini fails or unavailable

Log engine used for every job in `provider` field.

## Output Destination

OCR results stored in `moltbot_ocr_jobs`:
- `extracted`: Structured JSON output
- `confidence`: Overall confidence score (0.0-1.0)
- `raw_response`: Full provider response (for debugging)
