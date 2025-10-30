# OpenAI Agents SDK Integration

## Overview

This document describes the integration of the OpenAI Agents SDK into the EasyMO platform, providing intelligent agent-based assistance for bar-truck bookings, token redemption, and general platform queries.

## Architecture

### Components

1. **@easymo/agents Package** (`packages/agents/`)
   - Agent definitions (BookingAgent, TokenRedemptionAgent, TriageAgent)
   - Tool implementations (WebSearch, MenuLookup, CheckAvailability, etc.)
   - Agent orchestration and execution logic
   - Observability and feature flag integration

2. **Edge Functions** (`supabase/functions/agent-runner/`)
   - RESTful API endpoint for agent execution
   - Authentication and authorization
   - Request validation and error handling
   - Integration with Supabase for trace storage

3. **Database** (`supabase/migrations/20260130120500_openai_agents_integration.sql`)
   - `agent_traces` table for execution logs
   - `agent_tools` table for tool registry
   - RLS policies for security
   - Indexes for performance

### Flow Diagram

```
User Query → Edge Function → Agent Runner → OpenAI API
                ↓                ↓              ↓
           Auth Check      Tool Execution   Function Calling
                ↓                ↓              ↓
           Validation      Supabase Query   Response Generation
                ↓                ↓              ↓
           Feature Flag    Observability    Store Trace → Response
```

## Implementation Details

### Package: @easymo/agents

Located in `packages/agents/`, this package provides:

#### Agents

1. **BookingAgent**
   - Handles bar-truck reservations
   - Tools: CheckAvailability, CreateBooking, MenuLookup
   - Feature flag: `agents.booking`

2. **TokenRedemptionAgent**
   - Manages tokens and vouchers
   - Tools: CheckBalance
   - Feature flag: `agents.redemption`

3. **TriageAgent**
   - Routes user requests to specialized agents
   - Tools: MenuLookup, WebSearch
   - Feature flag: `agents.triage`

#### Tools

Each tool follows this pattern:

```typescript
import { z } from 'zod';
import type { AgentContext } from '../types';

export const myToolSchema = z.object({
  param: z.string().describe('Parameter description'),
});

export async function executeMyTool(
  params: z.infer<typeof myToolSchema>,
  context: AgentContext
): Promise<Result> {
  // Tool implementation
}

export const myTool = {
  name: 'MyTool',
  description: 'Tool description for LLM',
  parameters: myToolSchema,
  execute: executeMyTool,
};
```

#### Agent Execution

```typescript
import { runAgent, BookingAgent } from '@easymo/agents';

const result = await runAgent(BookingAgent, {
  userId: 'user-123',
  query: 'I want to book a slot for Friday',
  context: {
    userId: 'user-123',
    source: 'whatsapp',
  },
});

console.log(result.finalOutput);
```

### Edge Function: agent-runner

Located in `supabase/functions/agent-runner/`, this function:

1. **Authentication**: Requires admin token via `requireAdmin(req)`
2. **Validation**: Validates request using Zod schema
3. **Feature Flag**: Checks `ENABLE_AGENTS` environment variable
4. **Execution**: Runs the requested agent
5. **Observability**: Logs structured events
6. **Storage**: Stores execution trace in `agent_traces` table

#### API Endpoint

**POST** `/functions/v1/agent-runner`

**Headers:**
```
Content-Type: application/json
x-api-key: YOUR_ADMIN_TOKEN
```

**Request Body:**
```json
{
  "agentName": "booking",
  "userId": "uuid",
  "query": "I want to book the bar truck for Friday evening",
  "sessionId": "uuid",
  "context": {
    "source": "whatsapp"
  }
}
```

**Response:**
```json
{
  "success": true,
  "finalOutput": "Agent response text...",
  "agentName": "booking",
  "toolsInvoked": ["CheckAvailability"],
  "duration": 1250
}
```

### Database Schema

#### agent_traces Table

Stores execution logs for observability and analytics.

