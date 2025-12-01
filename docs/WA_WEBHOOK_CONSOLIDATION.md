# WhatsApp Webhook Services Consolidation

## Overview

This document describes the consolidation of WhatsApp AI agent webhook services into a single unified service (`wa-webhook-unified`).

## Problem Statement

The platform has three overlapping webhook services handling AI agent functionality:

| Service | Purpose | Status |
|---------|---------|--------|
| `wa-webhook-ai-agents` | AI-powered agents (Farmer, Waiter, Insurance, Rides, etc.) | **DEPRECATED** |
| `wa-webhook-marketplace` | Marketplace buy/sell, shops, payments | **DEPRECATED** |
| `wa-webhook-unified` | Consolidated service for all AI agents | **ACTIVE** |

### Issues with Current Architecture

1. **Duplicate Orchestrators**: Two different `UnifiedOrchestrator` implementations
2. **Duplicate Agents**: Same agents implemented in multiple locations
3. **Inconsistent Interfaces**: Different method signatures between services
4. **Maintenance Burden**: Changes needed in multiple places
5. **Code Redundancy**: ~15,000+ lines of duplicate code

## Migration Plan

### Phase 1: Preparation (Complete)
- [x] Add deprecation notices to legacy services
- [x] Add `deprecated` flag to route configuration
- [x] Add `agent.unified_webhook` feature flag
- [x] Update router to support migration routing
- [x] Create consolidation documentation

### Phase 2: Gradual Rollout
1. Enable `FEATURE_AGENT_UNIFIED_WEBHOOK=true` for 1% of traffic (canary)
2. Monitor error rates and response times
3. Gradually increase to 10%, 50%, then 100%
4. Keep legacy services running as fallback

### Phase 3: Cleanup
1. Archive `wa-webhook-ai-agents` directory
2. Archive `wa-webhook-marketplace` directory
3. Update all documentation
4. Remove deprecated service routes

## Feature Flag

The migration is controlled by the `agent.unified_webhook` feature flag:

```bash
# Enable unified webhook routing (default: false)
FEATURE_AGENT_UNIFIED_WEBHOOK=true
```

When enabled, traffic intended for deprecated services is automatically routed to `wa-webhook-unified`.

## Service Mapping

| Legacy Service | Unified Agent | Status |
|----------------|---------------|--------|
| `wa-webhook-ai-agents` → Farmer | `wa-webhook-unified` → FarmerAgent | ✅ Available |
| `wa-webhook-ai-agents` → Waiter | `wa-webhook-unified` → WaiterAgent | ✅ Available |
| `wa-webhook-ai-agents` → Insurance | `wa-webhook-unified` → InsuranceAgent | ✅ Available |
| `wa-webhook-ai-agents` → Rides | `wa-webhook-unified` → RidesAgent | ✅ Available |
| `wa-webhook-ai-agents` → Support | `wa-webhook-unified` → SupportAgent | ✅ Available |
| `wa-webhook-ai-agents` → Sales | `wa-webhook-unified` → SalesAgent | ✅ Available |
| `wa-webhook-ai-agents` → Broker | `wa-webhook-unified` → BusinessBrokerAgent | ✅ Available |
| `wa-webhook-marketplace` → Marketplace | `wa-webhook-unified` → MarketplaceAgent | ✅ Available |

## Architecture Comparison

### Before (Legacy)

```
                    WhatsApp Business API
                            │
                            ▼
                   ┌─────────────────┐
                   │  wa-webhook-core │
                   └────────┬────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
   ┌───────────────┐ ┌─────────────┐ ┌──────────────────┐
   │ wa-webhook-   │ │wa-webhook-  │ │ wa-webhook-      │
   │ ai-agents     │ │unified      │ │ marketplace      │
   │ (DEPRECATED)  │ │ (PRIMARY)   │ │ (DEPRECATED)     │
   └───────────────┘ └─────────────┘ └──────────────────┘
```

### After (Consolidated)

```
                    WhatsApp Business API
                            │
                            ▼
                   ┌─────────────────┐
                   │  wa-webhook-core │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ wa-webhook-     │
                   │ unified         │
                   │                 │
                   │ • All AI Agents │
                   │ • Marketplace   │
                   │ • Handoffs      │
                   └─────────────────┘
```

## Monitoring

### Key Metrics to Watch

```sql
-- Error rate by service
SELECT 
  target_service,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE error IS NOT NULL) as errors,
  ROUND(100.0 * COUNT(*) FILTER (WHERE error IS NOT NULL) / COUNT(*), 2) as error_rate
FROM wa_webhook_routing_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY target_service;

-- Migration traffic distribution
SELECT 
  original_service,
  target_service,
  COUNT(*) as count
FROM wa_webhook_routing_events
WHERE original_service != target_service
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY original_service, target_service;
```

### Alerts to Set Up

1. Error rate > 1% for `wa-webhook-unified`
2. Latency p95 > 3s for `wa-webhook-unified`
3. Circuit breaker opens for `wa-webhook-unified`

## Rollback Procedure

If issues are detected after enabling the unified webhook:

1. Disable the feature flag:
   ```bash
   FEATURE_AGENT_UNIFIED_WEBHOOK=false
   ```

2. Redeploy the wa-webhook-core function:
   ```bash
   supabase functions deploy wa-webhook-core --no-verify-jwt
   ```

3. Traffic will automatically route back to legacy services

## Files Changed

### Deprecation Notices Added

- `supabase/functions/wa-webhook-ai-agents/index.ts`
- `supabase/functions/wa-webhook-marketplace/index.ts`

### Route Configuration Updated

- `supabase/functions/_shared/route-config.ts`
  - Added `deprecated` and `redirectTo` fields
  - Added `wa-webhook-unified` to `ROUTED_SERVICES`
  - Added migration helper functions

### Feature Flags Updated

- `supabase/functions/_shared/feature-flags.ts`
  - Added `agent.unified_webhook` flag

### Router Updated

- `supabase/functions/wa-webhook-core/router.ts`
  - Added migration routing logic
  - Added logging for redirects

## Timeline

| Week | Action | Status |
|------|--------|--------|
| 1 | Add deprecation notices | ✅ Complete |
| 1 | Add feature flag | ✅ Complete |
| 2 | Enable for 1% canary | Pending |
| 2-3 | Increase to 10%, 50% | Pending |
| 3 | Increase to 100% | Pending |
| 4 | Archive legacy services | Pending |

## Related Documentation

- [docs/GROUND_RULES.md](./GROUND_RULES.md) - Development standards
- [wa-webhook-unified/README.md](../supabase/functions/wa-webhook-unified/README.md) - Unified service docs
- [wa-webhook-unified/DEPLOYMENT.md](../supabase/functions/wa-webhook-unified/DEPLOYMENT.md) - Deployment guide

## Contact

For questions about this consolidation, contact the platform team.
