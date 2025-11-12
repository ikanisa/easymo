# Supabase Admin Client Usage

This document explains how to obtain Supabase admin clients safely within the
admin application.

## Server-only helper

Use the server helper `getSupabaseAdminClient` provided by
`admin-app/lib/server/supabase-admin.ts` when you need elevated privileges in
API route handlers or other server utilities. The helper:

- Ensures execution on the server (throws if invoked in the browser).
- Reads credentials from the mandatory server environment variables
  (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`).
- Wraps `createServerClient` from `@supabase/ssr` so that request cookies and
  headers are forwarded automatically, which keeps auditing headers and session
  continuity intact for edge and server runtimes.
- Returns `null` when Supabase is intentionally disabled (for example when
  mocks are used during development) so that callers can short-circuit
  gracefully.

```ts
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return new Response("Service unavailable", { status: 503 });
  }

  const { data, error } = await supabase.from("agent_personas").select("*");
  // ...
}
```

Avoid constructing admin clients directly with `@supabase/supabase-js` or the
browser helper. Doing so will skip the SSR wiring and can break authentication
or observability headers in server contexts.

## RSC and server actions

Server components and actions that need the admin client can import
`createAdminClient` from `@/src/v2/lib/supabase/client`. The helper shares the
same safeguards as `getSupabaseAdminClient` and is safe to use in RSC code.

```ts
import { createAdminClient } from "@/src/v2/lib/supabase/client";

export async function loadAdminData() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("agent_personas").select("*");
  return data;
}
```

Both helpers reuse the current request's cookies and headers and will throw if
run in the browser, making it clear when privileged operations are used in an
unsupported context.
