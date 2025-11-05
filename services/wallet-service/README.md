# Wallet Service

Provides a double-entry ledger for the EasyMO marketplace, including commission handling and feature-gated APIs for Phase 5.

## Capabilities

- Double-entry transfer endpoint with optional commission calculations driven by `CommissionSchedule` records.
- Account summary endpoint returning live balances and recent entries.
- All operations guarded by `FEATURE_WALLET_SERVICE`.

## Usage

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/db prisma:migrate:dev
pnpm --filter @easymo/wallet-service start:dev
```

Transfer example:

```bash
curl -X POST http://localhost:4400/wallet/transfer \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "a4a8cf2d-0a4f-446c-8bf2-28509641158f",
    "sourceAccountId": "b2f0a6cb-e738-4bd3-b0bd-2c5c0ce40fa3",
    "destinationAccountId": "3a7f03dd-a7ce-4a9d-a099-287153b7c6eb",
    "amount": 42.5,
    "currency": "USD",
    "product": "mobility"
  }'
```

## Tests

```bash
pnpm --filter @easymo/wallet-service test
```
