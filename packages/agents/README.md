# @easymo/agents

AI Agent implementations for EasyMO WhatsApp-first platform.

## Overview

This package provides AI agent definitions, tools, and orchestration logic for the EasyMO platform. It enables multi-agent workflows for commerce, jobs, real estate, restaurants, and more.

## Official Agents

| Agent | Export | Description |
|-------|--------|-------------|
| Farmer | `FarmerAgent` | Agricultural marketplace |
| Jobs | `JobsAgent` | Job board |
| Real Estate | `RealEstateAgent` | Property rentals/sales |
| Sales | `SalesAgent` | Marketing campaigns |
| Waiter | `WaiterAgent` | Restaurant ordering |
| Buy & Sell | `BuyAndSellAgent` | Commerce + business discovery |

## Features

- **Agent Definitions**: Pre-configured agents for different use cases
- **Tool Registry**: Reusable tools for common operations
  - WebSearch: Search the web for information
  - MenuLookup: Query available drinks/products
  - VectorSearch: Semantic search
  - CheckAvailability: Check availability
  - CreateBooking: Create new bookings
  - ScriptPlanner: Plan scripts

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
import { WaiterAgent, runAgent } from '@easymo/agents';

// Run agent with user query
const agent = new WaiterAgent();
const result = await agent.execute({
  userId: 'user-123',
  query: 'Show me the menu'
});

console.log(result.finalOutput);
```

### Using the Buy & Sell Agent

```typescript
import { BuyAndSellAgent } from '@easymo/agents';

const agent = new BuyAndSellAgent();
const result = await agent.execute({
  userId: 'user-123',
  query: 'Find a pharmacy near Kigali',
});
```

### Using Domain Agents

```typescript
import { FarmerAgent, JobsAgent, RealEstateAgent, SalesAgent } from '@easymo/agents';

// Farmer agent for agricultural marketplace
const farmer = new FarmerAgent();
await farmer.execute({ userId: 'user-123', query: 'List my corn harvest' });

// Jobs agent for job board
const jobs = new JobsAgent();
await jobs.execute({ userId: 'user-123', query: 'Find developer jobs' });

// Real estate agent for property listings
const realEstate = new RealEstateAgent();
await realEstate.execute({ userId: 'user-123', query: 'Find apartments in Kigali' });

// Sales agent for marketing
const sales = new SalesAgent();
await sales.execute({ userId: 'user-123', query: 'Create a campaign for my product' });
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

### WaiterAgent

Handles restaurant ordering and menu queries.

**Capabilities**:
- Menu lookup and recommendations
- Order placement
- Availability checking

**Example**:
```typescript
const agent = new WaiterAgent();
const result = await agent.execute({
  userId: 'user-123',
  query: 'Show me the menu'
});
```

### BuyAndSellAgent

Unified commerce and business discovery agent.

**Capabilities**:
- Product commerce across all retail categories
- Business discovery with location-based search
- Order management

**Example**:
```typescript
const agent = new BuyAndSellAgent();
const result = await agent.execute({
  userId: 'user-123',
  query: 'Find a pharmacy near me'
});
```

### FarmerAgent

Agricultural marketplace agent.

**Example**:
```typescript
const agent = new FarmerAgent();
const result = await agent.execute({
  userId: 'user-123',
  query: 'List my corn harvest for sale'
});
```

### JobsAgent

Job board and employment matching.

**Example**:
```typescript
const agent = new JobsAgent();
const result = await agent.execute({
  userId: 'user-123',
  query: 'Find software developer positions'
});
```

### RealEstateAgent

Property rentals and sales.

**Example**:
```typescript
const agent = new RealEstateAgent();
const result = await agent.execute({
  userId: 'user-123',
  query: 'Find 2-bedroom apartments in Kigali'
});
```

### SalesAgent

Marketing and sales campaigns.

**Example**:
```typescript
const agent = new SalesAgent();
const result = await agent.execute({
  userId: 'user-123',
  query: 'Create a marketing campaign for my new product'
});
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
