# Reconciliation Service

The Reconciliation Service handles payment transaction reconciliation, Mobile Money SMS parsing, transaction matching, and dispute resolution across the EasyMO platform.

## Purpose

- **Payment Reconciliation**: Match payments with orders and transactions
- **MoMo SMS Parsing**: Parse and extract data from Mobile Money SMS notifications
- **Transaction Matching**: Automatically match incoming payments to pending orders
- **Dispute Resolution**: Handle payment discrepancies and disputes
- **Audit Trail**: Maintain complete record of all reconciliation activities

## Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (via Prisma)
- **Message Queue**: Kafka (for payment events)
- **Package Dependencies**:
  - `@easymo/commons` - Shared utilities and logging
  - `@easymo/db` - Database client
  - `@easymo/messaging` - Kafka client

## Architecture

### Key Components

1. **SMS Parser**: Extracts transaction data from MoMo SMS
2. **Transaction Matcher**: Matches payments to orders using fuzzy matching
3. **Reconciliation Engine**: Reconciles transactions across systems
4. **Dispute Manager**: Handles unmatched or disputed transactions
5. **Audit Logger**: Records all reconciliation activities

### Payment Flow

```
Mobile Money SMS → SMS Parser → Transaction Matcher → Order Update → Wallet Update
                                      ↓
                               Unmatched → Dispute Queue → Manual Review
```

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agent_core

# MoMo Configuration
MOMO_SMS_HMAC_SECRET=your-secret-key
MOMO_ALLOCATOR_BATCH_SIZE=10
MOMO_ALLOCATOR_REQUIRE_TXN_ID=true
MOMO_ALLOCATOR_MIN_CONFIDENCE=0.6

# SMS Parsing
MOMO_SMS_ALLOWED_IPS=192.168.1.0/24
MOMO_SMS_DEFAULT_SOURCE=EASYMO

# Logging
LOG_LEVEL=info

# Service Port
PORT=4900
```

See [ENV_VARIABLES.md](../../docs/ENV_VARIABLES.md) for complete reference.

## Installation

```bash
# Install dependencies
pnpm install

# Build the service
pnpm --filter reconciliation-service build
```

## Development

```bash
# Run in development mode with hot reload
pnpm --filter reconciliation-service dev

# Run tests
pnpm --filter reconciliation-service test

# Run tests with coverage
pnpm --filter reconciliation-service test:cov
```

## API Endpoints

### SMS Webhook

**POST /momo/sms**

Receives Mobile Money SMS notifications.

**Headers:**
```
X-HMAC-Signature: sha256=...
```

**Request:**
```json
{
  "from": "+250788123456",
  "message": "You have received RWF 5,000 from John Doe (0788123456). Ref: MP240129.1234.A12345",
  "timestamp": "2025-01-29T10:30:00Z"
}
```

**Response:**
```json
{
  "ok": true,
  "transactionId": "uuid",
  "matched": true,
  "orderId": "uuid"
}
```

### Manual Reconciliation

**POST /reconcile/manual**

Manually reconcile a transaction.

**Request:**
```json
{
  "transactionId": "uuid",
  "orderId": "uuid",
  "amount": 5000,
  "currency": "RWF",
  "notes": "Manual reconciliation by admin"
}
```

**Response:**
```json
{
  "ok": true,
  "reconciliationId": "uuid",
  "status": "reconciled"
}
```

### Dispute Management

**GET /disputes**

List unreconciled transactions.

**Query Parameters:**
- `status` - Filter by status (pending, reviewing, resolved)
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)

**Response:**
```json
{
  "disputes": [
    {
      "id": "uuid",
      "transactionId": "uuid",
      "amount": 5000,
      "currency": "RWF",
      "status": "pending",
      "reason": "Amount mismatch",
      "createdAt": "2025-01-29T10:00:00Z"
    }
  ],
  "total": 10,
  "page": 1
}
```

**PUT /disputes/:id/resolve**

Resolve a dispute.

**Request:**
```json
{
  "resolution": "matched",
  "orderId": "uuid",
  "notes": "Resolved by matching transaction reference"
}
```

### Transaction Query

**GET /transactions/:id**

Get transaction details and reconciliation status.

**Response:**
```json
{
  "id": "uuid",
  "amount": 5000,
  "currency": "RWF",
  "reference": "MP240129.1234.A12345",
  "status": "reconciled",
  "orderId": "uuid",
  "reconciledAt": "2025-01-29T10:35:00Z"
}
```

## SMS Parsing

### Supported Formats

The service parses SMS from various Mobile Money providers:

**MTN MoMo (Rwanda):**
```
You have received RWF 5,000 from John Doe (0788123456). Ref: MP240129.1234.A12345
```

**Airtel Money:**
```
You got RWF5000 from 250788123456. Ref: AM1234567890. Balance: RWF50000
```

### Extraction Logic

The parser extracts:
- **Amount**: Numeric value and currency
- **Sender**: Phone number or name
- **Reference**: Transaction reference code
- **Timestamp**: Transaction time (if available)

### Matching Algorithm

1. **Reference Matching**: Try exact reference match (highest confidence)
2. **Amount + Time Window**: Match by amount within time window (30 minutes)
3. **Phone Number**: Match by sender phone number + amount
4. **Fuzzy Matching**: Use confidence scoring for ambiguous cases

**Confidence Scoring:**
- Exact reference: 1.0
- Amount + Time + Phone: 0.9
- Amount + Time: 0.7
- Amount only: 0.5
- Below threshold (0.6): Manual review required

## Database Schema

### Tables

**reconciliation_transactions**
- `id` - UUID primary key
- `external_reference` - External transaction reference
- `amount` - Transaction amount
- `currency` - Currency code
- `sender_phone` - Sender phone number
- `order_id` - Matched order (nullable)
- `status` - Status (pending, matched, disputed)
- `confidence` - Match confidence (0.0-1.0)
- `reconciled_at` - Reconciliation timestamp
- `created_at` - Creation timestamp

**reconciliation_disputes**
- `id` - UUID primary key
- `transaction_id` - Foreign key to transactions
- `reason` - Dispute reason
- `status` - Status (pending, reviewing, resolved)
- `resolution_notes` - Resolution notes
- `resolved_by` - Admin user ID
- `resolved_at` - Resolution timestamp
- `created_at` - Creation timestamp

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test SMS parsing
pnpm test -- --grep "SMS Parser"

# Watch mode
pnpm test:watch
```

