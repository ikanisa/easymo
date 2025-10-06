-- Seed baseline settings for baskets module (idempotent).

insert into public.settings (key, value, updated_at)
values
  ('baskets.quiet_hours', jsonb_build_object('start', '22:00', 'end', '06:00'), now()),
  ('baskets.templates', jsonb_build_object(
      'reminder_due_in_3', 'tmpl_baskets_due_in_3',
      'reminder_due_today', 'tmpl_baskets_due_today',
      'reminder_overdue', 'tmpl_baskets_overdue'
    ), now()),
  ('baskets.feature_flags', jsonb_build_object(
      'module_enabled', false,
      'allocator_enabled', false,
      'loans_enabled', false
    ), now())
on conflict (key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at;

