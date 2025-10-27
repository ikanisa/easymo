# WhatsApp Router Edge Function

A lightweight edge function that serves as a single webhook endpoint for WhatsApp Business API. It verifies webhook signatures, normalizes incoming messages, and routes them to target application URLs based on keyword matching.

## Features

- **Webhook Verification**: Handles GET requests for Meta's webhook verification challenge
- **Signature Verification**: Validates `X-Hub-Signature-256` headers using HMAC SHA-256
- **Message Normalization**: Extracts and normalizes WhatsApp message envelopes into a consistent format
- **Keyword-Based Routing**: Routes messages to destination URLs based on detected keywords
- **Structured Logging**: Logs all events with correlation IDs for traceability
- **Error Resilience**: Always returns 200 to Meta to prevent retry storms

## Environment Variables

### Required

- `WA_VERIFY_TOKEN`: Token used for webhook verification (GET requests)
- `WA_APP_SECRET`: WhatsApp App Secret for signature verification

### Destination URLs

Configure one or more destination URLs for routing:

- `DEST_EASYMO_URL`: URL for "easymo" keyword
- `DEST_INSURANCE_URL`: URL for "insurance" keyword
- `DEST_BASKET_URL`: URL for "basket" or "baskets" keywords
- `DEST_QR_URL`: URL for "qr" keyword
- `DEST_DINE_URL`: URL for "dine" keyword

## Routing Logic

The router extracts keywords from:

1. **Text messages**: The message body
2. **Interactive buttons**: The button ID or title
3. **Interactive lists**: The list item ID
4. **Media messages**: The caption text

### Supported Keywords

- `easymo` → Routes to `DEST_EASYMO_URL`
- `insurance` → Routes to `DEST_INSURANCE_URL`
- `basket` or `baskets` → Routes to `DEST_BASKET_URL`
- `qr` → Routes to `DEST_QR_URL`
- `dine` → Routes to `DEST_DINE_URL`

## Payload Format

The router forwards a normalized payload to destination URLs:

```json
{
  "normalized": {
    "from": "250788000001",
    "messageId": "wamid.HBgM...",
    "type": "text",
    "text": "I want insurance",
    "keyword": "insurance",
    "metadata": {
      "phoneNumberId": "123456789",
      "displayPhoneNumber": "250788000000"
    }
  },
  "original": {
    // Original WhatsApp webhook payload
  }
}
```

## Deployment

This function is designed to be deployed as a Supabase Edge Function:

```bash
supabase functions deploy wa-router
```

### Set Environment Variables

```bash
supabase secrets set WA_VERIFY_TOKEN=your_verify_token
supabase secrets set WA_APP_SECRET=your_app_secret
supabase secrets set DEST_EASYMO_URL=https://your-app.com/easymo
supabase secrets set DEST_INSURANCE_URL=https://your-app.com/insurance
supabase secrets set DEST_BASKET_URL=https://your-app.com/basket
supabase secrets set DEST_QR_URL=https://your-app.com/qr
supabase secrets set DEST_DINE_URL=https://your-app.com/dine
```

## Testing

Run the test suite:

```bash
deno test --allow-env supabase/functions/wa-router/index.test.ts
```

## Webhook Configuration

Configure your WhatsApp Business API webhook:

1. **Webhook URL**: `https://your-project.supabase.co/functions/v1/wa-router`
2. **Verify Token**: Set to the value of `WA_VERIFY_TOKEN`
3. **Webhook Fields**: Subscribe to `messages`

## Logs

All events are logged in structured JSON format with correlation IDs:

```json
{
  "event": "ROUTE_COMPLETED",
  "timestamp": "2025-10-27T15:55:53.300Z",
  "correlationId": "uuid-here",
  "messageId": "wamid.HBgM...",
  "keyword": "insurance",
  "destinationUrl": "https://your-app.com/insurance",
  "status": 200,
  "responseTime": 150
}
```

### Event Types

- `WEBHOOK_VERIFICATION_REQUEST`: GET request received
- `WEBHOOK_VERIFICATION_SUCCESS`: Verification succeeded
- `WEBHOOK_VERIFICATION_FAILED`: Verification failed
- `REQUEST_RECEIVED`: POST request received
- `SIGNATURE_VERIFIED`: Signature validation passed
- `SIGNATURE_VERIFICATION_FAILED`: Signature validation failed
- `PAYLOAD_NORMALIZED`: Messages extracted and normalized
- `NO_MESSAGES_FOUND`: No messages in payload
- `NO_ROUTE_FOUND`: No matching keyword found
- `ROUTING_MESSAGE`: Message being routed
- `ROUTE_COMPLETED`: Routing completed (with status/timing)
- `REQUEST_COMPLETED`: Full request processing completed
- `UNHANDLED_ERROR`: Unexpected error occurred

## Code Size

This implementation is under 300 lines and uses only the Deno standard library (no external dependencies).
