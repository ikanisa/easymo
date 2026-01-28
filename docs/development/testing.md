# Testing

## Common Commands

```bash
# Admin app tests
pnpm test

# Edge function tests (Deno)
pnpm test:functions

# Lint
pnpm lint

# Type-check
pnpm type-check
```

## Notes
- Edge function tests require Deno.
- CI uses `pnpm test:ci` for broader coverage.
