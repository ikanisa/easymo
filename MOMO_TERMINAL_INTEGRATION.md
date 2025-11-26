# MomoTerminal Integration Guide

## Overview

This integration enables the MomoTerminal Android app to relay Mobile Money SMS to easymo- for automatic payment verification across services: rides, marketplace, jobs, and insurance.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MomoTerminal (Android App)                        │
│                  SMS Listener + Webhook Dispatcher                   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              momo-sms-webhook (Supabase Edge Function)               │
│  1. Verify HMAC signature                                            │
│  2. Parse SMS content                                                │
│  3. Route to service matcher                                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Rides Matcher │   │ Marketplace   │   │ Jobs/Insurance│
│               │   │   Matcher     │   │   Matcher     │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Setup

### 1. Apply Database Migration

```bash
supabase db push
```

### 2. Deploy Edge Function

```bash
supabase functions deploy momo-sms-webhook --no-verify-jwt
```

### 3. Configure Webhook Endpoints

Add phone-to-service mappings:

```sql
INSERT INTO momo_webhook_endpoints (
  momo_phone_number,
  service_type,
  webhook_secret,
  description
) VALUES
  ('+233XXXXXXXXX', 'rides', 'secret-for-rides-phone', 'Rides MoMo phone'),
  ('+233YYYYYYYYY', 'marketplace', 'secret-for-marketplace', 'Marketplace MoMo phone');
```

### 4. Configure MomoTerminal App

In MomoTerminal app settings:
- **Webhook URL**: `https://<project-ref>.supabase.co/functions/v1/momo-sms-webhook`
- **Phone Number**: Your MoMo receiving phone
- **Webhook Secret**: Same as configured in database

## Payload Structure

```json
{
  "source": "momoterminal",
  "version": "1.0",
  "timestamp": "2025-11-26T10:30:00Z",
  "phone_number": "+233788123456",
  "sender": "MTN MoMo",
  "message": "You have received 50.00 GHS from JOHN DOE. Transaction ID: 123456789.",
  "device_id": "device-uuid"
}
```

## Headers

| Header | Description |
|--------|-------------|
| `X-Momo-Signature` | HMAC-SHA256 signature of request body |
| `X-Momo-Timestamp` | Unix timestamp (request expires after 5 min) |
| `X-Momo-Device-Id` | Device identifier |
| `Content-Type` | `application/json` |

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success - SMS processed |
| 400 | Invalid payload |
| 401 | Invalid signature or expired request |
| 403 | Phone not configured |
| 500 | Internal error |

## Monitoring

View transactions in admin dashboard or query directly:

```sql
SELECT * FROM momo_transactions 
ORDER BY received_at DESC 
LIMIT 100;
```

## Troubleshooting

### Common Issues

1. **401 - Invalid Signature**
   - Verify webhook secret matches between app and database
   - Check that request body is not modified in transit

2. **403 - Phone Not Configured**
   - Add the phone number to `momo_webhook_endpoints` table
   - Ensure `is_active = true`

3. **Payment Not Matched**
   - Check `momo_transactions` table for status
   - Verify amount matches exactly
   - Check time window (payments must be within 24-72 hours)

## Ground Rules Compliance

✅ **Observability**: All events logged with structured logging and correlation IDs  
✅ **Security**: HMAC signature verification, PII masking, RLS policies  
✅ **Metrics**: Counters for received SMS, matched/unmatched payments, errors  

## Service Matchers

### Rides
- Looks for `ride_payments` with matching amount in last 24 hours
- Updates payment and trip status on match
- Confidence: 0.95

### Marketplace
- Looks for `orders` with matching amount in last 48 hours
- Updates payment status on match
- Confidence: 0.90

### Jobs
- Looks for `job_payments` with matching amount in last 72 hours
- Updates payment status on match
- Confidence: 0.85

### Insurance
- Looks for `insurance_payments` with matching amount in last 7 days
- Updates payment and policy status on match
- Confidence: 0.90

## Database Schema

### momo_webhook_endpoints
Maps phone numbers to services with HMAC secrets.

### momo_transactions
Stores all incoming SMS with parsing results and match status.

## Next Steps

1. Deploy using `./deploy-momo-sms-webhook.sh`
2. Configure endpoint mappings in database
3. Set up MomoTerminal app
4. Monitor transactions in `momo_transactions` table
