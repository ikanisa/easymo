# EXACT Deletion List - No Vagueness

## ✅ FILES I DELETED (Week 3 - December 3, 2025)

**Exact location:** `/Users/jeanbosco/workspace/easymo/supabase/functions/wa-webhook-ai-agents/ai-agents/`

**Exact action:** Deleted entire `ai-agents/` folder

**15 files deleted:**

1. `supabase/functions/wa-webhook-ai-agents/ai-agents/business_broker_agent.ts`
2. `supabase/functions/wa-webhook-ai-agents/ai-agents/farmer.ts`
3. `supabase/functions/wa-webhook-ai-agents/ai-agents/farmer_agent.ts`
4. `supabase/functions/wa-webhook-ai-agents/ai-agents/farmer_home.ts`
5. `supabase/functions/wa-webhook-ai-agents/ai-agents/general_broker.ts`
6. `supabase/functions/wa-webhook-ai-agents/ai-agents/handlers.ts`
7. `supabase/functions/wa-webhook-ai-agents/ai-agents/index.ts`
8. `supabase/functions/wa-webhook-ai-agents/ai-agents/insurance_agent.ts`
9. `supabase/functions/wa-webhook-ai-agents/ai-agents/integration.ts`
10. `supabase/functions/wa-webhook-ai-agents/ai-agents/jobs_agent.ts`
11. `supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts`
12. `supabase/functions/wa-webhook-ai-agents/ai-agents/real_estate_agent.ts`
13. `supabase/functions/wa-webhook-ai-agents/ai-agents/rides_agent.ts`
14. `supabase/functions/wa-webhook-ai-agents/ai-agents/sales_agent.ts`
15. `supabase/functions/wa-webhook-ai-agents/ai-agents/waiter_agent.ts`

**Backup created at:** `supabase/functions/.archive/ai-agents-old-20251203/`

**Git commit:** cb1eb959 on main branch

---

## 🟡 SUPABASE EDGE FUNCTIONS TO DELETE LATER

**NOT deleted yet - still running in production**

### When to delete: After traffic migration complete + 30 days stable

1. **Function:** `wa-webhook-ai-agents`
   - **Current URL:** `https://[project].supabase.co/functions/v1/wa-webhook-ai-agents`
   - **Delete when:** Week 4 rollout complete + 30 days (earliest: Day 38)
   - **Command:** `supabase functions delete wa-webhook-ai-agents`

2. **Function:** `wa-webhook-jobs`
   - **Current URL:** `https://[project].supabase.co/functions/v1/wa-webhook-jobs`
   - **Delete when:** Week 5 rollout complete + 30 days (earliest: Day 45)
   - **Command:** `supabase functions delete wa-webhook-jobs`

3. **Function:** `wa-webhook-marketplace`
   - **Current URL:** `https://[project].supabase.co/functions/v1/wa-webhook-marketplace`
   - **Delete when:** Week 6 rollout complete + 30 days (earliest: Day 52)
   - **Command:** `supabase functions delete wa-webhook-marketplace`

4. **Function:** `wa-webhook-property`
   - **Current URL:** `https://[project].supabase.co/functions/v1/wa-webhook-property`
   - **Delete when:** Week 6 rollout complete + 30 days (earliest: Day 52)
   - **Command:** `supabase functions delete wa-webhook-property`

---

## 🔴 NEVER DELETE THESE

**DO NOT touch these 3 functions - they are NOT part of consolidation**

1. **Function:** `wa-webhook-mobility`
   - **Action:** KEEP FOREVER (or until separate future project)
   - **Reason:** Critical production service

2. **Function:** `wa-webhook-profile`
   - **Action:** KEEP FOREVER (or until separate future project)
   - **Reason:** Critical production service

3. **Function:** `wa-webhook-insurance`
   - **Action:** KEEP FOREVER (or until separate future project)
   - **Reason:** Critical production service

---

## EXACT NUMBERS

- **Files deleted today:** 15
- **Functions to delete later:** 4
- **Functions to never delete:** 3
- **Total function reduction:** 95 → 75 (after all deletions complete)

