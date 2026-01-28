# Database Setup

EasyMo uses Supabase Postgres for primary data.

## Local Supabase

```bash
# Start local Supabase
supabase start

# Apply migrations to local DB
supabase db reset

# Check status
supabase status

# Stop local Supabase
supabase stop
```

## Remote (Linked Project)

```bash
# Link a project
supabase link --project-ref <project-ref>

# Push local migrations to the linked project
supabase db push --linked

# Diff remote vs local
supabase db diff --linked
```

## Schema Checks

```bash
# Verify schema alignment and migration hygiene
pnpm schema:verify
pnpm lint:migrations
```

For migration rules, see docs/development/migrations.md.
