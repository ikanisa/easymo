# @easymo/migration-shared

Shared utilities for Ibimina→EasyMO migration and go-live tooling.

## Purpose

This package provides common functionality to avoid duplication between:
- `scripts/ibimina-migration/` - Data migration tooling
- `scripts/go-live/` - Operational cutover tooling

## Exports

### `@easymo/migration-shared/config`

Type-safe configuration management with Zod validation.

```typescript
import { createConfig, loadEnv } from "@easymo/migration-shared/config";
import { z } from "zod";

// Load environment variables
loadEnv("path/to/.env");

// Define schema
const schema = z.object({
  SOURCE_URL: z.string().url(),
  DRY_RUN: z.coerce.boolean().default(false),
});

// Get validated config
const config = createConfig(schema);
```

### `@easymo/migration-shared/logger`

Colorized, structured logging with progress indicators.

```typescript
import { logger } from "@easymo/migration-shared/logger";

logger.configure({ verbose: true });

logger.header("Migration Started");
logger.info("Processing records...");
logger.success("Migration complete");
logger.error("Something failed", { details: "..." });

logger.progress(50, 100, "Migrating users");
logger.checklist([
  { name: "Database connected", status: "pass" },
  { name: "Data validated", status: "warn" },
]);
```

### `@easymo/migration-shared/db-clients`

Supabase client factory with connection pooling.

```typescript
import { 
  createSourceClient, 
  createTargetClient, 
  testConnection,
  getTableCount 
} from "@easymo/migration-shared/db-clients";

const source = createSourceClient(sourceUrl, sourceKey);
const target = createTargetClient(targetUrl, targetKey);

await testConnection(source, "Source DB");
const count = await getTableCount(target, "members");
```

### `@easymo/migration-shared/types`

Common TypeScript types.

```typescript
import type { 
  CheckStatus, 
  OperationResult, 
  BatchResult 
} from "@easymo/migration-shared/types";
```

## Development

```bash
cd scripts/_shared
pnpm install
pnpm typecheck
pnpm build
```

## Usage in Other Scripts

1. Add to `package.json`:
```json
{
  "dependencies": {
    "@easymo/migration-shared": "workspace:*"
  }
}
```

2. Import:
```typescript
import { logger } from "@easymo/migration-shared/logger";
import { createConfig } from "@easymo/migration-shared/config";
```

## Guidelines

- ✅ Keep exports focused and minimal
- ✅ No business logic - utilities only
- ✅ Maintain backward compatibility
- ✅ Document all public APIs
