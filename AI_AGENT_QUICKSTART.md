# AI Agent System - Quick Start Guide

**For**: Developers implementing the AI agent system  
**Updated**: 2025-11-13  
**Status**: Ready to start

---

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js 20+ and pnpm 10+
- ✅ Access to Supabase project
- ✅ OpenAI API key with GPT-4o access
- ✅ Redis instance (local or cloud)
- ✅ Read `AI_AGENT_REVIEW_REPORT.md`
- ✅ Read `AI_AGENT_IMPLEMENTATION_PLAN.md`

---

## Week 1: Getting Started

### Day 1: Database Setup

1. **Enable pgvector extension**:
   ```sql
   -- In Supabase SQL Editor
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Create migration file**:
   ```bash
   cd supabase/migrations
   touch $(date +%Y%m%d%H%M%S)_ai_agent_system.sql
   ```

3. **Copy schema from implementation plan**:
   - Open `AI_AGENT_IMPLEMENTATION_PLAN.md`
   - Copy SQL schema from Milestone 1.1
   - Paste into migration file

4. **Run migration**:
   ```bash
   supabase db push
   ```

5. **Verify tables**:
   ```bash
   supabase db dump --schema public | grep "ai_"
   ```

---

### Day 2-3: Create AI Package

1. **Create package structure**:
   ```bash
   mkdir -p packages/ai/src/{core,agents,tools,memory}
   cd packages/ai
   pnpm init
   ```

2. **Install dependencies**:
   ```bash
   pnpm add openai zod ioredis @supabase/supabase-js uuid
   pnpm add -D @types/node typescript tsx vitest
   ```

3. **Create package.json**:
   ```json
   {
     "name": "@easymo/ai",
     "version": "1.0.0",
     "type": "module",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "dev": "tsx watch src/index.ts",
       "test": "vitest"
     }
   }
   ```

4. **Create tsconfig.json**:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "lib": ["ES2022"],
       "moduleResolution": "node",
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "declaration": true,
       "sourceMap": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

5. **Add to pnpm-workspace.yaml**:
   ```yaml
   packages:
     - 'packages/*'
     - 'packages/ai'  # Add this line
   ```

---

### Day 3-4: Implement AgentOrchestrator

1. **Create core types**:
   ```bash
   touch packages/ai/src/core/types.ts
   ```

   ```typescript
   // packages/ai/src/core/types.ts
   export interface AgentConfig {
     id: string;
     name: string;
     type: string;
     instructions: string;
     model: string;
     temperature: number;
     maxTokens: number;
     tools: string[];
     enabled: boolean;
   }

   export interface Conversation {
     id: string;
     agent_id: string;
     user_id: string;
     profile_id?: string;
     status: 'active' | 'ended' | 'escalated';
     context: Record<string, any>;
     started_at: string;
     ended_at?: string;
   }

   export interface AgentResponse {
     message: string;
     usage?: {
       prompt_tokens: number;
       completion_tokens: number;
       total_tokens: number;
     };
     cost?: number;
     toolsExecuted?: string[];
   }
   ```

2. **Create orchestrator skeleton**:
   ```bash
   touch packages/ai/src/core/orchestrator.ts
   ```

3. **Implement basic structure**:
   - Copy orchestrator code from `AI_AGENT_IMPLEMENTATION_PLAN.md`
   - Implement step by step
   - Test each method independently

4. **Create index.ts**:
   ```typescript
   // packages/ai/src/index.ts
   export { AgentOrchestrator } from './core/orchestrator';
   export type { AgentConfig, Conversation, AgentResponse } from './core/types';
   ```

---

### Day 5: Basic Tools

1. **Create tool structure**:
   ```bash
   mkdir -p packages/ai/src/tools/{payment,booking,support}
   ```

2. **Implement check_balance tool**:
   ```bash
   touch packages/ai/src/tools/payment/check-balance.ts
   ```

   ```typescript
   import { z } from 'zod';
   import { createClient } from '@supabase/supabase-js';

   export const checkBalanceTool = {
     name: 'check_balance',
     description: 'Check user wallet balance and recent transactions',
     parameters: z.object({
       userId: z.string(),
     }),
     execute: async (params: any, context: any) => {
       const supabase = createClient(
         process.env.SUPABASE_URL!,
         process.env.SUPABASE_SERVICE_ROLE_KEY!
       );

       const { data: wallet } = await supabase
         .from('wallets')
         .select('balance, currency')
         .eq('user_id', params.userId)
         .single();

       return {
         balance: wallet?.balance || 0,
         currency: wallet?.currency || 'RWF',
       };
     },
   };
   ```

3. **Create tool registry**:
   ```bash
   touch packages/ai/src/tools/index.ts
   ```

   ```typescript
   import { checkBalanceTool } from './payment/check-balance';

   export const TOOLS = {
     check_balance: checkBalanceTool,
   };

   export function getTool(name: string) {
     return TOOLS[name as keyof typeof TOOLS];
   }
   ```

---

### Day 6-7: WhatsApp Integration

1. **Create integration file**:
   ```bash
   touch supabase/functions/wa-webhook/domains/ai-agents/orchestrator-integration.ts
   ```

2. **Implement handler**:
   ```typescript
   import { AgentOrchestrator } from '@easymo/ai';

   let orchestrator: AgentOrchestrator | null = null;

   export function getOrchestrator(): AgentOrchestrator {
     if (!orchestrator) {
       orchestrator = new AgentOrchestrator({
         openaiKey: Deno.env.get('OPENAI_API_KEY')!,
         redisUrl: Deno.env.get('REDIS_URL')!,
         supabaseUrl: Deno.env.get('SUPABASE_URL')!,
         supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
       });
     }
     return orchestrator;
   }

   export async function handleAIMessage(
     ctx: any,
     message: string
   ): Promise<boolean> {
     try {
       const orchestrator = getOrchestrator();
       
       const response = await orchestrator.processMessage({
         userId: ctx.from,
         message,
       });

       await sendText(ctx.from, response.message);
       return true;
     } catch (error) {
       console.error('AI error:', error);
       return false;
     }
   }
   ```

3. **Update text router**:
   ```typescript
   // In router/text.ts
   import { handleAIMessage } from '../domains/ai-agents/orchestrator-integration.ts';

   // Add to router
   if (text.startsWith('ai ') || ctx.inAIConversation) {
     return await handleAIMessage(ctx, text.replace('ai ', ''));
   }
   ```

---

## Week 2: Testing & Refinement

### Day 8-9: Unit Tests

```bash
# Create test file
touch packages/ai/src/core/orchestrator.test.ts
```

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentOrchestrator } from './orchestrator';

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      openaiKey: 'test-key',
      redisUrl: 'redis://localhost:6379',
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
    });
  });

  it('should classify intent correctly', async () => {
    const agent = await orchestrator.classifyIntent('I want to book a slot');
    expect(agent.type).toBe('booking');
  });

  it('should create conversation', async () => {
    const conversation = await orchestrator.getOrCreateConversation({
      userId: '+250788123456',
      message: 'Hello',
    });
    expect(conversation.id).toBeDefined();
    expect(conversation.status).toBe('active');
  });
});
```

