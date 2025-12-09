# @easymo/sacco-core

<<<<<<< HEAD
Shared package for SACCO/MFI domain logic and types.

## Features

- **TypeScript Types**: Zod schemas for SACCO, Member, Payment, Ikimina entities
- **Phone Utilities**: Masking, hashing, and normalization for phone numbers
- **Reference Generation**: Payment reference and code generators
- **Rwanda Constants**: Districts, sectors, and administrative divisions
=======
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
>>>>>>> feature/location-caching-and-mobility-deep-review

## Usage

```typescript
<<<<<<< HEAD
import {
  type Sacco,
  type Member,
  maskPhone,
  hashPhone,
  generatePaymentReference,
  RWANDA_DISTRICTS,
} from '@easymo/sacco-core';

// Mask phone for display
const masked = maskPhone('+250788123456'); // +250****3456

// Hash for database lookup
const hash = hashPhone('+250788123456');

// Generate payment reference
const ref = generatePaymentReference(); // 20241209-143022-A3F9K2
```

## Build

```bash
pnpm build
```
=======
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
>>>>>>> feature/location-caching-and-mobility-deep-review
