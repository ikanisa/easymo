# Admin App Data Layer

## Goals

- Consolidate all network reads/writes behind React Query to enable caching,
  retries, and offline resilience.
- Keep mock-data fallbacks functional until Supabase APIs are wired in.
- Ensure every server mutation is idempotent and audited as described in the
  blueprint.

## Architecture

- `lib/api/client.ts` centralises fetch logic, injecting `x-request-id` headers
  for observability.
- `lib/api/queryClient.ts` exports helpers for creating configured `QueryClient`
  instances on server and browser.
- Query keys follow the structure `[domain, scope?, params?]`, e.g.
  `['vouchers', { status, search }]`.
- Server Components should use `react-query`'s `dehydrate`/`HydrationBoundary`
  pattern (to be added in Phase 1 Step 2).
- When an API route is unavailable, queries should surface degraded-state flags
  so the UI can respond gracefully.

## Query Behaviour Defaults

- `staleTime`: 30 seconds for read-centric data; adjust per domain if needed.
- `refetchOnWindowFocus`: disabled; manual refetch controls will be exposed in
  the UI.
- `retry`: two attempts on the client, none during SSR to avoid blocking. Extend
  with domain-specific logic for policy blocks.

## Mock Bridge Strategy

- Until real APIs are live, query functions can call existing helpers in
  `lib/data-provider`.
- Each query file should export both a direct function (usable by route
  handlers) and a `useQuery` hook.
- When switching to real APIs, keep the mock fallback path behind an environment
  check.

## Offline Roadmap

- Async storage persister package is installed but not yet initialised.
- Background sync and cache persistence will be configured during Phase 7 (PWA &
  Polish).

## TODOs

- [ ] Create `app/providers/QueryProvider.tsx` to wrap the app with
      `QueryClientProvider` + `HydrationBoundary`.
- [ ] Define domain-specific query modules (`lib/queries/vouchers.ts`, etc.).
- [ ] Wire policy engine responses into mutation error handling once APIs exist.
- [ ] Document testing patterns for query-dependent components.

## References

- React Query documentation: https://tanstack.com/query/v5/docs/framework/react
- Next.js App Router data fetching patterns with React Query.
