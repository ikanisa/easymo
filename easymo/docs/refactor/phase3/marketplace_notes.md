# Marketplace Domain Notes

## Current State

- Domain entry: `supabase/functions/wa-webhook/domains/marketplace/index.ts`
- Shared RPC wrappers remain in `rpc/marketplace.ts` (system-level; no schema
  move yet).
- Uses shared services: state store, reply helpers, notifications.

## Pending Enhancements

- Extract bar/business presentation helpers into `domains/marketplace/util.ts`
  if reuse emerges.
- Once mobility/wallet move over, consider consolidating domain-specific
  constants (IDS) into `domains/<feature>/ids.ts`.

## Testing Plan

- Add integration coverage to Postman collection
  (`tests/postman/flow-exchange.postman.json` › marketplace) after routing
  stabilises.
- Draft SQL/pgTAP script if domain-specific DB logic grows.
