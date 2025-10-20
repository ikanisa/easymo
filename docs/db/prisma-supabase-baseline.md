# Prisma + Supabase Baseline

When you run:

```bash
DATABASE_URL=postgresql://… pnpm --filter @easymo/db prisma:migrate:deploy
```

against the production Supabase database you will hit:

```
Error: P3005
The database schema is not empty.
```

Supabase already manages the schema through SQL migrations under `supabase/migrations/`, so Prisma refuses to apply its own migrations.

## One-time baseline

To mark the existing Supabase schema as “already migrated” run the helper script once with your Supabase connection string:

```bash
export DATABASE_URL="postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres"
bash scripts/prisma-baseline-supabase.sh
```

This iterates through every directory in `packages/db/prisma/migrations/` and records it as applied in the `_prisma_migrations` table. After the baseline succeeds you can safely run `prisma:migrate:deploy` for future additive changes.

> **Warning:** only run the baseline script if you are sure the Supabase schema already matches the code in this repository. Skip it on fresh databases—`prisma migrate deploy` will create the schema automatically in that case.

## Ongoing workflow

1. Develop and test Prisma-backed features against the local Postgres instance (the docker compose stack exposes Postgres on `localhost:5435`).
2. Keep Supabase changes in `supabase/migrations/` for production.
3. For each release, run `pnpm --filter @easymo/db prisma:migrate:deploy` against the local Postgres (CI already does this). For Supabase, apply the SQL migrations directly—no Prisma deploy needed after the baseline.
