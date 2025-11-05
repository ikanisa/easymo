# Environment Configuration

EasyMO centralizes environment validation in [`packages/config/env.ts`](../packages/config/env.ts). The module exposes Zod schemas for every deployment stage and runtime feature flags so applications can fail fast when configuration is missing.

## Stage Detection

`loadEnvironment()` inspects the following variables (first non-empty wins) to determine the active stage:

1. `DEPLOYMENT_ENV`
2. `APP_ENV`
3. `STAGE`
4. `ENVIRONMENT`
5. `NODE_ENV`

Values beginning with `prod` map to **production**, values beginning with `stage` or the literal `preview` map to **staging**, and all others default to **development**.

## Base Schema

All stages share the core schema below:

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | URL to the Supabase project. |
| `SUPABASE_ANON_KEY` | Anonymous Supabase key used by clients. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for secure server-side calls. |
| `OPENAI_API_KEY` | API key for OpenAI integrations. |
| `DATABASE_URL` | Connection string for Postgres (optional in development). |
| `API_BASE_URL` | Base URL for HTTP clients. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint (optional). |
| `SENTRY_DSN` | Sentry DSN for error tracking (optional). |
| `LOG_LEVEL` | One of `debug`, `info`, `warn`, or `error` (defaults to `info`). |

## Stage-Specific Rules

- **Development**: Supplies defaults for `DATABASE_URL` (`postgresql://postgres:postgres@localhost:5432/postgres`) and `API_BASE_URL` (`http://localhost:3000`).
- **Staging**: Requires a valid `DATABASE_URL` and constrains `VERCEL_ENV` to `preview` or `production` (default `preview`).
- **Production**: Inherits staging requirements and forces `VERCEL_ENV` to `production`.

Retrieve the schema for a specific stage via `getEnvironmentSchema(stage)` if you need to validate configuration manually.

## Runtime Feature Flags

`parseRuntimeFeatureFlags()` reads the boolean feature flags listed below. Truthy values include `true`, `1`, `yes`, and `on` (case insensitive).

| Flag | Environment Variable | Description |
| --- | --- | --- |
| `agentChat` | `FEATURE_AGENT_CHAT` | Enable WhatsApp chat capabilities. |
| `agentVoice` | `FEATURE_AGENT_VOICE` | Enable realtime voice agents. |
| `agentVouchers` | `FEATURE_AGENT_VOUCHERS` | Allow voucher operations through agents. |
| `agentCustomerLookup` | `FEATURE_AGENT_CUSTOMER_LOOKUP` | Permit customer lookup workflows. |
| `otelTracing` | `ENABLE_OTEL_TRACING` | Toggle OpenTelemetry exporters. |
| `costDashboard` | `ENABLE_COST_DASHBOARD` | Surface the internal cost dashboard. |

The returned object exposes `flags`, an `enabled` array, and `isEnabled(flag)` for ergonomic checks at runtime.

## Usage Example

```ts
// Environment variables are loaded from process.env
const stage = process.env.NODE_ENV || 'development';
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

console.log(`Running in ${stage}`);
console.log(`API base URL: ${apiBaseUrl}`);

// Feature flags can be checked directly
const agentVoiceEnabled = process.env.FEATURE_AGENT_VOICE === 'true';
if (agentVoiceEnabled) {
  enableVoicePipelines();
}
```

Always validate required environment variables during service start-up so misconfiguration is caught during deploys instead of at runtime.
