-- Capture driver onboarding details (plate + vehicle type) for re-use.

begin;

alter table public.profiles
  add column if not exists vehicle_plate text,
  add column if not exists vehicle_type text;

commit;
