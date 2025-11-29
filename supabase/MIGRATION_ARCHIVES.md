# Supabase Migration Archives

This document explains the purpose of the migration archive directories in this project.

## Directory Structure

- `migrations/` - **Active migrations** applied to production databases
- `migrations-deleted/` - Migrations removed from the active set (kept for reference)
- `migrations-fixed/` - Corrected versions of problematic migrations
- `migrations__archive/` - Legacy placeholder migrations

## Why Keep Archives?

These archive directories are preserved for:

1. **Audit Trail**: Historical record of database schema changes
2. **Debugging**: Reference when troubleshooting migration issues
3. **Recovery**: Ability to restore accidentally removed migrations
4. **Documentation**: Understanding the evolution of the database schema

## When to Clean Up

Archives can be safely removed when:

- All production databases have been migrated past these versions
- The migrations have been superseded by newer ones
- Team consensus that the historical value is no longer needed

## Migration Hygiene Requirements

Per CI (`scripts/check-migration-hygiene.sh`), all **new** migrations MUST:

1. Be wrapped in `BEGIN;` and `COMMIT;`
2. Follow naming convention: `YYYYMMDDHHMMSS_description.sql`
3. Be idempotent where possible

## Questions?

Contact the database team before modifying or removing archived migrations.
