# Ranking Service

Ranks vendors for marketplace intents by blending internal metrics with live trip data from existing Easymo APIs.

## Highlights

- Pulls vendor metrics from the shared Prisma schema and combines them with recent trips retrieved from `admin-trips`.
- Scoring algorithm weights rating, fulfilment, response time, experience, recency, and wallet liquidity.
- Protected by the `FEATURE_MARKETPLACE_RANKING` flag.

## Run Locally

```bash
cp .env.example .env
pnpm install
pnpm --filter @easymo/ranking-service start:dev
```

Fetch ranked vendors:

```bash
curl 'http://localhost:4500/ranking/vendors?tenantId=a4a8cf2d-0a4f-446c-8bf2-28509641158f'
```

## Tests

```bash
pnpm --filter @easymo/ranking-service test
```
