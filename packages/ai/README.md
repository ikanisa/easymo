# @easymo/ai

AI Agent Orchestration System for EasyMO platform. Provides intelligent conversational agents powered by OpenAI GPT-4o for WhatsApp and other channels.

## Features

- 🤖 **Multi-Agent System** - Specialized agents for different domains (Triage, Booking, Payment, Support)
- 🔧 **Rich Tool Support** - 6+ production-ready tools for payments, bookings, profile management, and support
- 🧠 **Smart Memory** - Dual-layer memory (Redis + pgvector) for context-aware conversations
- 📊 **Cost Tracking** - Real-time token usage and cost monitoring
- 🎯 **Intent Classification** - AI-powered routing to appropriate agents
- ⚡ **High Performance** - Optimized for low latency and high throughput
- 🔒 **Secure** - Built-in authentication and authorization checks

## Installation

```bash
pnpm add @easymo/ai
```

## Quick Start

```typescript
import { AgentOrchestrator } from '@easymo/ai';

// Initialize orchestrator
const orchestrator = new AgentOrchestrator({
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  redis: {
    url: process.env.REDIS_URL!,
  },
});

await orchestrator.initialize();

// Process a message
const response = await orchestrator.processMessage({
  conversationId: 'user-phone-number',
  userId: 'uuid',
  message: 'Check my balance',
  channel: 'whatsapp',
});

console.log(response.message); // AI response text
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   AgentOrchestrator                     │
│  - Routes messages to appropriate agents                │
│  - Manages conversation state                           │
│  - Handles tool execution                               │
│  - Tracks metrics and costs                             │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │ Triage  │       │ Booking │       │ Payment │
   │  Agent  │       │  Agent  │       │  Agent  │
   └────┬────┘       └────┬────┘       └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Tool Layer │
                    │  (6 tools)  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │Supabase │       │  Redis  │       │ OpenAI  │
   │(Storage)│       │ (Cache) │       │  (LLM)  │
   └─────────┘       └─────────┘       └─────────┘
```

## Available Tools

### Payment Tools

#### `check_balance`
Check user wallet balance with optional transaction history.

```typescript
{
  user_id?: string;
  phone_number?: string;
  include_transactions?: boolean;
  transaction_limit?: number;
}
```

#### `send_money`
Send money to another user via phone number.

```typescript
{
  from_user_id: string;
  to_phone_number: string;
  amount: number;
  currency?: string;
  description?: string;
  pin?: string; // For verification
}
```

### Booking Tools

#### `check_availability`
Check availability of vehicles/services.

```typescript
{
  service_type?: 'taxi' | 'shuttle' | 'delivery' | 'rental';
  location_from?: string;
  location_to?: string;
  date?: string;
  time?: string;
  passengers?: number;
  country?: string;
}
```

#### `create_booking`
Create a new booking.

```typescript
{
  user_id: string;
  vehicle_id?: string;
  service_type: 'taxi' | 'shuttle' | 'delivery' | 'rental';
  pickup_location: string;
  dropoff_location?: string;
  pickup_time: string;
  passengers?: number;
  notes?: string;
  payment_method?: 'wallet' | 'cash' | 'card';
}
```

### Profile Tools

#### `get_user_profile`
Get user profile with stats and wallet info.

```typescript
{
  user_id?: string;
  phone_number?: string;
  include_stats?: boolean;
  include_wallet?: boolean;
}
```

### Support Tools

#### `create_ticket`
Create a support ticket.

```typescript
{
  user_id: string;
  subject: string;
  description: string;
  category: 'booking_issue' | 'payment_issue' | 'technical_issue' | ...;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  related_booking_id?: string;
  related_transaction_id?: string;
}
```

## Agents

### Triage Agent
Routes incoming requests to appropriate specialized agents based on intent.

### Booking Agent
Handles vehicle booking, availability checks, and reservation management.

**Triggers**: booking, taxi, ride, shuttle, delivery, rental, reserve

### Payment Agent
Manages wallet operations, transactions, and money transfers.

**Triggers**: balance, payment, send money, transfer, wallet, top up

