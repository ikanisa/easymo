# @easymo/sms-parser

Shared SMS parser package for parsing mobile money transaction SMS messages.

## Features

- **MTN Mobile Money Parser**: Parse MTN MoMo transaction SMS
- **Airtel Money Parser**: Parse Airtel Money transaction SMS
- **Extensible**: Easy to add new parsers for other providers
- **Type-safe**: Full TypeScript support with Zod schemas

## Usage

```typescript
import { parseSMS } from '@easymo/sms-parser';

const message = "You have received RWF 5,000 from 0788123456. Your new balance is RWF 10,000. Transaction ID: MP123456789";
const parsed = parseSMS(message, 'MTN');

if (parsed) {
  console.log('Amount:', parsed.amount); // 5000
  console.log('Sender:', parsed.sender); // 0788123456
  console.log('Transaction ID:', parsed.transactionId); // MP123456789
  console.log('Confidence:', parsed.confidence); // 0.9
}
```

## Supported Formats

### MTN Mobile Money
- "You have received RWF 5,000 from 0788123456..."
- "You have sent RWF 2,000 to 0788123456..."

### Airtel Money
- "You received RWF 3,000.00 from 0788123456..."
- "You sent RWF 1,500.00 to 0788123456..."

## Build

```bash
pnpm build
```
