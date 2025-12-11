# Insurance Consolidation - Deployment Checklist

## ✅ Phase 1: Code Consolidation (COMPLETE)

- [x] Delete redundant functions
  - [x] insurance-admin-health/
  - [x] send-insurance-admin-notifications/
- [x] Move insurance handlers from mobility → insurance
  - [x] insurance_admin.ts
  - [x] insurance_notifications.ts
  - [x] driver_insurance.ts
- [x] Move OCR processing
  - [x] driver_insurance_ocr.ts
- [x] Remove stub directories
  - [x] wa-webhook/domains/insurance/
  - [x] wa-webhook-mobility/domains/insurance/
- [x] Create documentation
- [x] Create database migration script
- [x] Run lint check (PASSED)

**Result**: 2,272 lines deleted, 4 files moved, 6+ locations → 2

---

## ⏳ Phase 2: Testing (TODO)

- [ ] Run unit tests
  ```bash
  pnpm exec vitest run
  ```
  **Expected**: All existing tests pass (84 tests)

- [ ] Test insurance webhook locally
  ```bash
  supabase functions serve wa-webhook-insurance
  # Test webhook with sample payload
  ```

- [ ] Verify no broken imports
  ```bash
  pnpm typecheck
  ```

---

## ⏳ Phase 3: Database Migration (TODO - Staging First)

- [ ] Backup staging database
  ```bash
  pg_dump $STAGING_DATABASE_URL > insurance_migration_backup_$(date +%Y%m%d).sql
  ```

- [ ] Run migration on staging
  ```bash
  psql $STAGING_DATABASE_URL \
    -f supabase/migrations/INSURANCE_CONSOLIDATION_MIGRATION.sql
  ```

- [ ] Verify staging migration
  ```bash
  # Check table count
  psql $STAGING_DATABASE_URL -c "\dt insurance*" | wc -l
  # Should be ~8-10 tables
  
  # Check data integrity
  psql $STAGING_DATABASE_URL -c "
    SELECT COUNT(*) FROM insurance_certificates;
    SELECT COUNT(*) FROM insurance_policies;
  "
  ```

- [ ] Test staging application
  - [ ] Insurance webhook responds
  - [ ] OCR processing works
  - [ ] Admin functions operational
  - [ ] No data loss detected

---

## ⏳ Phase 4: Function Deployment (TODO)

- [ ] Deploy wa-webhook-insurance
  ```bash
  supabase functions deploy wa-webhook-insurance \
    --project-ref $SUPABASE_PROJECT_REF
  ```

- [ ] Deploy wa-webhook-mobility (insurance removed)
  ```bash
  supabase functions deploy wa-webhook-mobility \
    --project-ref $SUPABASE_PROJECT_REF
  ```

- [ ] Verify deployments
  ```bash
  # Test insurance webhook
  curl https://[project].supabase.co/functions/v1/wa-webhook-insurance/health
  
  # Test mobility webhook
  curl https://[project].supabase.co/functions/v1/wa-webhook-mobility/health
  ```

- [ ] Monitor logs for errors
  ```bash
  supabase functions logs wa-webhook-insurance --tail
  ```

---

## ⏳ Phase 5: Production Migration (TODO - After Staging Validated)

- [ ] Schedule maintenance window (low-traffic period)

- [ ] Backup production database
  ```bash
  pg_dump $DATABASE_URL > insurance_migration_backup_prod_$(date +%Y%m%d).sql
  ```

- [ ] Run production migration
  ```bash
  psql $DATABASE_URL \
    -f supabase/migrations/INSURANCE_CONSOLIDATION_MIGRATION.sql
  ```

- [ ] Verify production migration
  ```bash
  # Table count check
  psql $DATABASE_URL -c "\dt insurance*" | wc -l
  
  # Data integrity check
  psql $DATABASE_URL -c "
    SELECT 
      (SELECT COUNT(*) FROM insurance_certificates) as certificates,
      (SELECT COUNT(*) FROM insurance_policies) as policies,
      (SELECT COUNT(*) FROM insurance_media_queue) as media;
  "
  ```

- [ ] Monitor production logs
  ```bash
  supabase functions logs wa-webhook-insurance --tail --project-ref $SUPABASE_PROJECT_REF
  ```

---

## ⏳ Phase 6: Post-Migration Cleanup (TODO)

- [ ] Update RLS policies for new schema
  ```sql
  -- Review and update policies on:
  -- insurance_certificates (was driver_insurance_certificates)
  ```

- [ ] Add indexes if needed
  ```sql
  CREATE INDEX IF NOT EXISTS idx_insurance_certificates_type 
    ON insurance_certificates(certificate_type);
  
  CREATE INDEX IF NOT EXISTS idx_insurance_certificates_expiry 
    ON insurance_certificates(policy_expiry);
  ```

- [ ] Run database maintenance
  ```bash
  psql $DATABASE_URL -c "VACUUM ANALYZE insurance_certificates;"
  psql $DATABASE_URL -c "VACUUM ANALYZE insurance_media_queue;"
  psql $DATABASE_URL -c "VACUUM ANALYZE insurance_admins;"
  ```

- [ ] Update monitoring dashboards
  - [ ] Update table names in queries
  - [ ] Update alert thresholds

- [ ] Update backup configs
  - [ ] Remove deleted tables from backup scripts
  - [ ] Add new tables to backup lists

---

## ⏳ Phase 7: Verification & Documentation (TODO)

- [ ] Verify insurance workflows
  - [ ] Quote request flow
  - [ ] Certificate upload flow
  - [ ] Claims submission
  - [ ] Admin review process

- [ ] Update team documentation
  - [ ] Update architecture diagrams
  - [ ] Update API documentation
  - [ ] Update onboarding docs

- [ ] Notify team
  - [ ] Share consolidation summary
  - [ ] Highlight breaking changes
  - [ ] Provide migration timeline

- [ ] Clean up temporary files
  ```bash
  rm INSURANCE_CONSOLIDATION_COMMIT_MSG.txt
  rm INSURANCE_CONSOLIDATION_SUMMARY.txt
  # Keep .md files for reference
  ```

---

## Rollback Plan (If Needed)

### Code Rollback
```bash
# Revert git changes
git revert <commit-hash>

# Redeploy previous versions
supabase functions deploy wa-webhook-insurance --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy wa-webhook-mobility --project-ref $SUPABASE_PROJECT_REF
```

### Database Rollback
```bash
# Restore from backup
psql $DATABASE_URL < insurance_migration_backup_YYYYMMDD.sql

# Or reverse migration (create reverse_migration.sql)
```

---

## Success Criteria

- [x] Code consolidated (6+ locations → 2)
- [x] Redundant code deleted (2,272 lines)
- [x] Lint check passed
- [ ] All tests passing
- [ ] Staging migration successful
- [ ] Production migration successful
- [ ] No data loss
- [ ] All insurance workflows functional
- [ ] No increase in error rates
- [ ] Team notified and documentation updated

---

## Key Contacts

**Technical Lead**: [Name]  
**Database Admin**: [Name]  
**DevOps**: [Name]

## Important Links

- Full Documentation: `INSURANCE_CONSOLIDATION_COMPLETE.md`
- Quick Reference: `INSURANCE_CONSOLIDATION_QUICK_REF.md`
- Migration Script: `supabase/migrations/INSURANCE_CONSOLIDATION_MIGRATION.sql`
- Automation Script: `scripts/consolidate-insurance-domain.sh`

---

**Last Updated**: 2025-12-11  
**Status**: Phase 1 Complete, Ready for Phase 2 (Testing)
