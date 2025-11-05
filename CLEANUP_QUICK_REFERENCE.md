# Repository Cleanup - Quick Reference

## 📋 Cleanup Scripts

Located in: `scripts/cleanup/`

### 1. **analyze-usage.sh** (Run First)
Analyzes package and service usage across the repository.
```bash
./scripts/cleanup/analyze-usage.sh
```
- **Risk:** SAFE (read-only)
- **Duration:** ~1 minute
- **Purpose:** Identify unused packages and services

### 2. **phase1-safe-removals.sh** ✅ RECOMMENDED
Removes confirmed duplicates and experiments.
```bash
./scripts/cleanup/phase1-safe-removals.sh
```
- **Risk:** LOW (all safe removals)
- **Cleanup:** ~5.5MB
- **Items:** Nested duplicate repo, Angular app, build artifacts, example functions
- **Backup:** Auto-created

### 3. **phase2-verified-removals.sh** ⚠️ Verify First
Removes duplicate apps and admin pages.
```bash
./scripts/cleanup/phase2-verified-removals.sh
```
- **Risk:** MEDIUM (requires verification)
- **Cleanup:** ~650KB
- **Items:** apps/admin-pwa, apps/agent-core, src/pages/admin/
- **Requirements:** Team verification before running

### 4. **phase3-voice-removal.sh** 🚨 Critical Decision
Removes ALL voice services (WhatsApp text-only).
```bash
./scripts/cleanup/phase3-voice-removal.sh
```
- **Risk:** HIGH (permanent removal of voice capabilities)
- **Cleanup:** ~11MB
- **Requirements:** Product team approval, WhatsApp-only strategy confirmed
- **Warning:** Cannot be easily undone

---

## 🎯 Recommended Execution Order

### Week 1: Analysis & Safe Cleanup
```bash
# 1. Analyze usage
./scripts/cleanup/analyze-usage.sh > cleanup-analysis.txt

# 2. Review analysis
cat cleanup-analysis.txt

# 3. Run safe removals
./scripts/cleanup/phase1-safe-removals.sh

# 4. Test
pnpm install
pnpm build
pnpm exec vitest run

# 5. Commit
git add -A
git commit -m "chore: remove duplicates and experimental code (Phase 1)"
```

### Week 2: Verification
- Review cleanup-analysis.txt
- Verify with team:
  - Is apps/admin-pwa needed?
  - Is apps/agent-core used?
  - Are src/pages/admin/ fully migrated to admin-app?
  - Is wa-router in active use?
  - Are voice services needed?

### Week 3: Verified Cleanup (If approved)
```bash
# Run Phase 2
./scripts/cleanup/phase2-verified-removals.sh

# Test
pnpm install
pnpm build
pnpm exec vitest run

# Commit
git add -A
git commit -m "chore: remove verified duplicates (Phase 2)"
```

### Week 4: Conditional Cleanup (If WhatsApp-only)
```bash
# ONLY if voice services not needed
./scripts/cleanup/phase3-voice-removal.sh

# Manually update docker-compose-agent-core.yml
# Remove voice-bridge and sip-ingress services

# Test
pnpm install
pnpm build
docker-compose up -d

# Commit
git add -A
git commit -m "chore: remove voice services for WhatsApp-only focus (Phase 3)"
```

---

## 📊 Expected Results

| Phase | Cleanup | Files Removed | Risk |
|-------|---------|---------------|------|
| Phase 1 | ~5.5MB | ~10 directories | LOW |
| Phase 2 | ~650KB | ~5 directories | MEDIUM |
| Phase 3 | ~11MB | ~8 directories | HIGH |
| **TOTAL** | **~17MB** | **~23 directories** | - |

---

## ⚠️ Important Notes

### Before Running Any Script:
1. ✅ Commit or stash all changes
2. ✅ Ensure you're on the correct branch
3. ✅ Have a full repository backup
4. ✅ Read the script output carefully

### After Running Scripts:
1. ✅ Review git status
2. ✅ Run pnpm install
3. ✅ Test build: pnpm build
4. ✅ Run tests: pnpm exec vitest run
5. ✅ Commit if all tests pass

### Restore from Backup:
```bash
# Each script creates timestamped backups
ls -la easymo-cleanup-*.tar.gz

# To restore:
tar -xzf easymo-cleanup-phase1-backup-YYYYMMDD-HHMMSS.tar.gz
```

---

## 🚨 What NOT to Remove

These are PROTECTED and must NEVER be deleted:
- ❌ `/supabase/migrations/` - Database history
- ❌ `/supabase/functions/wa-webhook/` - Core WhatsApp handler
- ❌ `/packages/commons/` - Shared utilities
- ❌ `/packages/db/` - Prisma client
- ❌ `/services/agent-core/` - Core AI service
- ❌ `/admin-app/` - Primary admin UI
- ❌ `/packages/shared/` - TypeScript types

---

## 📞 Need Help?

1. **Question about removal safety?**
   - Run: `./scripts/cleanup/analyze-usage.sh`
   - Review: `REPOSITORY_CLEANUP_REPORT.md`

2. **Script failed?**
   - Check error message
   - Restore from backup
   - Review git status

3. **Unsure about voice services?**
   - Consult product team
   - Keep services if uncertain
   - Voice removal is irreversible

---

## 📚 Related Documents
- **REPOSITORY_CLEANUP_REPORT.md** - Full detailed analysis
- **docs/GROUND_RULES.md** - Development standards
- **ADD_ONLY_RULES.md** - Protected paths

---

**Last Updated:** 2025-11-05  
**Repository:** ikanisa/easymo  
**Status:** Ready for Phase 1 execution
