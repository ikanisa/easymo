# Agent Core Service (Preview)

This package hosts the NestJS application that will back the broker/support AI agents. It ships with a lightweight HTTP interface, Prisma client, and OpenTelemetry scaffolding so we can plug in the OpenAI Agents SDK when the orchestration layer is available.

## Local development

```bash
pnpm install
pnpm --filter @easymo/commons build
pnpm --filter @easymo/db prisma:generate
pnpm --filter @easymo/db prisma:migrate:dev
pnpm --filter @easymo/db seed
pnpm --filter @easymo/agent-core start:dev
```

The included `docker-compose.agent-core.yml` file starts Postgres, Redis, and Kafka locally:

```bash
docker compose -f docker-compose.agent-core.yml up -d
```

## Environment

Copy `.env.example` to `.env` and set the variables before running locally. Feature flags (`FEATURE_AGENT_*`) default to disabled so sensitive flows stay opt-in. Add your OpenAI API key and agent identifier when testing the preview agent runtime.

## Tool endpoints

The `/tools` controller exposes the stub endpoints required by the agent workflows:

- `POST /tools/fetch-lead`
- `POST /tools/log-lead`
- `POST /tools/create-call`
- `POST /tools/set-disposition`
- `POST /tools/register-opt-out`
- `POST /tools/collect-payment`
- `POST /tools/warm-transfer`

Each endpoint performs shape validation and writes structured logs/metrics. The business logic currently persists/reads through Prisma and emits mock responses until the autonomous agent is ready.

### Authentication & RBAC

- Requests must include an `x-agent-jwt` header signed with the configured `JWT_PUBLIC_KEY`.
- The guard enforces tool-level permissions (`lead.read`, `payment.collect`, etc.) sourced from the JWT and the tenant scope from the payload is double-checked before writes.
- `FEATURE_AGENT_COLLECTPAYMENT` and `FEATURE_AGENT_WARMTRANSFER` gate high-risk operations; disable them to fall back to manual runbooks.

### Observability

OpenTelemetry auto-instrumentation sends traces with `service.name=agent-core`, and every HTTP request is wrapped with a structured Pino log containing the propagated `x-request-id`.

## Testing

```bash
pnpm --filter @easymo/agent-core test
```

Unit tests focus on business rules (ledger invariants, attribution) and ensure Prisma writes remain additive-only. OpenTelemetry instrumentation and request ID propagation are exercised via the logging interceptor.
