# AI Agents WhatsApp Integration Guide

## Overview

AI agents are now integrated into the WhatsApp webhook flows, providing intelligent, OpenAI-powered assistance for various user actions. The integration uses feature flags for gradual rollout and maintains backward compatibility with existing flows.

## Architecture

### Feature Flags

AI agent features are controlled via environment variables (see `supabase/functions/_shared/feature-flags.ts`):

- `FEATURE_AGENT_NEARBY_DRIVERS=true` - Enable AI driver search
- `FEATURE_AGENT_PHARMACY=true` - Enable AI pharmacy search
- `FEATURE_AGENT_PROPERTY_RENTAL=true` - Enable AI property rental assistance
- `FEATURE_AGENT_SCHEDULE_TRIP=true` - Enable AI trip scheduling
- `FEATURE_AGENT_SHOPS=true` - Enable AI shop search
- `FEATURE_AGENT_QUINCAILLERIE=true` - Enable AI hardware store search

### Integration Points

#### 1. Nearby Drivers (`domains/mobility/nearby.ts`)

When user selects "See Drivers" from home menu:
- **AI Enabled**: Calls `handleAINearbyDrivers()` which invokes `agent-negotiation` edge function
- **AI Disabled**: Uses traditional matching system with database queries

#### 2. Schedule Trip (`domains/mobility/schedule.ts`)

When user selects "Schedule Trip":
- **AI Enabled**: Calls `handleAIScheduleTrip("view")` which invokes `agent-schedule-trip` edge function
- **AI Disabled**: Shows traditional role selection (driver/passenger)

#### 3. Location Updates (`router/location.ts`)

Location messages are automatically routed to AI agents when waiting for location input:
- `ai_driver_waiting_locations`
- `ai_pharmacy_waiting_location`
- `ai_quincaillerie_waiting_location`
- `ai_shops_waiting_location`
- `ai_property_waiting_location`

#### 4. Interactive List Selections (`router/interactive_list.ts`)

AI agent option selections (format: `agent_option_{sessionId}_{index}`) are handled via:
```typescript
handleAIAgentOptionSelection(ctx, state, optionId)
```

## AI Agent Modules

### Core Integration (`domains/ai-agents/integration.ts`)

- `routeToAIAgent()` - Routes requests to appropriate AI agent based on type
- `sendAgentOptions()` - Displays AI agent results as WhatsApp interactive lists
- `handleAgentSelection()` - Processes user selection from AI options
- `checkAgentSessionStatus()` - Retrieves session status from database

### Flow Handlers (`domains/ai-agents/handlers.ts`)

Provides high-level handlers for each agent type:
- `handleAINearbyDrivers(ctx, vehicleType, pickup, dropoff)`
- `handleAINearbyPharmacies(ctx, location, medications, prescriptionImage)`
- `handleAINearbyQuincailleries(ctx, location, items, itemImage)`
- `handleAINearbyShops(ctx, location, items, itemImage, shopCategory)`
- `handleAIPropertyRental(ctx, action, rentalType, location, requestData)`
- `handleAIScheduleTrip(ctx, action, requestData)`
- `handleAIAgentOptionSelection(ctx, state, optionId)`
- `handleAIAgentLocationUpdate(ctx, state, location)`

## Edge Function Endpoints

AI agents invoke these Supabase Edge Functions:

| Agent Type | Endpoint | Purpose |
|------------|----------|---------|
| Nearby Drivers | `/functions/v1/agent-negotiation` | Find and negotiate with drivers |
| Pharmacy | `/functions/v1/agent-negotiation` | Find pharmacies with medications |
| Property Rental | `/functions/v1/agent-property-rental` | Search/add rental properties |
| Schedule Trip | `/functions/v1/agent-schedule-trip` | Schedule recurring trips |
| Shops | `/functions/v1/agent-shops` | Find general retail shops |
| Quincaillerie | `/functions/v1/agent-quincaillerie` | Find hardware stores |

## Database Schema

AI agent sessions are tracked in `agent_sessions` table:
- `id` (uuid) - Session identifier
- `user_id` (text) - WhatsApp phone number
- `agent_type` (text) - e.g., "driver", "pharmacy"
- `status` (text) - e.g., "pending", "option_selected"
- `metadata` (jsonb) - Session data including options
- `selected_option` (integer) - Index of selected option
- `created_at`, `updated_at` (timestamp)

## Usage Example

### Enabling AI Driver Search

1. Set environment variable:
```bash
FEATURE_AGENT_NEARBY_DRIVERS=true
```

2. User flow:
   - User: Selects "🚖 See Drivers" from home menu
   - System: Calls `handleSeeDrivers()`
   - Check: Feature flag enabled?
   - If yes: Calls `handleAINearbyDrivers()`
   - System: Asks for pickup/dropoff locations
   - User: Sends location(s)
   - System: Invokes `agent-negotiation` edge function
   - AI Agent: Searches drivers, negotiates prices
   - System: Displays options as interactive list
   - User: Selects preferred driver
   - System: Records selection, sends confirmation

### Rollout Strategy

**Phase 1**: Internal Testing (Current)
- All flags OFF by default
- Enable per-feature via environment variables
- Test with internal team phones

**Phase 2**: Beta Testing
- Enable for specific user segments
- Monitor logs via `logAgentEvent()`
- Gather feedback

**Phase 3**: Gradual Rollout
- Enable flags in production
- Monitor error rates and response times
- Fall back to traditional flows on errors

## Observability

All AI agent events are logged via `logAgentEvent()` from `_shared/agent-observability.ts`:

```typescript
logAgentEvent("AGENT_REQUEST_ROUTED", {
  userId, agentType, flowType
});

logAgentEvent("AGENT_OPTION_SELECTED", {
  sessionId, optionIndex, userId
});

logAgentEvent("AGENT_ERROR", {
  userId, agentType, error: error.message
});
```

## Troubleshooting

### AI agent not being called

1. Check feature flag: `isFeatureEnabled("agent.nearby_drivers")`
2. Verify environment variable: `FEATURE_AGENT_NEARBY_DRIVERS=true`
3. Check function deployment: `supabase functions list`

### Edge function errors

1. Check logs: Supabase Dashboard → Edge Functions → Logs
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
3. Ensure edge function is deployed: `supabase functions deploy agent-negotiation`

### Location not being captured

1. Verify state key matches AI agent states (see `router/location.ts`)
2. Check `handleAIAgentLocationUpdate()` is called
3. Ensure location permissions granted on WhatsApp

## Testing

To test AI agent integration locally:

```bash
# Enable feature flag
export FEATURE_AGENT_NEARBY_DRIVERS=true

# Start local Supabase
supabase start

# Deploy edge functions
supabase functions deploy agent-negotiation
supabase functions deploy wa-webhook

# Send test webhook
curl -X POST http://localhost:54321/functions/v1/wa-webhook \
  -H "Content-Type: application/json" \
  -d '{"entry": [{"changes": [{"value": {"messages": [...]}}]}]}'
```

## Next Steps

1. Deploy remaining agent edge functions (pharmacy, property, etc.)
2. Add comprehensive error handling and retries
3. Implement agent session timeout cleanup
4. Add analytics dashboard for agent performance
5. Create user feedback collection mechanism

## References

- Feature Flags: `supabase/functions/_shared/feature-flags.ts`
- AI Handlers: `supabase/functions/wa-webhook/domains/ai-agents/`
- Agent Edge Functions: `supabase/functions/agent-*/`
- Ground Rules: `docs/GROUND_RULES.md`
