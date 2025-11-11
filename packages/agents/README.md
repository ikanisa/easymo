# @easymo/agents

OpenAI Agents SDK integration for EasyMO platform.

## Overview

This package provides agent definitions, tools, and orchestration logic for the EasyMO platform using the OpenAI Agents SDK. It enables multi-agent workflows for bar-truck booking, token redemption, savings groups, and more.

## Features

- **Agent Definitions**: Pre-configured agents for different use cases
  - BookingAgent: Handles bar-truck slot bookings
  - TokenRedemptionAgent: Manages token redemptions
  - SavingsGroupAgent: Assists with savings group operations
  - TriageAgent: Routes user requests to appropriate specialized agents

- **Tool Registry**: Reusable tools for common operations
  - WebSearch: Search the web for information
  - MenuLookup: Query available drinks/products
  - BookingCreate: Create new bookings
  - TokenRedeem: Redeem tokens/credits
  - And more...

- **Agent Orchestration**: Hand-off logic between agents
- **Observability**: Built-in structured logging and metrics
- **Security**: Input/output guardrails and validation
- **Feature Flags**: All functionality gated behind feature flags

## Installation

This package is part of the EasyMO monorepo workspace:

```bash
pnpm install
pnpm --filter @easymo/agents build
```

## Usage

### Basic Agent Execution

```typescript
import { BookingAgent } from '@easymo/agents';
import { runAgent } from '@easymo/agents';

// Run agent with user query
const result = await runAgent(BookingAgent, {
  userId: 'user-123',
  query: 'I want to book the bar truck for Friday evening'
});

console.log(result.finalOutput);
```

### With Context and Streaming

```typescript
import { BookingAgent, streamAgent } from '@easymo/agents';

// Stream agent responses
const stream = await streamAgent(BookingAgent, {
  userId: 'user-123',
  query: 'Show me available time slots',
  context: {
    userLocation: 'Kigali',
    preferredDate: '2025-11-01'
  }
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

### Agent Hand-offs

```typescript
import { TriageAgent } from '@easymo/agents';

// Triage agent automatically hands off to specialized agents
const result = await runAgent(TriageAgent, {
  userId: 'user-123',
  query: 'I want to redeem my credits and book a slot'
});

// TriageAgent will detect redemption + booking intent
// and coordinate with TokenRedemptionAgent and BookingAgent
```

## Architecture

### Agent Structure

Each agent follows this pattern:

```typescript
import { Agent, tool } from 'openai';
import { z } from 'zod';

const myTool = tool({
  name: 'ToolName',
  description: 'What this tool does',
  parameters: z.object({
    param1: z.string(),
    param2: z.number()
  }),
  execute: async (params) => {
    // Tool implementation
    return { result: 'data' };
  }
});

export const MyAgent = new Agent({
  name: 'MyAgent',
  instructions: 'You are a helpful assistant for...',
  tools: [myTool],
  model: 'gpt-4o',
  // Add guardrails, hand-offs, etc.
});
```

### Observability

All agents include structured logging:

```typescript
import { logStructuredEvent } from '@easymo/agents/observability';

await logStructuredEvent('AGENT_EXECUTION_START', {
  agentName: 'BookingAgent',
  userId: context.userId,
  query: params.query
});
```

### Feature Flags

All agent functionality is gated:

```typescript
import { isFeatureEnabled } from '@easymo/commons';

if (!isFeatureEnabled('agents.booking')) {
  throw new Error('Booking agent not enabled');
}
```

## Available Agents

### BookingAgent

Handles bar-truck slot bookings and availability queries.

**Tools**:
- `checkAvailability`: Query available time slots
- `createBooking`: Create a new booking
- `cancelBooking`: Cancel existing booking
- `viewBookings`: List user's bookings

**Example**:
```typescript
const result = await runAgent(BookingAgent, {
  userId: 'user-123',
  query: 'Book me a slot for this Friday at 7pm'
});
```

### TokenRedemptionAgent

Manages token and credit redemptions.

**Tools**:
- `checkBalance`: View token/credit balance
- `redeemToken`: Redeem a token/credit
- `viewHistory`: Show redemption history

**Example**:
```typescript
const result = await runAgent(TokenRedemptionAgent, {
  userId: 'user-123',
  query: 'Redeem my 5000 RWF token balance'
});
```

### SavingsGroupAgent

Assists with savings group operations.

**Tools**:
- `createGroup`: Create new savings group
- `joinGroup`: Join existing group
- `makeContribution`: Record contribution
- `viewGroupStatus`: Check group balance and members

**Example**:
```typescript
const result = await runAgent(SavingsGroupAgent, {
  userId: 'user-123',
  query: 'Create a savings group for our office team'
});
```

### TriageAgent

Routes user requests to appropriate specialized agents.

**Capabilities**:
- Intent detection
- Multi-agent coordination
- Context preservation across hand-offs

**Example**:
```typescript
const result = await runAgent(TriageAgent, {
  userId: 'user-123',
  query: 'I want to check my balance and book a slot'
});
// Automatically routes to TokenRedemptionAgent then BookingAgent
```

## Tool Development

### Creating a New Tool

```typescript
import { tool } from 'openai';
import { z } from 'zod';
import { logStructuredEvent } from '@easymo/agents/observability';

