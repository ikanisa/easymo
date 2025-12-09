# @easymo/sms-parser

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

## Usage

```typescript
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
}
```

## Supported Formats

### MTN Mobile Money
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
