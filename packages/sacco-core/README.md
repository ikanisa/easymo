# @easymo/sacco-core

Shared package for SACCO/MFI domain logic and types.

## Features

- **TypeScript Types**: Zod schemas for SACCO, Member, Payment, Ikimina entities
- **Phone Utilities**: Masking, hashing, and normalization for phone numbers
- **Reference Generation**: Payment reference and code generators
- **Rwanda Constants**: Districts, sectors, and administrative divisions

## Usage

```typescript
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
