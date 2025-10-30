# OpenAI Agents SDK - Quick Start Examples

This guide provides practical examples for using the OpenAI Agents SDK integration in EasyMO.

## Table of Contents

- [Setup](#setup)
- [Basic Usage](#basic-usage)
- [WhatsApp Integration](#whatsapp-integration)
- [Voice Integration](#voice-integration)
- [Web/Mobile Integration](#webmobile-integration)
- [Custom Tools](#custom-tools)
- [Advanced Scenarios](#advanced-scenarios)

## Setup

### 1. Enable Feature Flags

```bash
# In .env or .env.local
OPENAI_API_KEY=sk-...
ENABLE_AGENTS=true
FEATURE_AGENTS_BOOKING=true
FEATURE_AGENTS_REDEMPTION=true
FEATURE_AGENTS_TRIAGE=true
```

### 2. Deploy Edge Functions

```bash
# Deploy agent-runner function
supabase functions deploy agent-runner --project-ref YOUR_PROJECT_REF

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set ENABLE_AGENTS=true
```

### 3. Run Migrations

```bash
supabase db push
```

## Basic Usage

### Example 1: Direct Agent Execution (Server-Side)

```typescript
import { runBookingAgent } from '@easymo/agents';

async function handleBookingRequest(userId: string, query: string) {
  try {
    const result = await runBookingAgent(userId, query, {
      userId,
      source: 'web',
    });

    console.log('Agent response:', result.finalOutput);
    console.log('Tools used:', result.toolsInvoked);
    console.log('Duration:', result.duration, 'ms');

    return result.finalOutput;
  } catch (error) {
    console.error('Agent error:', error);
    return 'Sorry, I encountered an error. Please try again.';
  }
}

// Usage
const response = await handleBookingRequest(
  'user-123',
  'Show me available time slots for Friday'
);
```

### Example 2: Using Triage Agent

```typescript
import { runTriageAgent, analyzeIntent } from '@easymo/agents';

async function handleUserQuery(userId: string, query: string) {
  // First, analyze intent
  const intent = analyzeIntent(query);
  console.log('Detected intent:', intent.agent, 'confidence:', intent.confidence);

  // Then run appropriate agent
  const result = await runTriageAgent(userId, query, {
    userId,
    source: 'web',
    metadata: { intent },
  });

  return result;
}
```

## WhatsApp Integration

### Example 3: WhatsApp Webhook Handler

```typescript
// In supabase/functions/wa-webhook/index.ts
import { runTriageAgent } from '@easymo/agents';

async function handleWhatsAppMessage(message: WhatsAppMessage) {
  const { from, text } = message;

  // Get user profile
  const profile = await getUserProfile(from);
  if (!profile) {
    await sendWhatsAppMessage(from, 'Please register first.');
    return;
  }

  try {
    // Run agent
    const result = await runTriageAgent(profile.id, text.body, {
      userId: profile.id,
      source: 'whatsapp',
      metadata: {
        phoneNumber: from,
        messageId: message.id,
      },
    });

    // Send response back to WhatsApp
    await sendWhatsAppMessage(from, result.finalOutput);

    // Log interaction
    await logStructuredEvent('WHATSAPP_AGENT_RESPONSE', {
      userId: profile.id,
      agentName: 'triage',
      messageId: message.id,
      durationMs: result.duration,
    });
  } catch (error) {
    console.error('Agent error:', error);
    await sendWhatsAppMessage(
      from,
      'Sorry, I encountered an error. Please try again.'
    );
  }
}
```

### Example 4: WhatsApp with Context Preservation

```typescript
import { runBookingAgent } from '@easymo/agents';

// Store conversation context
const conversationContexts = new Map<string, ConversationContext>();

async function handleWhatsAppBooking(userId: string, message: string, sessionId: string) {
  // Get existing context
  const context = conversationContexts.get(sessionId) || {
    userId,
    source: 'whatsapp',
    sessionId,
    conversationHistory: [],
  };

  // Add message to history
  context.conversationHistory.push({
    role: 'user',
    content: message,
    timestamp: new Date(),
  });

  // Run agent with context
  const result = await runBookingAgent(userId, message, context);

  // Store agent response in history
  context.conversationHistory.push({
    role: 'assistant',
    content: result.finalOutput,
    timestamp: new Date(),
  });

  // Update context
  conversationContexts.set(sessionId, context);

  return result.finalOutput;
}
```

## Voice Integration

### Example 5: Voice Bridge Integration

```typescript
// In services/voice-bridge
import { runBookingAgent } from '@easymo/agents';
import { textToSpeech, transcribeAudio } from './utils/audio';

async function handleVoiceInput(session: VoiceSession, audioBuffer: Buffer) {
  try {
    // Transcribe audio
    const transcribedText = await transcribeAudio(audioBuffer);
    console.log('Transcribed:', transcribedText);

    // Run agent
    const result = await runBookingAgent(session.userId, transcribedText, {
      userId: session.userId,
      source: 'voice',
      sessionId: session.id,
      metadata: {
        callId: session.callId,
        duration: session.duration,
      },
    });

    // Convert response to speech
    const audioResponse = await textToSpeech(result.finalOutput);

    // Send audio back to caller
    await session.sendAudio(audioResponse);

    return result;
  } catch (error) {
    console.error('Voice agent error:', error);
    const errorAudio = await textToSpeech(
      'Sorry, I had trouble understanding. Could you please repeat that?'
    );
    await session.sendAudio(errorAudio);
  }
}
```

## Web/Mobile Integration

### Example 6: React Component

```typescript
import { useState } from 'react';

export function AgentChat() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendQuery() {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.VITE_SUPABASE_URL}/functions/v1/agent-runner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.VITE_ADMIN_TOKEN,
          },
          body: JSON.stringify({
            agentName: 'triage',
            userId: currentUser.id,
            query,
          }),
        }
      );

      const result = await res.json();
      setResponse(result.finalOutput);
    } catch (error) {
      console.error('Agent error:', error);
      setResponse('Error: Unable to reach agent');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="agent-chat">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask me anything..."
      />
      <button onClick={sendQuery} disabled={loading}>
        {loading ? 'Thinking...' : 'Send'}
      </button>
      {response && <div className="response">{response}</div>}
    </div>
  );
}
```

### Example 7: Next.js API Route

```typescript
// pages/api/agent.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, agentName = 'triage' } = req.body;
  const userId = req.session.userId; // Get from session

  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/agent-runner`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.EASYMO_ADMIN_TOKEN!,
        },
        body: JSON.stringify({
          agentName,
          userId,
          query,
        }),
      }
    );

    const result = await response.json();
    res.status(200).json(result);
  } catch (error) {
    console.error('Agent API error:', error);
    res.status(500).json({ error: 'Agent execution failed' });
  }
}
```

## Custom Tools

### Example 8: Creating a Custom Tool

```typescript
// packages/agents/src/tools/customTool.ts
import { z } from 'zod';
import type { AgentContext } from '../types';
import { logToolInvocation } from '../observability';

export const myCustomToolSchema = z.object({
  parameter1: z.string().describe('First parameter'),
  parameter2: z.number().optional().describe('Optional second parameter'),
});

export async function executeMyCustomTool(
  params: z.infer<typeof myCustomToolSchema>,
  context: AgentContext
): Promise<{ result: string }> {
  await logToolInvocation('MyCustomTool', context, params);

  // Your custom logic here
  const result = `Processed ${params.parameter1}`;

  return { result };
}

export const myCustomTool = {
  name: 'MyCustomTool',
  description: 'Description for the LLM to understand when to use this tool',
  parameters: myCustomToolSchema,
  execute: executeMyCustomTool,
};
```

### Example 9: Adding Tool to Agent

```typescript
// packages/agents/src/agents/customAgent.ts
import type { AgentDefinition } from '../runner';
import { myCustomTool } from '../tools/customTool';

export const CustomAgent: AgentDefinition = {
  name: 'CustomAgent',
  instructions: `You are a custom agent that uses specialized tools...`,
  model: 'gpt-4o',
  tools: [myCustomTool],
};
```

## Advanced Scenarios

### Example 10: Multi-Agent Workflow

```typescript
import {
  runTriageAgent,
  runBookingAgent,
  runTokenRedemptionAgent,
  analyzeIntent,
} from '@easymo/agents';

async function handleComplexQuery(userId: string, query: string) {
  // Step 1: Triage to understand intent
  const intent = analyzeIntent(query);

  if (intent.confidence < 0.5) {
    // Low confidence, use triage agent
    return await runTriageAgent(userId, query);
  }

  // Step 2: Route to specialized agent
  let result;
  switch (intent.agent) {
    case 'booking':
      result = await runBookingAgent(userId, query);
      break;
    case 'redemption':
      result = await runTokenRedemptionAgent(userId, query);
      break;
    default:
      result = await runTriageAgent(userId, query);
  }

  // Step 3: Post-process if needed
  if (result.success && result.toolsInvoked?.includes('CreateBooking')) {
    // Send confirmation email/SMS
    await sendConfirmation(userId, result);
  }

  return result;
}
```

### Example 11: Streaming Responses (Future Enhancement)

```typescript
// Future implementation when streaming is added
async function* streamAgentResponse(userId: string, query: string) {
  const response = await fetch('/api/agent-stream', {
    method: 'POST',
    body: JSON.stringify({ userId, query }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    yield chunk;
  }
}

// Usage
for await (const chunk of streamAgentResponse('user-123', 'Book a slot')) {
  console.log('Received:', chunk);
  // Update UI with chunk
}
```

### Example 12: Error Handling and Retries

```typescript
import { runAgent, BookingAgent } from '@easymo/agents';

async function runAgentWithRetry(
  agent: typeof BookingAgent,
  input: AgentInput,
  maxRetries = 3
): Promise<AgentResult> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runAgent(agent, input);

      if (result.success) {
        return result;
      }

      // If agent returned unsuccessful result, retry
      lastError = new Error(result.error || 'Agent execution failed');
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
```

## Testing

### Example 13: Manual Testing with cURL

```bash
# Test booking agent
curl -X POST http://localhost:54321/functions/v1/agent-runner \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: your-admin-token' \
  -d '{
    "agentName": "booking",
    "userId": "test-user-id",
    "query": "Show me available time slots for Friday evening"
  }'

# Test redemption agent
curl -X POST http://localhost:54321/functions/v1/agent-runner \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: your-admin-token' \
  -d '{
    "agentName": "redemption",
    "userId": "test-user-id",
    "query": "What is my current balance?"
  }'

# Test triage agent
curl -X POST http://localhost:54321/functions/v1/agent-runner \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: your-admin-token' \
  -d '{
    "agentName": "triage",
    "userId": "test-user-id",
    "query": "I want to book a slot and check my balance"
  }'
```

### Example 14: Query Traces

```sql
-- View recent agent executions
SELECT 
  agent_name,
  user_id,
  query,
  duration_ms,
  tools_invoked,
  created_at
FROM agent_traces
ORDER BY created_at DESC
LIMIT 20;

-- Analyze agent performance
SELECT 
  agent_name,
  COUNT(*) as total_executions,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  MIN(duration_ms) as min_duration,
  ARRAY_AGG(DISTINCT tools_invoked) as unique_tools
FROM agent_traces
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_name;

-- Find slow executions
SELECT 
  agent_name,
  query,
  duration_ms,
  tools_invoked,
  created_at
FROM agent_traces
WHERE duration_ms > 5000  -- Over 5 seconds
ORDER BY duration_ms DESC;
```

## Next Steps

- Review [OPENAI_AGENTS_INTEGRATION.md](../OPENAI_AGENTS_INTEGRATION.md) for architecture details
- Check [GROUND_RULES.md](../GROUND_RULES.md) for compliance requirements
- Explore [@easymo/agents package README](../../packages/agents/README.md) for API reference
- Monitor agent traces in Supabase for performance insights

## Support

For questions or issues:
1. Check agent traces in database
2. Review Edge Function logs
3. Verify feature flags are enabled
4. Check OpenAI API key and quota
5. Contact EasyMO platform team
