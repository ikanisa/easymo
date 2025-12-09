# @easymo/sms-parser

<<<<<<< HEAD
Shared SMS parser package for parsing mobile money transaction SMS messages.

## Features

- **MTN Mobile Money Parser**: Parse MTN MoMo transaction SMS
- **Airtel Money Parser**: Parse Airtel Money transaction SMS
- **Extensible**: Easy to add new parsers for other providers
- **Type-safe**: Full TypeScript support with Zod schemas
=======
SMS parser for Mobile Money transaction messages (MTN, Airtel) in Rwanda.

## Features

- **Multi-provider** - Support for MTN MoMo and Airtel Money
- **Type-safe** - Full TypeScript support
- **Extensible** - Easy to add new providers

## Installation

This is a workspace package. Install dependencies from monorepo root:

```bash
pnpm install
```
>>>>>>> feature/location-caching-and-mobility-deep-review

## Usage

```typescript
<<<<<<< HEAD
import { parseSMS } from '@easymo/sms-parser';

const message = "You have received RWF 5,000 from 0788123456. Your new balance is RWF 10,000. Transaction ID: MP123456789";
const parsed = parseSMS(message, 'MTN');

if (parsed) {
  console.log('Amount:', parsed.amount); // 5000
  console.log('Sender:', parsed.sender); // 0788123456
  console.log('Transaction ID:', parsed.transactionId); // MP123456789
  console.log('Confidence:', parsed.confidence); // 0.9
=======
import { MTNParser, AirtelParser } from "@easymo/sms-parser";

const mtnParser = new MTNParser();
const airtelParser = new AirtelParser();

const sms = "You have received RWF 50,000 from 0781234567. Ref: ABC123. Balance: RWF 125,000";

if (mtnParser.canParse(sms)) {
  const result = mtnParser.parse(sms);
  console.log(result);
  // {
  //   provider: "MTN",
  //   transactionType: "DEPOSIT",
  //   amount: 50000,
  //   currency: "RWF",
  //   reference: "ABC123",
  //   balance: 125000,
  //   raw: "..."
  // }
>>>>>>> feature/location-caching-and-mobility-deep-review
}
```

## Supported Formats

### MTN Mobile Money
<<<<<<< HEAD
- "You have received RWF 5,000 from 0788123456..."
- "You have sent RWF 2,000 to 0788123456..."

### Airtel Money
- "You received RWF 3,000.00 from 0788123456..."
- "You sent RWF 1,500.00 to 0788123456..."

## Build

```bash
pnpm build
```
=======
- Deposit: "You have received RWF X from..."
- Withdrawal: "You have sent RWF X to..."

### Airtel Money
- Deposit: "You have received RWF X..."
- Withdrawal: "You have sent RWF X..."

## Development

```bash
# Build
pnpm --filter @easymo/sms-parser build

# Watch mode
pnpm --filter @easymo/sms-parser dev

# Type check
pnpm --filter @easymo/sms-parser type-check
```

## Adding New Providers

1. Create a new parser class extending `BaseSMSParser`
2. Implement `canParse()` and `parse()` methods
3. Export from `src/parsers/index.ts`

See `src/parsers/mtn.ts` for an example.
>>>>>>> feature/location-caching-and-mobility-deep-review
