# Smoke Tests v1

## Purpose
Production smoke tests to verify AI Concierge is functioning correctly after deployment.

---

## Test 1 — Text Request → Clarification

**Scenario**: User sends vague request.

**Input**:
```
User: I need medicine
```

**Expected**:
- Moltbot asks clarifying question
- No vendor outreach yet
- State: `needs_clarification`

**Verify**:
```sql
SELECT state, clarification_question 
FROM moltbot_requests 
WHERE phone = '+250788000001' 
ORDER BY created_at DESC LIMIT 1;
```

---

## Test 2 — Request with Location → Vendor Outreach

**Scenario**: User provides complete request with location.

**Input**:
```
User: I need Panadol in Kigali
```

**Expected**:
- Moltbot creates vendor outreach plan
- Vendors contacted within 2 minutes
- State: `outreach_in_progress`

**Verify**:
```sql
SELECT state, vendor_outreach_count 
FROM moltbot_requests 
WHERE phone = '+250788000001' 
ORDER BY created_at DESC LIMIT 1;
```

---

## Test 3 — Vendor Replies → Shortlist

**Scenario**: Vendors reply to outreach.

**Precondition**: Test 2 completed, vendors replied.

**Expected**:
- Shortlist generated within 6 minutes of first vendor reply
- State: `shortlist_ready` or `handed_off`
- User receives formatted shortlist

**Verify**:
```sql
SELECT state, shortlist_generated_at, 
       EXTRACT(EPOCH FROM (shortlist_generated_at - outreach_started_at))/60 as minutes_to_shortlist
FROM moltbot_requests 
WHERE phone = '+250788000001' 
ORDER BY created_at DESC LIMIT 1;
```

**SLO**: `minutes_to_shortlist` ≤ 6

---

## Test 4 — Image → OCR Job

**Scenario**: User sends prescription image.

**Input**: Send image of prescription to WhatsApp.

**Expected**:
- OCR job created with status `pending` → `completed`
- Extracted fields populated
- If confidence < 0.7, clarification requested

**Verify**:
```sql
SELECT status, confidence_score, extracted_fields 
FROM moltbot_ocr_jobs 
WHERE request_id = '<request_id>' 
ORDER BY created_at DESC LIMIT 1;
```

---

## Test 5 — Call Consent Flow (Staging Only)

**Scenario**: User consents to call.

**Precondition**: `FEATURE_AI_CONCIERGE_CALLING=true`

**Input**:
```
User: Yes, you can call me
```

**Expected**:
- Consent recorded
- Call initiated (or mock call in staging)
- State includes `call_requested`

**Verify**:
```sql
SELECT consent_given, consent_timestamp, call_status 
FROM moltbot_call_consents 
WHERE phone = '+250788000001' 
ORDER BY created_at DESC LIMIT 1;
```

---

## Automated Smoke Test Script

```bash
#!/bin/bash
# smoke-test.sh

echo "=== AI Concierge Smoke Tests ==="

# Check feature flags
echo "1. Checking feature flags..."
FLAGS=$(curl -s "$SUPABASE_URL/rest/v1/feature_flags?select=name,enabled" \
  -H "apikey: $SUPABASE_ANON_KEY")
echo "$FLAGS" | jq '.[] | select(.name | contains("ai_concierge"))'

# Check recent requests
echo "2. Checking recent AI requests..."
REQUESTS=$(curl -s "$SUPABASE_URL/rest/v1/moltbot_requests?select=state,created_at&order=created_at.desc&limit=5" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
echo "$REQUESTS" | jq '.'

# Check OCR jobs
echo "3. Checking recent OCR jobs..."
OCR=$(curl -s "$SUPABASE_URL/rest/v1/moltbot_ocr_jobs?select=status,confidence_score&order=created_at.desc&limit=5" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
echo "$OCR" | jq '.'

echo "=== Smoke Tests Complete ==="
```

---

## Post-Deployment Checklist

After each deployment, verify:
- [ ] Test 1 passes (clarification flow)
- [ ] Test 2 passes (vendor outreach)
- [ ] Error rate unchanged from baseline
- [ ] No new error types in logs
- [ ] Latency metrics stable