### Support Agent
Handles support tickets, complaints, and general inquiries.

**Triggers**: help, support, issue, problem, complaint, feedback

## Memory System

### Short-Term Memory (Redis)
- Last 50 messages per conversation
- Fast access for immediate context
- Auto-expires after TTL

### Long-Term Memory (pgvector)
- Semantic search using OpenAI embeddings
- Stores important facts, preferences, decisions
- Retrieval based on query similarity

```typescript
// Memory is automatic, but you can also query directly
const memories = await orchestrator.retrieveMemory(
  conversationId,
  'user preferences about payment',
  5 // top K results
);
```

## Cost Tracking

All API calls are tracked with token usage and cost:

```typescript
const response = await orchestrator.processMessage({...});

console.log(response.usage);
// {
//   promptTokens: 150,
//   completionTokens: 80,
//   totalTokens: 230,
//   costUsd: 0.00345
// }
```

## Metrics

Comprehensive metrics are automatically tracked:

- Token usage per message
- Latency (LLM, tools, total)
- Cost per conversation
- Tool execution stats
- Error rates

View metrics in the database:

```sql
SELECT * FROM ai_metrics 
WHERE agent_id = 'agent-uuid'
ORDER BY timestamp DESC;
```

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://....supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://localhost:6379

# Optional
OPENAI_ORG_ID=org-...
AI_LOG_LEVEL=info
AI_ENABLE_CACHING=true
AI_CACHE_TTL=300
```

## Database Setup

Run the migration:

```bash
supabase db push
```

This creates:
- 9 tables (agents, conversations, messages, tools, metrics, etc.)
- 6 helper functions
- 3 analytical views
- Vector search support (pgvector)
- Default agents and tools

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev

# Run tests
pnpm test
```

## Examples

### Check Balance
```typescript
const response = await orchestrator.processMessage({
  conversationId: '+1234567890',
  userId: 'user-uuid',
  message: 'What is my balance?',
  channel: 'whatsapp',
});
// Response: "Your current balance is USD 150.50"
```

### Create Booking
```typescript
const response = await orchestrator.processMessage({
  conversationId: '+1234567890',
  userId: 'user-uuid',
  message: 'Book a taxi from Airport to Hotel',
  channel: 'whatsapp',
});
// Response: "✅ Booking confirmed! Booking ID: TKT-..."
```

### Send Money
```typescript
const response = await orchestrator.processMessage({
  conversationId: '+1234567890',
  userId: 'user-uuid',
  message: 'Send $50 to +0987654321',
  channel: 'whatsapp',
});
// Response: "Please provide your transaction PIN to complete the transfer"
```

## API Reference

### AgentOrchestrator

#### `initialize()`
Initialize the orchestrator and load agents.

#### `processMessage(params)`
Process an incoming message and return AI response.

#### `retrieveMemory(conversationId, query, topK)`
Retrieve relevant memories using semantic search.

#### `getConversation(conversationId)`
Load conversation history and stats.

#### `endConversation(conversationId)`
End a conversation and save summary.

## Best Practices

1. **Always provide userId** - Required for tool execution and personalization
2. **Use conversationId consistently** - Use phone number or unique ID per user
3. **Handle PIN flows** - Some tools require PIN verification in multi-turn conversations
4. **Monitor costs** - Track token usage and set alerts
5. **Cache agent configs** - Avoid loading from DB on every request
6. **Use appropriate agent** - Let triage agent route, or specify agent_type

## Troubleshooting

### Tool not executing
- Ensure tool is registered in database (`ai_tools` table)
- Check tool authentication requirements
- Verify user has required permissions

### High costs
- Use GPT-4o-mini for simple classification
- Enable response caching in Redis
- Limit conversation history to recent messages

### Slow responses
- Check Redis connection
- Enable agent config caching
- Review tool execution times in metrics

## License

MIT

## Support

- 📧 Email: support@easymo.com
- 📚 Docs: https://docs.easymo.com/ai-agents
- 🐛 Issues: GitHub Issues

---

**Made with ❤️ by the EasyMO Team**
