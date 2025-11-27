#!/bin/bash
# Check which migrations have been applied

echo "Recent migrations created (last 20):"
ls -1t supabase/migrations/*.sql 2>/dev/null | head -20 | xargs -n1 basename

echo ""
echo "Migrations to apply:"
echo "- 20251122073000_ai_agent_ecosystem_schema.sql"
echo "- 20251122073100_seed_ai_agents_complete.sql"
echo "- Various apply_intent_* migrations for each agent"

