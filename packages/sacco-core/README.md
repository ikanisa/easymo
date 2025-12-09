# @easymo/sacco-core

Shared business logic and type definitions for SACCO/MFI operations in the EasyMO platform.

## Features

- **Type-safe schemas** - Zod schemas for all SACCO entities
- **Utility functions** - Phone formatting, currency, references
- **Constants** - Rwanda districts, provinces, mobile money providers

## Installation

This is a workspace package. Install dependencies from monorepo root:

```bash
pnpm install
```

## Usage

```typescript
import { 
  Sacco, 
  Member, 
  Payment,
  formatPhoneNumber,
  formatCurrency,
  RWANDA_DISTRICTS 
} from "@easymo/sacco-core";

// Use types
const sacco: Sacco = {
  id: "uuid",
  name: "Twisungane SACCO",
  // ...
};

// Format phone
const formatted = formatPhoneNumber("0781234567");
// => "078 123 4567"

// Format currency
const amount = formatCurrency(1234567);
// => "RWF 1,234,567"
```

## Development

```bash
# Build
pnpm --filter @easymo/sacco-core build

# Watch mode
pnpm --filter @easymo/sacco-core dev

# Type check
pnpm --filter @easymo/sacco-core type-check
```

## Types

- `Sacco` - SACCO entity
- `Member` - Member (with PII protection)
- `Payment` - Payment transaction
- `Account` - Member account
- `Ikimina` - Savings group

See `src/types/` for full definitions.
