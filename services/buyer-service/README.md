# Buyer Service

Handles buyer onboarding, intent capture, and purchase confirmation for the marketplace flow.

## Endpoints

- `POST /buyers` – create buyer profile + wallet account.
- `POST /buyers/:id/intents` – create an intent with payload metadata.
- `POST /purchases` – record a purchase and optionally invoke the wallet service.
- `GET /buyers/:id/context` – fetch buyer profile along with recent intents and trips.

All routes are gated by `FEATURE_MARKETPLACE_BUYER`.

## Local usage

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/buyer-service start:dev
```

## Tests

```bash
pnpm --filter @easymo/buyer-service test
```