```sql
CREATE TABLE agent_traces (
  id UUID PRIMARY KEY,
  agent_name TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id),
  session_id UUID,
  query TEXT NOT NULL,
  result JSONB NOT NULL,
  duration_ms INTEGER NOT NULL,
  tools_invoked TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policies:**
- Users can view their own traces
- Service role can view/insert all traces

#### agent_tools Table

Registry of available tools.

```sql
CREATE TABLE agent_tools (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  parameters JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Security

### Authentication

- All agent execution requires admin authentication
- Edge Functions verify `x-api-key` header
- User ID must be valid UUID

### Authorization

- RLS policies restrict trace access to owners
- Service role bypasses RLS for admin operations
- Tools validate user permissions

### Input Validation

- All inputs validated with Zod schemas
- Query length limited to 2000 characters
- Parameter types strictly enforced

### PII Protection

- Queries truncated in logs (first 500 chars)
- Sensitive parameters masked
- Stack traces excluded from production logs

### Secrets Management

- OpenAI API key stored in environment (server-side only)
- No secrets exposed client-side
- Verified by prebuild security checks

## Observability

### Structured Logging

All agent executions emit structured JSON logs:

```json
{
  "event": "AGENT_EXECUTION_COMPLETE",
  "timestamp": "2025-10-30T12:00:00Z",
  "agentName": "booking",
  "userId": "uuid",
  "sessionId": "uuid",
  "success": true,
  "durationMs": 1250,
  "toolsInvoked": ["CheckAvailability"]
}
```

### Metrics

Key metrics tracked:
- `AGENT_EXECUTION_REQUEST`: Agent invocation
- `AGENT_EXECUTION_COMPLETE`: Successful completion
- `AGENT_EXECUTION_FAILED`: Execution failure
- `TOOL_INVOKED`: Tool usage

### Traces

Execution traces stored in `agent_traces` table:
- Full query and response
- Tools invoked
- Duration
- Timestamp

## Feature Flags

All agent functionality is gated behind feature flags that default to OFF.

### Environment Variables

```bash
# Enable/disable entire agent system
ENABLE_AGENTS=false

# Individual agent flags
FEATURE_AGENTS_BOOKING=false
FEATURE_AGENTS_REDEMPTION=false
FEATURE_AGENTS_TRIAGE=false
FEATURE_AGENTS_WEBSEARCH=false
```

### Usage in Code

```typescript
import { requireAgentFeature } from '@easymo/agents';

// Throws error if feature not enabled
requireAgentFeature('agents.booking');

// Or check manually
if (isAgentFeatureEnabled('agents.websearch')) {
  // Use web search
}
```

## Integration Points

### WhatsApp

Integrate agents with WhatsApp webhook:

```typescript
// In wa-webhook function
import { runAgent, TriageAgent } from '@easymo/agents';

const result = await runAgent(TriageAgent, {
  userId: profile.id,
  query: message.text.body,
  context: {
    source: 'whatsapp',
    messageId: message.id,
  },
});

// Send response back to WhatsApp
await sendWhatsAppMessage(from, result.finalOutput);
```

### Voice

Integrate with voice bridge:

```typescript
// In voice-bridge service
const result = await runAgent(BookingAgent, {
  userId: session.userId,
  query: transcribedText,
  context: {
    source: 'voice',
    callId: session.callId,
  },
});

// Convert to speech
await textToSpeech(result.finalOutput);
```

### Web/Mobile

Call Edge Function from frontend:

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/agent-runner`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': adminToken,
    },
    body: JSON.stringify({
      agentName: 'booking',
      userId: user.id,
      query: userInput,
    }),
  }
);

const result = await response.json();
console.log(result.finalOutput);
```

## Development

### Local Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build shared packages:**
   ```bash
   pnpm --filter @va/shared build
   pnpm --filter @easymo/commons build
   pnpm --filter @easymo/agents build
   ```

3. **Set environment variables:**
   ```bash
   # In .env or .env.local
   OPENAI_API_KEY=sk-...
   ENABLE_AGENTS=true
   FEATURE_AGENTS_BOOKING=true
   FEATURE_AGENTS_REDEMPTION=true
   FEATURE_AGENTS_TRIAGE=true
   ```

4. **Run migrations:**
   ```bash
   supabase db push
   ```

5. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy agent-runner
   ```

### Testing

#### Unit Tests

```bash
# Test agents package
pnpm --filter @easymo/agents test

# Test with watch mode
pnpm --filter @easymo/agents test:watch
```

#### Integration Tests

```bash
# Test Edge Function
deno test --allow-env --allow-net supabase/functions/tests/agent-runner.test.ts
```

#### Manual Testing

```bash
# Test agent execution
curl -X POST http://localhost:54321/functions/v1/agent-runner \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: test-token' \
  -d '{
    "agentName": "booking",
    "userId": "test-user-id",
    "query": "Show me available time slots"
  }'
