# OCR Safety Policy

## Purpose
Ensure OCR-extracted information is accurate, confidence-scored, and safely used.

## Core Principle
**Never guess. If uncertain, ask for clarification.**

## Confidence Requirements

### Per-Field Confidence
Every extracted field must have a confidence score (0.0 to 1.0):
- 0.0–0.5: Low confidence (uncertain)
- 0.5–0.75: Medium confidence (likely correct but verify)
- 0.75–1.0: High confidence (can proceed)

### Overall Document Confidence
Average of all field confidences, weighted by importance.

## Medical Prescription Rules

### Safe Field Extraction:
- `patient_name` (optional)
- `prescriber_name` (optional)
- `facility` (optional)
- `date` (optional)
- `items[]`: drug_name, dose, form, quantity, instructions

### Hard Safety Rules:
1. If `drug_name` confidence < 0.75 for ANY item → do NOT proceed to vendor outreach
2. If dose/quantity unclear → ask client to confirm
3. Never substitute or suggest alternative medications
4. Never provide medical advice or dosage recommendations

### Required Warnings:
- `uncertain_drug_name`: drug name could not be read clearly
- `uncertain_dose`: dosage unclear or ambiguous
- `possible_abbreviation`: detected medical abbreviation that may be misread

## General Document/Product Photo Rules

### Safe Field Extraction:
- `product_keywords`, `brands`, `models`
- `colors`, `quantities`
- `addresses_or_landmarks`
- `phone_numbers` (optional)

### Confidence Thresholds:
- Product keywords: proceed if confidence ≥ 0.6
- Brand/model: verify if confidence < 0.7
- Addresses: always verify with client

## Behavior on Low Confidence

### Automatic Actions:
1. Set `requirements_complete = false`
2. Add warnings to OCR result
3. Keep request in `collecting_requirements` or `ocr_processing` state
4. Generate `ask_client` response with specific clarification questions

### What to Ask:
- "I couldn't read [field] clearly. Can you confirm: [extracted value]?"
- "Please resend the image with better lighting if possible."
- "Can you type out the medication name?"

## OCR Engine Fallback
- Primary: Gemini Vision
- Fallback: OpenAI (if Gemini fails)
- Log engine used for each job

## Audit Requirements
- Store full OCR output in `ocr_jobs.extracted`
- Store confidence breakdown in `ocr_jobs.confidence`
- Never log raw OCR text in plaintext logs
- Retain for defined compliance period

## Escalation
If OCR consistently produces low-confidence results:
1. Review prompts and test fixtures
2. Consider alternative engines or preprocessing
3. Document patterns of failure
