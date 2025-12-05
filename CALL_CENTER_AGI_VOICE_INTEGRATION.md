# Call Center AGI - Voice Integration Guide

## Overview

This guide connects the Call Center AGI to actual voice channels (WhatsApp calls and SIP phone calls) using OpenAI Realtime API.

## Architecture

```
WhatsApp Call/SIP → Voice Gateway → OpenAI Realtime API → Call Center AGI Tools
                                          ↓
                                    Supabase Database
```

## Components

### 1. Voice Gateway (`services/voice-gateway`)
- Receives SIP calls and WhatsApp audio
- Manages WebSocket connection to OpenAI Realtime
- Bridges audio streams

### 2. Voice Bridge (`services/voice-bridge`)
- MTN SIP trunk integration
- Audio format conversion
- Call routing

### 3. Call Center AGI (`supabase/functions/wa-agent-call-center`)
- Receives tool calls from OpenAI
- Executes database operations
- Returns results to voice stream

## Integration Steps

### Step 1: Update Voice Gateway Config

Add Call Center AGI tools to voice gateway configuration:

**File:** `services/voice-gateway/src/config.ts`

```typescript
export const CALL_CENTER_TOOLS = [
  {
    type: 'function',
    name: 'get_or_create_profile',
    description: 'Get or create user profile by phone number',
    parameters: {
      type: 'object',
      properties: {
        phone_number: { type: 'string' }
      },
      required: ['phone_number']
    }
  },
  // ... (all 20+ tools from migration)
];
```

### Step 2: Create Voice-to-AGI Bridge

**File:** `services/voice-gateway/src/agi-bridge.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export class AGIBridge {
  constructor(private supabase: SupabaseClient) {}

  async executeToolCall(toolName: string, args: any, callContext: any) {
    // Forward tool execution to Call Center AGI
    const response = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/wa-agent-call-center`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'X-Agent-Tool-Call': 'true',
          'X-Call-ID': callContext.callId,
        },
        body: JSON.stringify({
          tool: toolName,
          args,
          call_context: callContext
        })
      }
    );

    return await response.json();
  }
}
```

### Step 3: Update OpenAI Realtime Session

**File:** `services/voice-gateway/src/realtime-session.ts`

```typescript
import { CallCenterAGI } from './agi-bridge';

export async function createRealtimeSession(callId: string, phone: string) {
  const supabase = createSupabaseClient();
  
  // Load AGI system prompt from database
  const { data: systemPrompt } = await supabase
    .from('ai_agent_system_instructions')
    .select('instructions')
    .eq('code', 'CALL-CENTER-AGI-SYSTEM')
    .eq('is_active', true)
    .single();

  // Load AGI tools from database
  const { data: tools } = await supabase
    .from('ai_agent_tools')
    .select('*')
    .eq('agent_id', (
      await supabase
        .from('ai_agents')
        .select('id')
        .eq('slug', 'call_center')
        .single()
    ).data.id)
    .eq('is_active', true);

  // Create OpenAI Realtime session with AGI tools
  const session = await openai.beta.realtime.sessions.create({
    model: 'gpt-4o-realtime-preview-2024-12-17',
    voice: 'alloy',
    instructions: systemPrompt?.instructions || DEFAULT_PROMPT,
    tools: tools?.map(t => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    })) || [],
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500
    },
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16'
  });

  return session;
}
```

### Step 4: Handle Tool Execution

**File:** `services/voice-gateway/src/tool-executor.ts`

```typescript
export async function handleToolCall(
  toolCall: any,
  callContext: any
) {
  const agiBridge = new AGIBridge(supabase);
  
  try {
    // Execute tool via Call Center AGI
    const result = await agiBridge.executeToolCall(
      toolCall.function.name,
      JSON.parse(toolCall.function.arguments),
      callContext
    );

    // Send result back to OpenAI Realtime
    await realtimeSession.sendToolResult({
      call_id: toolCall.id,
      output: JSON.stringify(result.data)
    });

    // Log tool execution
    await supabase.from('tool_executions').insert({
      call_id: callContext.callId,
      tool_name: toolCall.function.name,
      args: toolCall.function.arguments,
      result: result.data,
      success: result.success
    });

  } catch (error) {
    // Send error back to OpenAI
    await realtimeSession.sendToolResult({
      call_id: toolCall.id,
      output: JSON.stringify({
        error: error.message
      })
    });
  }
}
```

### Step 5: Update Edge Function for Tool Calls

**File:** `supabase/functions/wa-agent-call-center/index.ts`

Add tool call handler:

```typescript
// Handle tool execution from voice gateway
if (req.headers.get('X-Agent-Tool-Call') === 'true') {
  const { tool, args, call_context } = await req.json();
  
  await logStructuredEvent('TOOL_CALL_FROM_VOICE', {
    tool,
    callId: call_context.callId
  });

  // Execute tool using AGI
  const toolExecutor = agi.tools.get(tool);
  if (!toolExecutor) {
    return respond({ error: 'Unknown tool' }, { status: 400 });
  }

  const result = await toolExecutor(args, supabase, call_context.phone);
  
  return respond(result);
}
```

## Deployment

### 1. Deploy Voice Gateway

```bash
cd services/voice-gateway
npm install
npm run build
npm run deploy
```

### 2. Configure Environment Variables

```bash
# Voice Gateway
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# SIP Configuration
SIP_DOMAIN=sip.easymo.rw
SIP_USERNAME=callcenter
SIP_PASSWORD=...

