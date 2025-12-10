-- Re-introduce optional brand_color for SACCO branding in the admin UI
-- This column was previously dropped in cleanup; restore it for branding controls.

alter table if exists public.saccos
  add column if not exists brand_color text;

-- Backfill a safe default brand accent where missing
update public.saccos
   set brand_color = coalesce(brand_color, '#009fdc')
 where brand_color is null;

