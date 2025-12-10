# Deleting Insurance & Rides AI Agents - IN PROGRESS

**Started:** December 10, 2025, 9:46 PM  
**Directive:** DELETE AI agents, keep WhatsApp workflows  
**Method:** Systematic deletion with migrations

---

## Execution Plan

### Phase 1: Database Cleanup (30 min)
1. Create migration to delete insurance agent
2. Create migration to delete rides agent
3. Remove from ai_agents table

### Phase 2: Code Deletion (45 min)
1. Delete insurance_agent.ts
2. Delete mobility-agent.base.ts
3. Remove sections from agent_configs.ts
4. Remove sections from agent_orchestrator.ts
5. Clean up rides-insurance-logic.ts

### Phase 3: Documentation Update (30 min)
1. Update agent count (9→7)
2. Remove deleted sections
3. Update README files

---

Starting Phase 1: Database Cleanup...
