# Attribution Service

This service records attribution metadata for quotes and referrals so that the
sales ledger can reward the correct party when a lead converts. It exposes a
small HTTP API that runs behind service-to-service authentication.

## API Surface

- `POST /attribution/evaluate` — computes the leading attribution signal for a
  quote based on recent referrals and events. Optional `persist` support updates
  the quote row with the evaluated type/entity.
- `POST /attribution/evidence` — stores supporting artifacts (files, notes,
  external references) for later review.
- `POST /attribution/disputes` — allows a sales operator to contest an existing
  attribution decision by logging a dispute record.
- `GET /health` — lightweight readiness check used by the orchestrator.

Each endpoint requires either the internal service token or the scopes defined
in `packages/commons/src/routes/attribution-service.ts`. Requests are rate
limited via Redis when the `RATE_LIMIT_REDIS_URL` setting is present.

## Development

```bash
pnpm --filter services/attribution-service dev
```

Environment variables live in `.env.example`; Prisma migrations are shared via
`packages/db`. The service uses `express`, `pino`, and the shared request
context middleware from `@easymo/commons`.
