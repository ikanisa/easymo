# @easymo/supabase-schemas

Database schemas and TypeScript types for the EasyMO platform's Supabase database.

## Overview

This package provides:
- Zod schemas for validation
- TypeScript types for database tables
- Enum types for database columns

## Usage

```typescript
import { 
  UserSchema, 
  type User,
  MomoTerminalSchema,
  type MomoTerminal,
} from '@easymo/supabase-schemas';

// Validate data
const result = UserSchema.safeParse(data);
if (result.success) {
  const user: User = result.data;
}
```

## SACCO Schemas

SACCO-related schemas are re-exported from `@easymo/sacco-core`:

```typescript
import {
  MemberSchema,
  IkiminaSchema,
  PaymentSchema,
} from '@easymo/supabase-schemas';
```

## Available Schemas

| Schema | Description |
|--------|-------------|
| `UserSchema` | User accounts |
| `SaccoSchema` | SACCO organizations |
| `MomoTerminalSchema` | MoMo Terminal devices |
| `SmsWebhookLogSchema` | SMS webhook processing logs |
| `AuditLogSchema` | Audit trail entries |
| `MemberSchema` | SACCO members (from sacco-core) |
| `IkiminaSchema` | Savings groups (from sacco-core) |
| `PaymentSchema` | Payments (from sacco-core) |

## Enums

Available enum types in `enums.ts`:
- `UserRole`
- `EntityStatus`
- `PaymentStatus`
- `PaymentMethod`
- `IkiminaType`
- `MemberStatus`
- `TerminalStatus`
- `SmsProcessingStatus`
- `AuditOperation`

## Merger Note

Additional schemas from the Ibimina repository will be merged into this package.
See `docs/MERGER_PLAN.md` for details.
