# Local Development

## Prerequisites
- Node.js >= 18.18
- pnpm >= 8
- Docker (for local Supabase)
- Supabase CLI
- Deno (optional, for edge-function tests)

## Setup

```bash
# Install dependencies
pnpm install

# Build shared packages
pnpm run build:deps

# Configure environment
cp .env.example .env

# Start Supabase locally
supabase start

# Apply migrations
supabase db reset

# Start the admin app (default dev target)
pnpm dev
```

## Useful Commands

```bash
# Run all services in parallel (when needed)
pnpm dev:full

# Type check
pnpm type-check

# Lint
pnpm lint

# Test
pnpm test
```

## Notes
- If shared packages change, rerun `pnpm run build:deps`.
- Check the terminal output for the admin app URL/port.
