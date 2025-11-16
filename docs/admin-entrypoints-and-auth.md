# Admin panel entrypoints, auth wiring, and docs catalog summary

## Admin/front-end entrypoints
- **admin-app (Next.js admin panel)**: Uses the App Router. Public access is limited to `/` and `/login`, while middleware enforces sessions on all other routes via the `admin_session` cookie and returns a 401 JSON response and clears the cookie when missing. The middleware also injects `x-request-id` headers for tracing on every request.
- **Login flow**: `/login` renders the `LoginForm` client component, which posts to `/api/auth/login`. The login API validates payloads with Zod, rate-limits by email, validates CSRF tokens (logs warning but does not block), verifies credentials, and writes a signed, HttpOnly `admin_session` cookie with configurable TTL before redirecting to `/dashboard`.
- **Supabase usage in admin-app**: Client-side Supabase access is centralized in `lib/supabase-client`, which builds a singleton browser client when public URL/anon key env vars exist and disables session persistence. Server-side APIs and routes use `lib/server/supabase-admin` to create a Supabase service-role client when service credentials are present and throw on browser usage.
- **Waiter PWA**: The customer-facing PWA bootstraps Supabase via `lib/supabase.ts`, which builds a browser client from public env vars using `createBrowserClient` from `@supabase/ssr` (not the standard `createClient` from `@supabase/supabase-js` as in admin-app). Unlike the admin-app, it does not explicitly disable session persistence in the configuration. The localized home page checks for an existing Supabase session, signs in anonymously when starting a session, and routes diners into the chat flow.
- **Apps workspace**: `apps/app-apis` and `apps/router-fn` currently only contain TypeScript configs, indicating placeholder/infra-only entrypoints for now.

## Backend auth wiring
- **Agent Core (NestJS)**: Requests are gated by `ServiceAuthGuard`, which expects an `x-agent-jwt` header, validates RS256 JWTs against a configured public key, supports an internal token bypass for trusted callers, attaches parsed agent context (tenant, permissions, etc.) to the request, and enforces decorator-driven permission checks. Invalid or missing tokens raise `UnauthorizedException`; missing permissions raise `ForbiddenException`.

## Markdown catalog
The full catalog of Markdown files (excluding `node_modules/`) with heuristic freshness tags lives at `docs/markdown-catalog.md` (auto-generated: files in `docs/archive/` or names containing `complete`, `final`, `status`, or `summary` are marked **Outdated**, all others **Current**).
