# Admin App E2E Tests

These Vitest specs exercise the higher-level admin journeys without hitting
live services. Supabase interactions and outbound policy checks are mocked to
keep the suite deterministic.

## Running

```bash
npm test -- --run tests/e2e/admin-flows.test.ts
```

> The command uses existing Vitest configuration, so no extra setup is needed.

## Coverage

- Mobility trip feed with recent events (ensures passenger + driver nudges stay
  in sync for dispatchers).
- OCR jobs listing for admin review.
- Notification retry workflow, including policy blocks during quiet hours.

Add new end-to-end scenarios here as the admin surface grows.
