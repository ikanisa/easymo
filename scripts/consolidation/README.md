# Supabase Functions Consolidation Scripts

## Overview
Automated scripts for Week 4-8 consolidation plan.
See: `/SUPABASE_FUNCTIONS_CONSOLIDATION_PLAN_FINAL.md`

## Execution Order
1. `week4-cleanup.sh` - Delete 22 functions (agents + inactive)
2. `week5-10percent-traffic.sh` - Route 10% traffic to unified
3. `week6-50percent-traffic.sh` - Scale to 50% traffic
4. `week7-100percent-migration.sh` - Full migration
5. `week8-final-deletion.sh` - Delete deprecated webhooks

## Usage
```bash
# Set your Supabase project ref
export SUPABASE_PROJECT_REF="your-project-ref"

# Week 4: Cleanup
./scripts/consolidation/week4-cleanup.sh
supabase db push  # Create routing tables

# Week 5-8: Progressive migration
./scripts/consolidation/week5-10percent-traffic.sh
# Wait 7 days, monitor metrics
./scripts/consolidation/week6-50percent-traffic.sh
# Wait 7 days, monitor metrics
./scripts/consolidation/week7-100percent-migration.sh
# Wait 7 days, verify zero traffic
./scripts/consolidation/week8-final-deletion.sh
```

## Rollback
```sql
-- Emergency rollback (any week)
UPDATE webhook_routing_config 
SET traffic_percentage = 0, enabled = false;
```