```

## Deployment

### Prerequisites

- OpenAI API key with GPT-4 access
- Supabase project configured
- Admin authentication set up

### Steps

1. **Build package:**
   ```bash
   pnpm --filter @easymo/agents build
   ```

2. **Run migrations:**
   ```bash
   supabase db push --project-ref YOUR_PROJECT_REF
   ```

3. **Set secrets:**
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase secrets set ENABLE_AGENTS=true
   ```

4. **Deploy functions:**
   ```bash
   supabase functions deploy agent-runner --project-ref YOUR_PROJECT_REF
   ```

5. **Verify deployment:**
   ```bash
   curl https://YOUR_PROJECT.supabase.co/functions/v1/agent-runner \
     -X POST \
     -H 'x-api-key: YOUR_ADMIN_TOKEN' \
     -d '{"agentName":"triage","userId":"test","query":"hello"}'
   ```

## Monitoring

### Logs

View agent execution logs:

```bash
# Supabase logs
supabase functions logs agent-runner

# Query traces
SELECT 
  agent_name,
  COUNT(*) as executions,
  AVG(duration_ms) as avg_duration,
  ARRAY_AGG(DISTINCT tools_invoked) as tools_used
FROM agent_traces
WHERE created_at > now() - interval '24 hours'
GROUP BY agent_name;
```

### Metrics

Monitor key metrics:
- Request rate
- Success rate
- Average duration
- Tool usage frequency
- Error rate by agent

### Alerts

Set up alerts for:
- High error rate (>5%)
- Slow responses (>5s)
- Feature flag changes
- Quota limits approaching

## Troubleshooting

### Agent Not Responding

1. Check feature flag: `ENABLE_AGENTS=true`
2. Verify OpenAI API key is set
3. Check agent-specific feature flags
4. Review logs for errors

### Authentication Failures

1. Verify admin token in `x-api-key` header
2. Check `EASYMO_ADMIN_TOKEN` environment variable
3. Ensure token matches between client and server

### Tool Execution Errors

1. Verify tool parameters match schema
2. Check Supabase connection
3. Review tool implementation logs
4. Validate data exists in database

### Performance Issues

1. Check OpenAI API response times
2. Review database query performance
3. Analyze tool execution duration
4. Consider caching frequently used data

## Future Enhancements

- [ ] Voice input/output integration
- [ ] Multi-modal support (images, documents)
- [ ] Agent memory and context persistence
- [ ] Fine-tuned models for specific tasks
- [ ] Multi-language support
- [ ] Streaming responses
- [ ] Agent analytics dashboard
- [ ] A/B testing framework
- [ ] Custom agent creation UI

## References

- [OpenAI Agents SDK Documentation](https://github.com/openai/agents)
- [EasyMO Ground Rules](../GROUND_RULES.md)
- [@easymo/agents Package README](../../packages/agents/README.md)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)

## Support

For questions or issues:
1. Check this documentation
2. Review [GROUND_RULES.md](../GROUND_RULES.md)
3. Check agent traces in database
4. Review Edge Function logs
5. Contact EasyMO platform team