# WhatsApp Voice
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
```

### 3. Test Voice Call

```bash
# Test inbound call handling
curl -X POST http://localhost:3000/calls/start \
  -H "Content-Type: application/json" \
  -d '{
    "from_number": "+250788123456",
    "to_number": "+250788000000",
    "agent_id": "call_center",
    "direction": "inbound"
  }'
```

## Call Flow

### Inbound WhatsApp Call

```
1. User calls WhatsApp number
2. WhatsApp webhook → Voice Gateway
3. Voice Gateway creates OpenAI Realtime session with AGI tools
4. OpenAI streams voice responses
5. When tool needed:
   a. OpenAI sends tool call
   b. Voice Gateway → Call Center AGI
   c. AGI executes tool → Database
   d. Result → OpenAI
   e. OpenAI continues conversation
6. Call ends → Summary logged
```

### Inbound SIP Call

```
1. Caller dials EasyMO number
2. MTN SIP → Voice Bridge
3. Voice Bridge → Voice Gateway
4. [Same as WhatsApp from step 3]
```

## Voice-Specific Optimizations

### 1. Response Timing

```typescript
// Add pauses for natural speech
function formatForVoice(text: string): string {
  return text
    .replace(/\n/g, '... ') // Newlines become pauses
    .replace(/\d+\./g, match => `${match} ... `) // Pause after numbers
    .replace(/,/g, ', ... '); // Small pause after commas
}
```

### 2. Confirmation Patterns

```typescript
// Double confirmation for critical actions
const confirmationNeeded = ['wallet_initiate_token_transfer'];

if (confirmationNeeded.includes(toolName)) {
  // Ask for confirmation in natural language
  await speakToUser("Let me confirm. You want to send 50 tokens to +250789000000. Is that correct?");
  
  // Wait for yes/no
  const confirmation = await waitForUserResponse();
  
  if (!confirmation.includes('yes')) {
    await speakToUser("Okay, transfer cancelled.");
    return;
  }
}
```

### 3. Error Handling for Voice

```typescript
// Voice-friendly error messages
function voiceErrorMessage(error: Error): string {
  const messages = {
    'network': "I'm having trouble connecting. Let me try that again.",
    'timeout': "That's taking longer than expected. Would you like to wait or try something else?",
    'validation': "I didn't quite get that. Could you repeat it?",
    'unknown': "I apologize, something went wrong. Let me transfer you to support."
  };
  
  const errorType = classifyError(error);
  return messages[errorType] || messages.unknown;
}
```

## Monitoring

### Voice Call Metrics

```sql
-- Average call duration by intent
SELECT 
  primary_intent,
  AVG(duration_seconds) as avg_duration,
  COUNT(*) as call_count
FROM call_summaries
WHERE created_at > now() - interval '7 days'
GROUP BY primary_intent;

-- Tool usage in voice calls
SELECT 
  metadata->>'toolsUsed' as tools,
  COUNT(*) as usage_count
FROM call_summaries
WHERE metadata->>'toolsUsed' IS NOT NULL
GROUP BY tools;

-- Success rate by tool
SELECT 
  tool_name,
  SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate,
  COUNT(*) as total_calls
FROM tool_executions
GROUP BY tool_name;
```

## Troubleshooting

### Issue: No audio in calls

**Check:**
1. Audio format matches (pcm16)
2. Sample rate is 16kHz
3. WebSocket connection is stable

### Issue: Tools not executing

**Check:**
1. Tools are loaded in OpenAI session
2. Call Center AGI is deployed
3. Service role key has permissions

### Issue: High latency

**Optimize:**
1. Use edge function in same region
2. Reduce tool complexity
3. Cache database queries
4. Use connection pooling

## Next Steps

1. **Deploy voice gateway** with AGI integration
2. **Configure SIP trunk** for phone calls
3. **Set up WhatsApp calling** webhook
4. **Test all tools** via voice interface
5. **Monitor metrics** and optimize

---

**Status:** Voice integration ready for deployment  
**Requirements:** OpenAI API key, SIP provider, WhatsApp Business API
