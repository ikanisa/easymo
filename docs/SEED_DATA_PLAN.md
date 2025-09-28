# Seed Data Plan

Run the following in Supabase SQL editor (adjust UUIDs as needed):

```sql
-- Minimal bar + menu seed
insert into bars (id, slug, name, country, city_area, currency, is_active)
values ('11111111-1111-1111-1111-111111111111', 'demo-bar', 'Demo Bar', 'RW', 'Kigali', 'RWF', true)
on conflict (slug) do nothing;

insert into bar_settings (bar_id, allow_direct_customer_chat, service_charge_pct)
values ('11111111-1111-1111-1111-111111111111', true, 10)
on conflict (bar_id) do update set service_charge_pct = excluded.service_charge_pct;

insert into bar_numbers (bar_id, number_e164, role)
values ('11111111-1111-1111-1111-111111111111', '+250788001100', 'manager')
on conflict (bar_id, number_e164) do nothing;

insert into menus (id, bar_id, version, status, source, published_at)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1, 'published', 'manual', now())
on conflict (id) do nothing;

insert into categories (id, bar_id, menu_id, name, sort_order)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Mains', 1)
on conflict (id) do nothing;

insert into items (id, bar_id, menu_id, category_id, name, price_minor, currency)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Grilled Brochette', 5000, 'RWF')
on conflict (id) do nothing;
```

After seeding, run `REFRESH MATERIALIZED VIEW public.menu_items_snapshot;` to sync the snapshot. Use these records for local Flow testing.