### Test Cases

- SMS format parsing (multiple providers)
- Transaction matching (various scenarios)
- Confidence scoring
- Webhook signature verification
- Dispute creation and resolution

## Monitoring

### Metrics

- SMS received count
- Successful matches count
- Failed matches count
- Average confidence score
- Dispute resolution time
- Reconciliation latency

### Logs

All reconciliation activities are logged:

```typescript
import { logger } from '@easymo/commons';

logger.info({
  event: 'TRANSACTION_MATCHED',
  transactionId: tx.id,
  orderId: order.id,
  amount: tx.amount,
  confidence: 0.95
});

logger.warn({
  event: 'LOW_CONFIDENCE_MATCH',
  transactionId: tx.id,
  confidence: 0.65,
  reason: 'Amount match only'
});
```

## Security

### Webhook Verification

All incoming SMS webhooks must include HMAC signature:

```typescript
const signature = req.headers['x-hmac-signature'];
const body = req.body;
const secret = process.env.MOMO_SMS_HMAC_SECRET;

const expected = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(body))
  .digest('hex');

if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  throw new UnauthorizedException('Invalid signature');
}
```

### PII Protection

Phone numbers and personal data are masked in logs:

```typescript
logger.info({
  sender: maskPhoneNumber('+250788123456') // +25078****56
});
```

## Troubleshooting

### Common Issues

**Issue: SMS not parsed correctly**
- Check SMS format matches expected patterns
- Review parser regex patterns
- Test with actual SMS samples

**Issue: Low confidence matches**
- Verify transaction reference is included in SMS
- Check time window configuration
- Review confidence threshold settings

**Issue: Webhook signature verification fails**
- Verify `MOMO_SMS_HMAC_SECRET` is correct
- Check request body is not modified
- Ensure raw body is used for signature

**Issue: Disputes not resolved**
- Check manual reconciliation API
- Verify admin permissions
- Review dispute queue size

See [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md) for more help.

## Best Practices

1. **Always verify webhooks** - Never trust unverified requests
2. **Log all reconciliations** - Maintain complete audit trail
3. **Monitor confidence scores** - Alert on low confidence patterns
4. **Handle edge cases** - Plan for ambiguous matches
5. **Test with real data** - Use actual SMS samples for testing

## Related Services

- **Wallet Service**: Updates balances after reconciliation
- **Buyer Service**: Order status updates
- **Vendor Service**: Payment notifications

## Documentation

- [Architecture Overview](../../docs/ARCHITECTURE.md)
- [API Documentation](./docs/api.md)
- [SMS Parsing Guide](./docs/sms-parsing.md)
- [Matching Algorithm](./docs/matching.md)

---

**Maintained by**: EasyMO Platform Team  
**Last Updated**: 2025-10-29
