Deprecated mirror
=================

This directory previously mirrored the canonical Supabase tree under `supabase/`.
It is no longer the source of truth. All edge functions, migrations and seeds
live under `supabase/`.

Do not add new files here. Use the paths under `supabase/` instead:

- Functions: `supabase/functions/*`
- Migrations: `supabase/migrations/*`
- Seeds: `supabase/seed/fixtures/*`

Existing automation (deploy/test scripts) has been updated to reference the
canonical locations.

