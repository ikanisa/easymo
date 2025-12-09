# 🚨 CRITICAL GUARDRAILS (MANDATORY)

**These rules are NON-NEGOTIABLE. Any work that violates these guardrails will be REJECTED.**

---

## Purpose

Prevent:
- Schema drift
- Duplicate tables/functions/services
- Fragmented features
- Parallel systems doing the same job
- Uncommitted/conflicting migration state

**Priority: Correctness and coherence > Speed**

---

## Absolute Rules

### 1. NO Implementation Until Discovery Complete

**NEVER** create new tables, functions, services, or UI flows until you:

✅ **PROVE** a similar object does not already exist, OR  
✅ **PROVE** the existing one cannot be extended safely

**Required Output:** Fullstack discovery report (see Phase 1 below)

### 2. Every Change Must Connect the Full Stack

All changes must span:

```
UI/UX → API/Edge Functions → Database → RLS/Permissions → Observability/Logs
```

**Partial implementations are REJECTED.** If you touch one layer, verify all layers.

### 3. Prefer Update/Consolidate Over Create

Before creating anything new, you MUST:

1. Search for existing similar entities
2. Document why existing ones cannot be extended
3. Justify duplication in a "Why Not Extend Existing?" section

### 4. Avoid Parallel Systems

If you find two systems doing the same job → **Propose consolidation, not a third option.**

### 5. Repository Cleanliness Required

Before ANY work, verify:

- ✅ No uncommitted changes
- ✅ No unresolved conflicts
- ✅ No duplicate/archived migrations in active paths
- ✅ Schema aligned between local and remote
- ✅ Working on correct branch

**If ANY risk detected → STOP and fix first**

---

## Mandatory Workflow for EVERY Task

### Phase 0 – Preflight Sanity (Report Only)

Provide a short report:

- [ ] Current branch confirmed (new task branch if needed)
- [ ] Git working tree clean
- [ ] No large untracked folders that confuse scanning
- [ ] Migration archives identified (won't mix into active work)
- [ ] Local DB schema aligned with remote

**Output:** Preflight status report  
**Action:** If ANY risk → STOP, recommend cleanup path

### Phase 1 – Fullstack Discovery (Report Only)

Inventory relevant parts of:

- Frontend/PWA(s) and shared UI components
- Backend/services
- Supabase Edge Functions
- Database schemas and migrations
- RLS policies and triggers
- Logs/telemetry patterns

Use repo-wide search to locate:

- Existing tables/entities for this feature
- Existing APIs or functions
- Existing UI screens/flows
- Existing domain naming conventions

**Required Output:**

1. "What already exists"
2. "Where duplication risk is highest"
3. "What should be edited rather than recreated"

### Phase 2 – Domain Model & Single Source of Truth

Define canonical entities:

- **One primary table** (or module) for core record of truth
- Clear naming conventions consistent with existing patterns
- Strict rule for where state lives vs. derived views

**If multiple tables track same concept:**

- Identify the canonical one
- List what to deprecate
- Provide migration strategy for consolidation

**Required Output:** Domain model with canonical designations

### Phase 3 – Change Plan (With Impact Map)

Provide a plan with:

- UI changes
- API/Function changes
- DB changes (migrations)
- RLS changes
- Backfill/migration steps if needed
- Test/verification steps

**Include "Avoided Duplication" section:**

- Candidates found
- The one you will reuse/extend
- The ones you will NOT create

**Required Output:** Full change plan + impact map

### Phase 4 – Minimal Implementation

**ONLY after Phase 3 is completed:**

- Implement smallest coherent set of changes
- Do NOT introduce new layers or parallel abstractions
- Reuse existing utilities and patterns

**Required Output:** Working code + migration files

### Phase 5 – Verification

Show:

- [ ] Feature works end-to-end
- [ ] No redundant files/tables created
- [ ] Migration order consistent
- [ ] RLS still correct (not loosened unintentionally)
- [ ] No orphaned/unused functions

**Required Output:** Verification checklist completed

### Phase 6 – Cleanup

- Remove dead code from consolidation
- Add comments/docs for new canonical path
- Update references to deprecated names

**Required Output:** Cleanup summary

---

## Database & Migration Safety Rules

### Before Adding a Migration:

1. List all local migrations in order
2. List all remote applied migrations
3. Detect drift
4. Confirm you're not duplicating a previous change

### Migration Best Practices:

- **Prefer ONE clear migration** over many micro-migrations for same feature
- For cleanup/consolidation tasks:
  - Stepwise plan preserving data
  - Include backfill SQL
  - Include rollback strategy

---

## Required Output Format

**Your response MUST follow this structure:**

```
A) Preflight Status
B) Fullstack Discovery Summary
C) Existing Assets to Reuse (with paths)
D) Duplication Risks Found
E) Proposed Canonical Design
F) Change Plan (UI → API → DB → RLS → Tests)
G) Implementation (only if A–F completed)
H) Verification Checklist
I) Cleanup/Consolidation Notes
```

---

## Stop Conditions (HALT Here)

**You MUST STOP and ask for human review if:**

- ❌ Competing tables tracking same core entity found
- ❌ Migrations appear out-of-order or conflicting
- ❌ Archived migrations overlap active ones
- ❌ Feature already implemented but partially broken
- ❌ RLS changes could widen access without clear intent
- ❌ Uncommitted changes or schema drift detected

**DO NOT PROCEED. Report the issue and wait for approval.**

---

## Success Definition

A successful task:

- ✅ Adds ZERO unnecessary tables
- ✅ Adds ZERO duplicate functions
- ✅ Preserves single source of truth
- ✅ Improves clarity, removes ambiguity
- ✅ Leaves repo more coherent than before

---

## Enforcement

These guardrails are enforced via:

1. **Code review** - PRs without discovery reports are rejected
2. **CI checks** - Additive guard workflow blocks migration overwrites
3. **Manual audit** - Platform architects review all schema changes

**Violations = REJECTED PRs**

---

## Related Documentation

- [Ground Rules](docs/GROUND_RULES.md) - Observability, security, feature flags
- [Repository Custom Instructions](.github/COPILOT_INSTRUCTIONS.md) - Build, test, lint
- [Migration Hygiene](scripts/check-migration-hygiene.sh) - SQL standards

---

**Last Updated:** 2025-12-09  
**Maintained By:** Platform Architecture Team
