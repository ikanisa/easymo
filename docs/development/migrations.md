# Migrations

Migrations live in `supabase/migrations` and are append-only.

## Rules
- Never edit or reorder existing migrations.
- Create a new migration for each schema change.
- Keep migrations sequential and deterministic.
- Legacy exceptions are listed in `supabase/migrations/.audit_allowlist` (do not add new entries).

## Local Workflow

```bash
# Create a new migration
supabase migration new <name>

# Apply locally
supabase db reset

# Validate migration hygiene (timestamps, duplicates, prohibited strings)
pnpm migration:validate

# Verify schema alignment
pnpm schema:verify

# Lint for RLS and migration rules
pnpm lint:migrations
```

## Remote Workflow

```bash
# Link a project
supabase link --project-ref <project-ref>

# Push to linked project
supabase db push --linked
```
