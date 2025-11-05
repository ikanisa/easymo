# Vendor Service

Manages vendor catalog, wallet provisioning, and quote generation for Phase 5 marketplace flows.

## Endpoints

- `POST /vendors` – create a vendor profile and wallet account.
- `GET /vendors` – list vendors for a tenant (optional region filter).
- `POST /vendors/:id/quotes` – generate a pending quote for an intent.

All endpoints are gated behind `FEATURE_MARKETPLACE_VENDOR`.

## Local Setup

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/vendor-service start:dev
```

## Tests

```bash
pnpm --filter @easymo/vendor-service test
```
