# AI Agent Architecture

## Overview

This document describes the consolidated AI agent architecture for the EasyMO WhatsApp platform. The system provides intelligent message processing through specialized AI agents (Waiter, Jobs, Real Estate, etc.) with support for multiple AI providers (OpenAI, Gemini).

## Architecture Components

### 1. Agent Orchestrator Implementations

There are multiple AgentOrchestrator implementations in the codebase, each serving a specific deployment context:

| Implementation | Location | Runtime | Purpose |
|----------------|----------|---------|---------|
| `AgentOrchestrator` | `packages/ai/src/core/orchestrator.ts` | Node.js | Microservices and API servers |
| `AgentOrchestrator` | `supabase/functions/_shared/agent-orchestrator.ts` | Deno | Shared Supabase Edge Functions |
| `AIAgentOrchestrator` | `supabase/functions/_shared/ai-agent-orchestrator.ts` | Deno | AI-specific with context management |
| `AgentOrchestrator` | `supabase/functions/wa-webhook/shared/agent_orchestrator.ts` | Deno | WhatsApp webhook processing |

### 2. Unified Interface

All orchestrators follow the `IAgentOrchestrator` interface defined in `packages/ai/src/core/interfaces.ts`:

```typescript
interface IAgentOrchestrator {
  processMessage(params: ProcessMessageParams): Promise<OrchestratorResponse>;
  classifyIntent(message: string, context?: Record<string, unknown>): Promise<IntentResult>;
  transferToAgent?(conversationId: string, targetAgent: OrchestratorAgentType): Promise<void>;
  endConversation?(conversationId: string): Promise<void>;
  healthCheck?(): Promise<{ healthy: boolean; providers: Record<string, boolean> }>;
}
```

### 3. AI Provider Abstraction

The system supports multiple AI providers through a unified interface:

```typescript
interface IAIProvider {
  readonly name: string;
  readonly supportedModels: string[];
  chat(options: ProviderChatOptions): Promise<ProviderChatResponse>;
  embeddings(text: string, model?: string): Promise<number[]>;
  analyzeImage?(imageUrl: string, prompt: string): Promise<string>;
  healthCheck(): Promise<boolean>;
}
```

**Implementations:**
- `OpenAIProvider` - GPT-4, GPT-4o-mini (supabase/functions/_shared/llm-provider-openai.ts)
- `GeminiProvider` - Gemini 1.5 Pro/Flash (supabase/functions/_shared/llm-provider-gemini.ts)

### 4. LLM Router

The `LLMRouter` (`supabase/functions/_shared/llm-router.ts`) provides:
- Intelligent provider selection based on agent configuration
- Automatic failover between providers
- Tool-specific routing (e.g., Gemini for Google tools)

## Supported Agent Types

| Agent | Triggers | Primary Provider | Description |
|-------|----------|------------------|-------------|
| waiter | menu, food, order | Gemini | Restaurant ordering |
| rides | ride, driver, passenger | OpenAI | Mobility coordination |
| jobs | job, work, employ | OpenAI | Job board |
| business_broker | business, shop, service | Gemini | Business directory |
| real_estate | property, house, rent | OpenAI | Property rentals |
| farmer | farm, produce, crop | Gemini | Agricultural marketplace |
| insurance | insurance, policy, claim | OpenAI | Insurance services |
| general | (fallback) | OpenAI | General inquiries |

## Database Schema

### Core Tables

1. **agent_chat_sessions** - Persistent conversation sessions
   - User phone/ID
   - Agent type
   - Conversation history (JSONB)
   - Session status and expiry

2. **ai_agent_metrics** - Performance and cost tracking
   - Token usage (in/out)
   - Cost in USD
   - Latency metrics
   - Success/failure tracking

3. **agent_tool_executions** - Tool execution history
   - Tool name and parameters
   - Execution results
   - Duration and success

### Supporting Tables

- **whatsapp_users** - User identity
- **whatsapp_conversations** - Conversation tracking
- **ai_agents** - Agent configurations
- **ai_agent_intents** - Parsed intents
- **agent_configurations** - Agent-specific settings

## Message Flow

```
WhatsApp API
    ↓
wa-webhook-core (router)
    ↓
wa-webhook-ai-agents / wa-webhook
    ↓
AgentOrchestrator.processMessage()
    ├── getOrCreateUser()
    ├── determineAgent()
    ├── getOrCreateConversation()
    ├── storeMessage()
    ├── parseIntent()
    ├── executeAgentAction()
    └── sendResponse()
```

## Configuration

### Environment Variables

```bash
# AI Providers
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Feature Flags
FEATURE_AI_AGENTS=true

# Provider Settings
LLM_PRIMARY_PROVIDER=openai
LLM_FALLBACK_PROVIDER=gemini
```

### Agent Configuration (Database)

Agents can be configured in the `agent_configurations` table:

```sql
SELECT * FROM agent_configurations WHERE agent_type = 'waiter';
```

Fields:
- `primary_provider` - openai | gemini
- `fallback_provider` - openai | gemini
- `model_config` - JSONB with model-specific settings
- `routing_config` - Tool-specific routing rules

## Observability

All components follow the ground rules for structured logging:

```typescript
import { logStructuredEvent } from "../_shared/observability.ts";

await logStructuredEvent("AI_AGENT_PROCESSING_START", {
  correlationId,
  agentType,
  userId: maskPhone(userId),
});
```

### Key Events

- `AI_AGENT_REQUEST_START` - Message received
- `AGENT_INTENT_CLASSIFIED` - Intent determined
- `AGENT_PROCESSING_COMPLETE` - Response generated
- `AI_AGENT_REQUEST_SUCCESS/ERROR` - Final status

### Metrics

- `ai_agent.message_processed` - Request count
- `llm.chat.request` - LLM API calls
- `llm.router.success/error` - Router performance

## Best Practices

1. **Always use correlation IDs** for distributed tracing
2. **Mask PII** in logs (phone numbers, names)
3. **Check feature flags** before processing
4. **Use the LLM router** for automatic failover
5. **Store metrics** for cost monitoring

## Migration Guide

When adding new agents:

1. Add agent type to `OrchestratorAgentType` in interfaces.ts
2. Register in `agent_configurations` table
3. Add triggers in `AGENT_CONFIGURATIONS` (agent_configs.ts)
4. Implement agent-specific tools
5. Add to home menu if user-facing
