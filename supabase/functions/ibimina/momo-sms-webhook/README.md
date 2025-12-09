# MoMo SMS Webhook

Supabase Edge Function that receives and processes Mobile Money SMS relayed from the MomoTerminal Android app.

## Overview

This webhook endpoint enables real-time payment verification for SACCO contributions by:
1. Receiving SMS notifications from MomoTerminal devices
2. Verifying request authenticity via HMAC signatures
3. Parsing payment details (amount, sender, transaction ID)
4. Auto-matching to pending payments
5. Storing for manual review when auto-match fails

## Security

The endpoint implements multiple security layers:
- **HMAC-SHA256 signature verification** using shared secrets
- **Timestamp validation** (5-minute window) for replay protection
- **Device authentication** via device_id
- **Row-level security** on database tables
- **Service role** access for database writes

## Request Format

### Headers
```
X-Momo-Signature: <hmac-sha256-hex>
X-Momo-Timestamp: <unix-timestamp>
X-Momo-Device-Id: <device-identifier>
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

### Body
```json
{
  "source": "momoterminal",
  "version": "1.0.0",
  "timestamp": "1234567890",
  "phone_number": "+233XXXXXXXXX",
  "sender": "MTN MoMo",
  "message": "You have received 5,000.00 GHS from JOHN DOE. Transaction ID: 123456789...",
  "device_id": "android-device-xyz",
  "signature": "computed-by-client"
}
```

## Response Format

### Success (200)
```json
{
  "success": true,
  "id": "uuid-of-sms-record",
  "matched": true,
  "confidence": 0.80
}
```

### Error Responses
- `401` - Missing headers, expired request, or invalid signature
- `403` - Phone number not configured
- `400` - Invalid JSON or missing fields
- `500` - Database error

## SMS Parsing

The function recognizes payment SMS from:

### MTN MoMo
```
You have received 5,000.00 GHS from JOHN DOE. 
Transaction ID: 123456789. Your new balance is...
```

### Vodafone Cash
```
You have received GHS 5,000.00 from JOHN DOE. 
Ref: VC123456...
```

### AirtelTigo
```
You have received 5000 GHS from JOHN DOE. 
TxnID: AT123456...
```

## Auto-Matching Logic

The database trigger attempts to match incoming SMS to pending payments by:
1. Matching exact amount (converted to minor units)
2. Status must be `PENDING`
3. Payment occurred within last 24 hours
4. Payment timestamp ≤ SMS received timestamp
5. Takes most recent matching payment

When matched:
- SMS record updated with `matched_payment_id` and `processed=true`
- Payment status updated to `VERIFIED`
- Confidence score assigned (0.80 for amount-based match)

## Configuration

Each device must be registered in `app.momo_webhook_config`:

```sql
INSERT INTO app.momo_webhook_config (
  momo_phone_number,
  webhook_secret,
  device_id,
  is_active
) VALUES (
  '+233XXXXXXXXX',
  'your-secret-key-here',
  'android-device-xyz',
  true
);
```

## Testing

### Local Testing
```bash
# Start Supabase locally
supabase start

# Deploy function locally
supabase functions serve momo-sms-webhook

# Test with curl
curl -X POST http://localhost:54321/functions/v1/momo-sms-webhook \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "X-Momo-Signature: COMPUTED_HMAC" \
  -H "X-Momo-Timestamp: $(date +%s)" \
  -H "X-Momo-Device-Id: test-device" \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Production Deployment
```bash
supabase functions deploy momo-sms-webhook
```

## Monitoring

Key metrics to monitor:
- Request rate per device
- Signature verification failures
- Parse success rate by provider
- Auto-match success rate
- Processing latency

Logs are structured with prefixes:
- `momo-sms-webhook.missing_headers`
- `momo-sms-webhook.stale_request`
- `momo-sms-webhook.invalid_signature`
- `momo-sms-webhook.sms_parsed`
- `momo-sms-webhook.success`

## Related

- Database migration: `20251126152600_momo_sms_inbox.sql`
- Staff dashboard: `apps/pwa/staff-admin/app/(main)/payments/momo-inbox`
- Setup guide: `docs/MOMO_WEBHOOK_SETUP.md`
