# wa-webhook

Additive edge function that modularises the WhatsApp webhook and new dine-in flows. Modules:

- `index.ts`: entrypoint (GET verify, POST dispatch)
- `config.ts`: runtime configuration & Supabase client
- `deps.ts`: centralised imports
- `types.ts`: shared type definitions
- `health.ts`: health probe handler
- `wa/`: WhatsApp client helpers and signature verification
- `state/`: chat state & idempotency utilities
- `router/`: message-type routers (media, interactive, location, text)
- `rpc/`: Supabase access helpers (mobility, dine-in, marketplace, etc.)
- `flows/`: message-driven UX blocks
- `exchange/`: Flow Data Channel handlers (Meta WhatsApp Flows)
- `observe/`: logging and diagnostics utilities

This directory now houses both the original vendor upload handler and the v2 conversational flows so nothing is lost while keeping a single deployment target. All new dine-in capabilities and future WA features should live here to honour the repository's additive-only guard.
