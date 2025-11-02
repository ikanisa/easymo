# Environment Configuration

The shared environment contract for EasyMO services lives in `packages/config/env.ts`. Every runtime
should load configuration through the exported helpers to guarantee consistent validation across
development, staging, and production deployments.

## Schema overview

`loadEnv` inspects `process.env` (or a provided `source`) and returns a strongly-typed object with
three key components:

- `APP_ENV`: Normalised deployment tier (`development`, `staging`, or `production`). Both `NODE_ENV`
  and `APP_ENV` inputs are supported—`stage`/`prod` aliases are automatically mapped to the canonical
  values.
- Shared configuration fields such as `API_BASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`. These
  values remain optional for local development but can be enforced per-service if needed by merging
  additional Zod schemas.
- `featureFlags`: A record of runtime feature toggles derived from environment variables prefixed
  with `FEATURE_` (for example `FEATURE_ADMIN_DASHBOARD=true`). Boolean strings such as `"1"`,
  `"yes"`, and `"enabled"` are accepted; invalid values raise a descriptive error during start-up.

Each environment tier inherits from the same strict TypeScript defaults and introduces opinionated
settings:

| Environment | Defaults                                                                   |
| ----------- | -------------------------------------------------------------------------- |
| development | `ENABLE_DEV_TOOLS=true`, `LOG_LEVEL=debug`                                 |
| staging     | `RELEASE_CHANNEL="staging"`, `LOG_LEVEL=info`                              |
| production  | `ENABLE_DEV_TOOLS=false`, `RELEASE_CHANNEL="production"`, `LOG_LEVEL=warn` |

Because the schemas are defined with Zod, downstream code receives parsed types (for example,
booleans instead of strings). Any missing or malformed values throw immediately, preventing the
application from booting with partial configuration.

## Usage

```ts
import { loadEnv } from "@easymo/config/env";

const env = loadEnv();

if (env.featureFlags["admin_dashboard"]) {
  // Enable the dashboard code path for this request
}
```

Use the optional `{ featureFlagPrefix: "MY_FLAG_" }` parameter when integrating with legacy naming
conventions, or pass a custom `source` object to unit-test environment logic without mutating
`process.env`.

## Feature-flag hygiene

- Prefer short, descriptive names (e.g. `FEATURE_AGENT_BETA`). The parser lowercases and converts
  double underscores (`__`) into dot notation for nested segments.
- Remove retired flags from infrastructure and code paths to keep `featureFlags` compact.
- Feature toggles are designed for runtime checks. Long-lived configuration values should instead be
  promoted to first-class schema fields within `packages/config/env.ts`.
