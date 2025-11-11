# Wallet Service

Provides a double-entry ledger for the EasyMO marketplace, including commission handling and feature-gated APIs for Phase 5.

## Capabilities

- Double-entry transfer endpoint with optional commission calculations driven by `CommissionSchedule` records.
- Account summary endpoint returning live balances and recent entries.
- **Redis-based idempotency** for distributed deployments.
- **Required idempotency keys** for all financial operations.
- All operations guarded by `FEATURE_WALLET_SERVICE`.

## Usage

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/db prisma:migrate:dev
pnpm --filter @easymo/wallet-service start:dev
```

Transfer example with **required** Idempotency-Key header:

```bash
curl -X POST http://localhost:4400/wallet/transfer \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: unique-request-id-12345678' \
  -d '{
    "tenantId": "a4a8cf2d-0a4f-446c-8bf2-28509641158f",
    "sourceAccountId": "b2f0a6cb-e738-4bd3-b0bd-2c5c0ce40fa3",
    "destinationAccountId": "3a7f03dd-a7ce-4a9d-a099-287153b7c6eb",
    "amount": 42.5,
    "currency": "USD",
    "product": "mobility"
  }'
```

## Idempotency

All financial operations **require** an `Idempotency-Key` header:

- **Format**: 16-255 character string (typically UUID)
- **Storage**: Redis with 24-hour TTL
- **Behavior**: Duplicate requests return cached response
- **Validation**: Enforced at middleware level

Example idempotency keys:
- UUID: `550e8400-e29b-41d4-a716-446655440000`
- Custom: `transfer-2024-01-15-user123-001`

### Error Responses

Missing idempotency key:
```json
{
  "error": "missing_idempotency_key",
  "message": "Idempotency-Key header is required for financial operations"
}
```

Invalid format:
```json
{
  "error": "invalid_idempotency_key",
  "message": "Idempotency-Key must be 16-255 characters"
}
```

## Tests

```bash
pnpm --filter @easymo/wallet-service test
```