### Day 10: Integration Test

```bash
# Test end-to-end flow
pnpm --filter @easymo/ai test
```

---

## Environment Variables

Add to `.env`:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Redis
REDIS_URL=redis://localhost:6379

# Supabase (already exists)
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Feature Flags
FEATURE_AI_AGENTS=true
FEATURE_AI_STREAMING=true

# Limits
AI_MAX_TOKENS=1000
AI_TEMPERATURE=0.7
AI_MAX_CONVERSATIONS_PER_USER=5
```

---

## Testing

### Test Orchestrator Locally

```typescript
// test-orchestrator.ts
import { AgentOrchestrator } from '@easymo/ai';

const orchestrator = new AgentOrchestrator({
  openaiKey: process.env.OPENAI_API_KEY!,
  redisUrl: process.env.REDIS_URL!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

async function test() {
  const response = await orchestrator.processMessage({
    userId: '+250788123456',
    message: 'I want to book a slot for Friday',
  });
  
  console.log('Response:', response.message);
  console.log('Cost:', response.cost);
  console.log('Tokens:', response.usage);
}

test();
```

Run:
```bash
pnpm tsx test-orchestrator.ts
```

### Test via WhatsApp

1. Send message to your WhatsApp number: `ai hello`
2. Check response
3. Continue conversation
4. Verify context is preserved

---

## Monitoring

### Check Conversations

```sql
-- In Supabase SQL Editor
SELECT 
  c.id,
  c.user_id,
  a.name as agent_name,
  c.status,
  c.started_at,
  COUNT(m.id) as message_count,
  SUM(m.cost_usd) as total_cost
FROM ai_conversations c
JOIN ai_agents a ON a.id = c.agent_id
LEFT JOIN ai_messages m ON m.conversation_id = c.id
GROUP BY c.id, a.name
ORDER BY c.started_at DESC
LIMIT 10;
```

### Check Costs

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as messages,
  SUM(cost_usd) as total_cost
FROM ai_messages
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## Common Issues & Solutions

### Issue: OpenAI API Error

**Solution**: Check API key, rate limits, and model availability

### Issue: Redis Connection Failed

**Solution**: Verify Redis is running: `redis-cli ping`

### Issue: Agent Not Responding

**Solution**: 
1. Check logs: `supabase functions logs wa-webhook`
2. Verify agent is enabled in database
3. Test orchestrator directly

### Issue: High Costs

**Solution**:
1. Reduce max_tokens
2. Use GPT-4o-mini for simple tasks
3. Implement response caching

---

## Next Steps

After completing Week 1-2:

1. **Review metrics** - Check costs, latency, success rate
2. **Gather feedback** - Test with real users
3. **Add more tools** - Implement remaining 10+ tools
4. **Build admin panel** - Start Phase 3
5. **Optimize** - Reduce costs and latency

---

## Support

**Questions?** 
- Check `AI_AGENT_REVIEW_REPORT.md` for architecture details
- Check `AI_AGENT_IMPLEMENTATION_PLAN.md` for full roadmap
- Review existing code in `packages/agents/src/`

**Stuck?**
- Test each component independently
- Check logs thoroughly
- Start simple, add complexity gradually

---

**Good luck! Let's build world-class AI agents! 🚀**