export const myNewTool = tool({
  name: 'MyNewTool',
  description: 'Clear description of what this tool does',
  parameters: z.object({
    requiredParam: z.string().describe('Description for LLM'),
    optionalParam: z.number().optional()
  }),
  execute: async (params, context) => {
    // Log tool execution
    await logStructuredEvent('TOOL_EXECUTION', {
      toolName: 'MyNewTool',
      userId: context.userId,
      params
    });

    try {
      // Tool logic here
      const result = await performOperation(params);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      // Log errors
      await logStructuredEvent('TOOL_ERROR', {
        toolName: 'MyNewTool',
        error: error.message,
        params
      });
      
      throw error;
    }
  }
});
```

### Tool Best Practices

1. **Clear Names**: Use descriptive, action-oriented names
2. **Good Descriptions**: Help the LLM understand when to use the tool
3. **Schema Validation**: Use Zod for parameter validation
4. **Error Handling**: Always catch and log errors
5. **Observability**: Log tool executions and outcomes
6. **Guardrails**: Validate inputs and outputs

## Security

### Input Validation

All agent inputs are validated with Zod schemas:

```typescript
import { z } from 'zod';

const AgentRequestSchema = z.object({
  userId: z.string().uuid(),
  query: z.string().min(1).max(1000),
  context: z.record(z.any()).optional()
}).strict();
```

### Output Guardrails

Agent outputs are sanitized to prevent:
- Exposure of sensitive data
- Malicious content
- System information leakage

### Authentication

All agent executions require valid user authentication:

```typescript
// In Edge Functions
const authResponse = requireAdminAuth(req);
if (authResponse) return authResponse;
```

## Testing

### Unit Tests

```bash
# Run all tests
pnpm --filter @easymo/agents test

# Watch mode
pnpm --filter @easymo/agents test:watch
```

### Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { BookingAgent } from '../src/agents/booking';

describe('BookingAgent', () => {
  it('should handle booking requests', async () => {
    const result = await runAgent(BookingAgent, {
      userId: 'test-user',
      query: 'Book a slot for tomorrow'
    });
    
    expect(result.success).toBe(true);
    expect(result.finalOutput).toContain('booking');
  });
});
```

## Integration with EasyMO

### Edge Functions

Agents are exposed via Supabase Edge Functions:

```typescript
// supabase/functions/agent-runner/index.ts
import { BookingAgent } from '@easymo/agents';
import { runAgent } from '@easymo/agents';

Deno.serve(async (req) => {
  const { agentName, userId, query } = await req.json();
  
  const agent = getAgent(agentName);
  const result = await runAgent(agent, { userId, query });
  
  return new Response(JSON.stringify(result));
});
```

### WhatsApp Integration

Agents can be invoked from WhatsApp messages:

```typescript
// In wa-webhook function
const result = await runAgent(TriageAgent, {
  userId: profile.id,
  query: message.text.body,
  context: {
    source: 'whatsapp',
    messageId: message.id
  }
});
```

### Voice Integration

Agents support voice input/output:

```typescript
// In voice-bridge service
const result = await runAgent(BookingAgent, {
  userId: session.userId,
  query: transcribedText,
  context: {
    source: 'voice',
    callId: session.callId
  }
});

// Convert response to speech
await textToSpeech(result.finalOutput);
```

## Configuration

### Environment Variables

```bash
# Feature flags
FEATURE_AGENTS_BOOKING=false
FEATURE_AGENTS_REDEMPTION=false
FEATURE_AGENTS_SAVINGS=false

# OpenAI settings
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=1000

# Agent settings
AGENT_TIMEOUT_MS=30000
AGENT_MAX_ITERATIONS=10
```

### Feature Flag Setup

Add to `packages/commons/src/feature-flags.ts`:

```typescript
export type FeatureFlag =
  | "agents.booking"
  | "agents.redemption"
  | "agents.savings"
  | "agents.triage";
```

## Observability

### Metrics

All agent executions emit metrics:

- `agent.execution.start`: Agent starts processing
- `agent.execution.complete`: Agent completes successfully
- `agent.execution.failed`: Agent encounters error
- `agent.tool.invoked`: Tool is called
- `agent.handoff.triggered`: Agent hands off to another agent

### Logs

Structured logs include:

```json
{
  "event": "AGENT_EXECUTION_COMPLETE",
  "agentName": "BookingAgent",
  "userId": "user-123",
  "duration": 1250,
  "toolsInvoked": ["checkAvailability", "createBooking"],
  "success": true
}
```

### Traces

Agent traces are stored in Supabase:

```sql
CREATE TABLE agent_traces (
  id UUID PRIMARY KEY,
  agent_name TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id),
  query TEXT NOT NULL,
  result JSONB,
  duration_ms INTEGER,
  tools_invoked TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Roadmap

- [ ] Voice input/output integration
- [ ] Multi-modal support (images, documents)
- [ ] Agent memory/context persistence
- [ ] Fine-tuned models for specific tasks
- [ ] Multi-language support
- [ ] Agent analytics dashboard

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Proprietary - EasyMO Platform
