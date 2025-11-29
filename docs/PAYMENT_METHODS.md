# EasyMO Payment Methods

## Supported Payment Methods

EasyMO supports **ONLY** the following payment methods:

### 1. Mobile Money USSD (Africa)
- **Method ID**: `momo_ussd`
- **Regions**: Africa
- **Type**: USSD-based mobile money
- **Implementation**: Direct USSD integration with local telcos

### 2. Revolut Payment Links (Europe/UK/Canada/Malta)
- **Method ID**: `revolut_link`
- **Regions**: Malta, Europe, UK, Canada
- **Type**: Payment link redirect
- **Implementation**: Revolut Business API

## Usage in Code

### Backend (Metrics Tracking)
```typescript
import { businessMetrics } from '@easymo/commons';

// Track USSD payment
businessMetrics.trackPayment('momo_ussd', 50.00, 'success');

// Track Revolut payment
businessMetrics.trackPayment('revolut_link', 120.50, 'success');

// Track failed payment
businessMetrics.trackPayment('momo_ussd', 25.00, 'failed', 'INSUFFICIENT_FUNDS');
```

### Database Schema
The `payment_method` field accepts any string value:
```sql
payment_method TEXT
```

Valid values:
- `'momo_ussd'` - Mobile Money USSD
- `'revolut_link'` - Revolut Payment Link

## NOT Supported

The following payment methods are **NOT supported** and should never be used:

- ❌ M-Pesa (Kenya)
- ❌ Stripe
- ❌ PayPal
- ❌ Credit/Debit Cards (direct)
- ❌ Bank Transfers (direct)
- ❌ Cash on Delivery

## Regional Availability

| Region | Payment Method | Status |
|--------|---------------|--------|
| Africa | `momo_ussd` | ✅ Active |
| Malta | `revolut_link` | ✅ Active |
| Europe | `revolut_link` | ✅ Active |
| UK | `revolut_link` | ✅ Active |
| Canada | `revolut_link` | ✅ Active |

## Implementation Notes

### USSD Flow (Africa)
1. User initiates payment
2. System generates USSD code
3. User dials code on phone
4. User confirms payment with PIN
5. System receives webhook confirmation
6. Payment marked as successful

### Revolut Flow (Europe/UK/Canada/Malta)
1. User initiates payment
2. System generates payment link via Revolut API
3. User redirected to Revolut
4. User completes payment
5. System receives webhook confirmation
6. Payment marked as successful

## Configuration

### Environment Variables

#### USSD (Africa)
```bash
MOMO_USSD_API_KEY=your-api-key
MOMO_USSD_API_SECRET=your-secret
MOMO_USSD_WEBHOOK_URL=https://api.easymo.dev/webhooks/momo
```

#### Revolut (Europe/UK/Canada/Malta)
```bash
REVOLUT_API_KEY=your-api-key
REVOLUT_WEBHOOK_SECRET=your-webhook-secret
REVOLUT_WEBHOOK_URL=https://api.easymo.dev/webhooks/revolut
```

## Monitoring

Payment metrics are tracked via Prometheus:

```prometheus
# Total payments by method
payment_transactions_total{payment_method="momo_ussd",status="success"}
payment_transactions_total{payment_method="revolut_link",status="success"}

# Payment amounts
payment_amount_usd{payment_method="momo_ussd"}
payment_amount_usd{payment_method="revolut_link"}

# Payment failures
payment_failures_total{payment_method="momo_ussd",error_code="INSUFFICIENT_FUNDS"}
payment_failures_total{payment_method="revolut_link",error_code="CARD_DECLINED"}
```

## Error Codes

### USSD Errors
- `INSUFFICIENT_FUNDS` - User doesn't have enough balance
- `INVALID_PIN` - User entered wrong PIN
- `TIMEOUT` - User didn't complete payment in time
- `NETWORK_ERROR` - Telco network issue
- `CANCELLED` - User cancelled payment

### Revolut Errors
- `CARD_DECLINED` - Card was declined
- `INSUFFICIENT_FUNDS` - Insufficient funds
- `FRAUD_DETECTED` - Payment flagged as fraudulent
- `NETWORK_ERROR` - Revolut API unavailable
- `CANCELLED` - User cancelled payment

## Testing

### Test Credentials (Sandbox)

#### USSD Sandbox
```bash
MOMO_USSD_API_KEY=sandbox_key
MOMO_USSD_API_SECRET=sandbox_secret
MOMO_USSD_SANDBOX_MODE=true
```

Test phone numbers:
- Success: `+25078xxxxxxx`
- Failure: `+25079xxxxxxx`

#### Revolut Sandbox
```bash
REVOLUT_API_KEY=sandbox_key
REVOLUT_SANDBOX_MODE=true
```

Test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Webhook Security

Both payment providers use webhook signatures for security:

```typescript
// USSD webhook verification
const signature = req.headers['x-momo-signature'];
const isValid = verifyMomoSignature(req.body, signature, MOMO_USSD_API_SECRET);

// Revolut webhook verification
const signature = req.headers['revolut-signature'];
const isValid = verifyRevolutSignature(req.body, signature, REVOLUT_WEBHOOK_SECRET);
```

## Support Contacts

- **USSD Issues**: ussd-support@easymo.dev
- **Revolut Issues**: revolut-support@easymo.dev
- **General Payment Questions**: payments@easymo.dev

---

**Last Updated**: 2025-11-29  
**Maintained By**: EasyMO Engineering Team
