# Ibimina to EasyMO Data Migration

Safely migrate data from Ibimina Supabase to EasyMO Supabase with PII protection.

## Features

- ✅ **Batched processing** - Handles large datasets efficiently
- ✅ **PII protection** - Encrypts, hashes, and masks sensitive data
- ✅ **ID mapping** - Preserves relationships between tables
- ✅ **Dry run mode** - Test migration without making changes
- ✅ **Verification** - Compare record counts post-migration
- ✅ **Rollback** - Emergency data removal if needed
- ✅ **Progress tracking** - Visual progress bars and timing

## Prerequisites

- Node.js 18+
- pnpm
- Access to both Supabase projects (service role keys)
- Phase 1-3 migrations applied to EasyMO (app.* schema exists)

## Setup

1. **Navigate to migration directory:**
   ```bash
   cd scripts/ibimina-migration
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` with your credentials:**
   ```env
   # Source (Ibimina)
   SOURCE_SUPABASE_URL=https://xxx.supabase.co
   SOURCE_SUPABASE_SERVICE_KEY=eyJhbG...

   # Target (EasyMO)
   TARGET_SUPABASE_URL=https://yyy.supabase.co
   TARGET_SUPABASE_SERVICE_KEY=eyJhbG...

   # PII Encryption (32+ characters)
   PII_ENCRYPTION_KEY=your-secure-32-character-key-here

   # Options
   BATCH_SIZE=100
   DRY_RUN=false
   VERBOSE=true
   ```

## Usage

### 1. Dry Run (Recommended First)

Test migration without making any changes:

```bash
pnpm dry-run
```

This will:
- Connect to both databases
- Read all source records
- Validate and transform data
- Report what would be migrated
- **NOT modify any data**

### 2. Execute Migration

Run the actual migration:

```bash
pnpm migrate
```

You'll be prompted to confirm before any data is modified.

### 3. Verify Migration

Compare record counts between source and target:

```bash
pnpm verify
```

### 4. Emergency Rollback

If something goes wrong, delete all migrated data:

```bash
pnpm rollback
```

⚠️ This requires typing "ROLLBACK" to confirm.

## Migration Order

Tables are migrated in dependency order:

1. `saccos` - SACCO registry (no dependencies)
2. `ikimina` - Savings groups (depends on saccos)
3. `members` - Members (depends on saccos, ikimina)
4. `accounts` - Accounts (depends on members)
5. `payments` - Payments (depends on members, accounts)
6. `ledger_entries` - Ledger (depends on accounts)

## PII Handling

Sensitive data is protected using three methods:

| Method | Purpose | Algorithm |
|--------|---------|-----------|
| **Encrypted** | Data recovery | AES-256-GCM |
| **Hashed** | Lookups/matching | SHA-256 |
| **Masked** | Display | Custom masking |

### Example:

| Original | Encrypted | Hashed | Masked |
|----------|-----------|--------|--------|
| `0781234567` | `a1b2c3...` | `e3b0c44...` | `078****567` |
| `1199012345678901` | `d4e5f6...` | `ba7816b...` | `11****8901` |

## ID Mappings

After migration, a JSON file is saved with all ID mappings:

```
migration-mappings-1702123456789.json
```

This allows you to:
- Track which source IDs map to which target IDs
- Debug relationship issues
- Re-run partial migrations

## Troubleshooting

### Connection Failed

Ensure your service role keys have access to the `app` schema:

```sql
GRANT USAGE ON SCHEMA app TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA app TO service_role;
```

### Foreign Key Errors

If you see foreign key constraint errors:
1. Run rollback: `pnpm rollback`
2. Check that Phase 1 migrations are applied
3. Re-run migration: `pnpm migrate`

### PII Decryption

To decrypt a phone number (for debugging):

```typescript
import { decrypt } from "./src/utils/crypto.js";

const phone = decrypt("iv:authTag:encrypted");
console.log(phone); // 0781234567
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Ibimina DB     │     │   EasyMO DB      │
│  (Source)       │     │   (Target)       │
│                 │     │                  │
│  app.saccos     │────►│  app.saccos      │
│  app.ikimina    │────►│  app.ikimina     │
│  app.members    │─PII─►│  app.members     │
│  app.accounts   │────►│  app.accounts    │
│  app.payments   │────►│  app.payments    │
│  app.ledger_*   │────►│  app.ledger_*    │
└─────────────────┘     └──────────────────┘
        │                       │
        └───────┬───────────────┘
                │
         ┌──────▼──────┐
         │  IdMapper   │
         │  (JSON)     │
         └─────────────┘
```

## File Structure

```
scripts/ibimina-migration/
├── README.md                    # This file
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── .env.example                 # Environment template
├── src/
│   ├── index.ts                 # Main orchestrator
│   ├── config.ts                # Configuration loader
│   ├── logger.ts                # Logging utilities
│   ├── types.ts                 # TypeScript types
│   ├── validators/              # Data validation
│   │   ├── index.ts
│   │   ├── sacco.ts
│   │   ├── member.ts
│   │   ├── payment.ts
│   │   └── group.ts
│   ├── migrators/               # Table migrators
│   │   ├── index.ts
│   │   ├── base.ts              # Base migrator class
│   │   ├── saccos.ts
│   │   ├── members.ts
│   │   ├── accounts.ts
│   │   ├── payments.ts
│   │   ├── groups.ts
│   │   └── ledger.ts
│   └── utils/
│       ├── db.ts                # Database clients
│       ├── crypto.ts            # PII encryption
│       ├── progress.ts          # Progress bars
│       └── id-mapping.ts        # ID tracking
└── scripts/
    ├── dry-run.ts               # Test migration
    ├── migrate.ts               # Execute migration
    ├── verify.ts                # Verify counts
    └── rollback.ts              # Emergency rollback
```

## Development

### Type Checking

```bash
pnpm typecheck
```

### Adding a New Table

1. Add source/target types to `src/types.ts`
2. Create validator in `src/validators/`
3. Create migrator in `src/migrators/`
4. Add to migration order in `src/index.ts`
5. Update verification tables in `scripts/verify.ts`
6. Update rollback order in `scripts/rollback.ts`

## Security Notes

- ✅ Service role keys stored in `.env` (git-ignored)
- ✅ PII encrypted with AES-256-GCM
- ✅ Encryption key must be 32+ characters
- ✅ No plaintext PII stored in target database
- ✅ Hashes use SHA-256 for lookups
- ✅ Masked values for display/logging

## Support

For issues or questions:
1. Check logs for specific error messages
2. Run dry-run mode to test without modifications
3. Verify database connections and permissions
4. Ensure Phase 1-3 migrations are applied to target

---

**Last Updated**: 2025-12-09  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
