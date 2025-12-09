# @ibimina/lib

Shared utility library for the Ibimina platform.

## Modules

### Error Handling

Centralized error handling system with structured error codes.

```typescript
import { AppError, ERROR_CODES } from "@ibimina/lib/errors";

// Throw an error
throw new AppError(ERROR_CODES.AUTH_UNAUTHORIZED, "Custom message");

// Handle errors
try {
  // ...
} catch (error) {
  if (error instanceof AppError) {
    console.log(error.code, error.httpStatus);
  }
}
```

See [ERROR_CODES.md](../../docs/ERROR_CODES.md) for full documentation.

### Observability

Logging and monitoring utilities.

### Security

Security-related utilities including encryption, hashing, and validation.

### Supabase

Supabase client utilities and helpers.

### USSD

USSD protocol handling utilities.

## Installation

This package is part of the Ibimina monorepo and is installed automatically via
pnpm workspace.

## Development

```bash
# Run tests
pnpm test

# Build
pnpm build
```
