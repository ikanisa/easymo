# Vendor Portal - Quick Reference

## Commands

```bash
# Install all dependencies
pnpm install

# Build shared packages (required before using vendor portal)
pnpm --filter @easymo/sacco-core build
pnpm --filter @easymo/sms-parser build

# Development
pnpm --filter @easymo/vendor-portal dev      # Start dev server (port 3003)
pnpm --filter @easymo/vendor-portal build    # Production build
pnpm --filter @easymo/vendor-portal lint     # Lint code
pnpm --filter @easymo/vendor-portal type-check  # Type check

# Shared packages
pnpm --filter @easymo/sacco-core dev         # Watch mode
pnpm --filter @easymo/sms-parser dev         # Watch mode
```

## File Locations

```
vendor-portal/           # Next.js vendor portal app
├── package.json
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── .env.example
└── README.md           # Full documentation

packages/sacco-core/     # SACCO business logic
├── src/
│   ├── types/          # Zod schemas (Sacco, Member, etc.)
│   ├── utils/          # Phone, currency, reference utils
│   └── constants/      # Rwanda data
└── README.md

packages/sms-parser/     # SMS parsing
├── src/
│   ├── parsers/        # MTN, Airtel parsers
│   └── utils/          # Normalization
└── README.md

VENDOR_PORTAL_PHASE_1_COMPLETE.md  # Implementation summary
```

## Usage Examples

### @easymo/sacco-core

```typescript
import { formatPhoneNumber, formatCurrency } from "@easymo/sacco-core";

const phone = formatPhoneNumber("0781234567");
// => "078 123 4567"

const amount = formatCurrency(1234567);
// => "RWF 1,234,567"
```

### @easymo/sms-parser

```typescript
import { MTNParser } from "@easymo/sms-parser";

const parser = new MTNParser();
const sms = "You have received RWF 50,000 from 0781234567. Ref: ABC123";

if (parser.canParse(sms)) {
  const result = parser.parse(sms);
  console.log(result?.amount); // 50000
  console.log(result?.reference); // "ABC123"
}
```

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3003
NEXT_PUBLIC_APP_NAME=Vendor Portal
```

## Phase 1 Status

✅ **Complete** (37 files)

- Vendor portal configuration
- @easymo/sacco-core package
- @easymo/sms-parser package
- Documentation

## Phase 2 Roadmap

⏳ **Pending** (~60 files)

- App directory structure
- Authentication (Supabase SSR)
- Dashboard layout
- UI components
- Member management
- Payment reconciliation

## Documentation

- `vendor-portal/README.md` - Complete setup guide
- `packages/sacco-core/README.md` - Package usage
- `packages/sms-parser/README.md` - SMS parsing
- `VENDOR_PORTAL_PHASE_1_COMPLETE.md` - Implementation summary

## Integration

- **Database**: Uses existing `app.*` schema (no new migrations)
- **Migration toolkit**: Displays data from `scripts/ibimina-migration/`
- **Edge functions**: Can import `@easymo/sms-parser`
- **Admin panel**: Shares `@easymo/sacco-core` types

---

**Last Updated**: 2025-12-09  
**Status**: Phase 1 Complete ✅
