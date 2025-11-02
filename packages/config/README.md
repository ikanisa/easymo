# Config Package (Strangler Fig)

Centralized runtime configuration will ultimately live in this package instead of being scattered across [`../../src/lib/env.ts`](../../src/lib/env.ts) and individual edge functions.

For now we mirror the existing environment variables while introducing feature flag friendly accessors so new modules can opt-in without waiting for the full migration.
