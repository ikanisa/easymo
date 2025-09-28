# Trigger Inventory (Phase 1)

## Summary

- Standard `set_updated_at` triggers on most mutable tables — confirm they all
  call the same function to avoid drift (`trg_*_updated`).
- Basket rate limiting trigger (`fn_assert_basket_create_rate_limit`) remains;
  join rate limiting now inlined inside `basket_join_by_code`
  (`20251010102000`).
- `orders_set_defaults` trigger — needs tests to confirm it applies default
  status/payment state.
- `on_menu_publish_refresh` — check side effects; ensure `menu_items_snapshot`
  is still required.

## Action Items

1. Consolidate `set_updated_at` definition (one canonical version) and reattach
   if duplicates found.
2. Add docs/tests for business triggers (baskets, orders, menus).
3. Validate remaining basket create rate limiter and consider app-layer
   enforcement before Phase 2.
