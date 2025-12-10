# Database Migrations

## Directory Structure

- **manual/** - Manual SQL scripts (one-time migrations)
- **archive/** - Completed/historical migrations
- **latest_schema.sql** - Current schema snapshot

## Migration Strategy

1. Use Supabase migrations for schema changes
2. Manual scripts for data migrations
3. Always test in development first
4. Create backup before applying
5. Document each migration

## Applying Migrations

### Supabase Migrations
```bash
supabase db push
```

### Manual SQL Scripts
```bash
psql -f migrations/manual/script.sql
```

## Best Practices

1. Migrations should be idempotent
2. Include rollback procedures
3. Test with sample data
4. Document breaking changes
5. Keep migrations small and focused
