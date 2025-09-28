# WA Webhook Bundle Map (Phase 0)

## Module Inventory
| Module | Files | Representative entrypoints |
|--------|-------|----------------------------|
| `exchange` | 35 | exchange/actions/cust_bar_browser.ts, exchange/actions/cust_bar_menu.ts, exchange/actions/cust_order_tracker.ts |
| `flows` | 29 | flows/admin/actions.ts, flows/admin/auth.ts, flows/admin/commands.ts |
| `utils` | 14 | utils/app_config.ts, utils/confirm.ts, utils/geo.ts |
| `router` | 7 | router/guards.ts, router/interactive_button.ts, router/interactive_list.ts |
| `rpc` | 6 | rpc/baskets.ts, rpc/dinein.ts, rpc/marketplace.ts |
| `notify` | 3 | notify/hooks.ts, notify/sender.test.ts, notify/sender.ts |
| `wa` | 3 | wa/client.ts, wa/ids.ts, wa/verify.ts |
| `observe` | 2 | observe/log.ts, observe/metrics.ts |
| `state` | 2 | state/idempotency.ts, state/store.ts |
| `vouchers` | 2 | vouchers/render.ts, vouchers/service.ts |
| `config` | 1 | config.ts |
| `deps` | 1 | deps.ts |
| `health` | 1 | health.ts |
| `index` | 1 | index.ts |
| `types` | 1 | types.ts |

## High-level Dependency Graph
```mermaid
graph TD
  config --> deps
  exchange --> config
  exchange --> deps
  exchange --> notify
  exchange --> observe
  exchange --> rpc
  exchange --> types
  exchange --> utils
  exchange --> vouchers
  flows --> config
  flows --> deps
  flows --> exchange
  flows --> notify
  flows --> observe
  flows --> rpc
  flows --> state
  flows --> types
  flows --> utils
  flows --> wa
  health --> config
  index --> config
  index --> deps
  index --> observe
  index --> router
  index --> state
  index --> wa
  notify --> config
  notify --> exchange
  notify --> flows
  notify --> utils
  observe --> config
  router --> flows
  router --> observe
  router --> state
  router --> types
  router --> utils
  router --> wa
  rpc --> deps
  state --> config
  types --> deps
  utils --> config
  utils --> deps
  utils --> observe
  utils --> types
  utils --> wa
  vouchers --> config
  vouchers --> deps
  vouchers --> exchange
  vouchers --> notify
  vouchers --> observe
  vouchers --> utils
  wa --> config
  wa --> deps
  wa --> utils
```

> Each node groups files by the first directory segment under `supabase/functions/wa-webhook`. Root-level files are named after their base filename.
