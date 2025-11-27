# 🎯 Unified AI Agent Architecture - Consolidation Plan

**Date:** November 27, 2025  
**Status:** CRITICAL - Multiple overlapping implementations need consolidation

---

## 🚨 PROBLEM SUMMARY

Based on the deep review, we have:

### Critical Issues
1. **4 Different Orchestrator Implementations**
   - `packages/ai/src/core/orchestrator.ts` (Node.js + OpenAI)
   - `supabase/functions/_shared/agent-orchestrator.ts` (Deno)
   - `supabase/functions/_shared/ai-agent-orchestrator.ts` (Deno AI-specific)
   - `supabase/functions/wa-webhook/shared/agent_orchestrator.ts` (wa-webhook)

2. **Mixed AI Providers**
   - Google Gemini (WaiterAgent)
   - OpenAI GPT-4 (orchestrator)
   - OpenAI GPT-4o-mini (handler)

3. **Duplicate Agent Code**
   - WaiterAgent in 2 places
   - FarmerAgent in multiple locations
   - No single source of truth

4. **Fragmented Routing**
   - Menu items route to different services
   - No consistent agent loading
   - Unclear handoff logic

---

## ✅ RECOMMENDED SOLUTION: UNIFIED ARCHITECTURE

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp Message                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  wa-webhook-core                            │
│  • Verifies webhook signature                              │
│  • Routes based on menu selection or keywords              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
        ┌──────────────┴────────────────┐
        ↓                                ↓
┌─────────────────┐          ┌──────────────────────┐
│ Workflow Services│          │ wa-webhook-ai-agents │
│ (Non-AI)        │          │  (UNIFIED AI SYSTEM) │
├─────────────────┤          ├──────────────────────┤
│ • mobility      │          │ SINGLE ORCHESTRATOR  │
│ • insurance     │          │         ↓            │
│ • profile       │          │   Agent Registry     │
└─────────────────┘          │         ↓            │
                             │  ┌─────────────────┐ │
                             │  │ • Waiter Agent  │ │
                             │  │ • Farmer Agent  │ │
                             │  │ • Support Agent │ │
                             │  │ • Jobs Agent    │ │
                             │  │ • Property Agent│ │
                             │  │ • Market Agent  │ │
                             │  └─────────────────┘ │
                             │         ↓            │
                             │  Unified AI Provider │
                             │  (Gemini preferred)  │
                             └──────────────────────┘
```

---

## 📦 PHASE 1: CONSOLIDATE ORCHESTRATOR (P0)

### Goal
**ONE orchestrator to rule them all**

### Implementation

**Location:** `supabase/functions/wa-webhook-ai-agents/core/unified-orchestrator.ts`

```typescript
/**
 * Unified AI Agent Orchestrator
 * Single source of truth for all AI agent interactions
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AgentRegistry } from './agent-registry.ts';
import { GeminiProvider } from './providers/gemini.ts';
import { SessionManager } from './session-manager.ts';

export interface ProcessMessageParams {
  phone: string;
  message: string;
  agentType?: string; // Optional - can be inferred
  context?: Record<string, any>;
}

export interface AgentResponse {
  message: string;
  agentType: string;
  nextState?: string;
  metadata?: Record<string, any>;
}

export class UnifiedOrchestrator {
  private registry: AgentRegistry;
  private aiProvider: GeminiProvider;
  private sessionManager: SessionManager;
  
  constructor(private supabase: SupabaseClient) {
    this.registry = new AgentRegistry();
    this.aiProvider = new GeminiProvider();
    this.sessionManager = new SessionManager(supabase);
  }

  /**
   * Main entry point - processes any message
   */
  async processMessage(params: ProcessMessageParams): Promise<AgentResponse> {
    const { phone, message, agentType, context } = params;
    
    // 1. Get or create session
    const session = await this.sessionManager.getOrCreate(phone);
    
    // 2. Determine which agent to use
    const agent = agentType 
      ? this.registry.getAgent(agentType)
      : await this.determineAgent(message, session);
    
    // 3. Update session context
    await this.sessionManager.updateContext(session.id, {
      ...context,
      currentAgent: agent.type,
    });
    
    // 4. Process with agent
    const response = await agent.process({
      message,
      session,
      aiProvider: this.aiProvider,
      supabase: this.supabase,
    });
    
    // 5. Log interaction
    await this.logInteraction(session.id, agent.type, message, response);
    
    return response;
  }

  /**
   * Intelligently determines which agent should handle the message
   */
  private async determineAgent(message: string, session: Session): Promise<Agent> {
    // Check if user has active agent in session
    if (session.context?.currentAgent) {
      return this.registry.getAgent(session.context.currentAgent);
    }
    
    // Use AI to classify intent
    const intent = await this.classifyIntent(message);
    
    // Map intent to agent
    return this.registry.getAgentByIntent(intent);
  }

  private async classifyIntent(message: string): Promise<string> {
    const prompt = `
Classify the user's intent from this message into ONE category:
- waiter (food, restaurant, ordering)
- farmer (crops, agriculture, market prices)
- jobs (employment, hiring, career)
- property (rental, housing, real estate)
- marketplace (buy, sell, shopping)
- support (help, questions, issues)

Message: "${message}"

Reply with ONLY the category name.`;

    const result = await this.aiProvider.chat([
      { role: 'user', content: prompt }
    ]);
    
    return result.trim().toLowerCase();
  }

  private async logInteraction(
    sessionId: string,
    agentType: string,
    userMessage: string,
    agentResponse: AgentResponse
  ): Promise<void> {
    await this.supabase.from('ai_agent_interactions').insert({
      session_id: sessionId,
      agent_type: agentType,
      user_message: userMessage,
      agent_response: agentResponse.message,
      metadata: agentResponse.metadata,
    });
  }
}
```

---

## 📦 PHASE 2: UNIFIED AGENT REGISTRY (P0)

**Location:** `supabase/functions/wa-webhook-ai-agents/core/agent-registry.ts`

```typescript
/**
 * Central Agent Registry
 * All agents register here - single source of truth
 */

import { BaseAgent } from './base-agent.ts';
import { WaiterAgent } from '../agents/waiter-agent.ts';
import { FarmerAgent } from '../agents/farmer-agent.ts';
import { SupportAgent } from '../agents/support-agent.ts';
import { JobsAgent } from '../agents/jobs-agent.ts';
import { PropertyAgent } from '../agents/property-agent.ts';
import { MarketplaceAgent } from '../agents/marketplace-agent.ts';

export class AgentRegistry {
  private agents = new Map<string, BaseAgent>();
  private intentMapping = new Map<string, string>();

  constructor() {
    this.registerAllAgents();
    this.setupIntentMapping();
  }

  private registerAllAgents(): void {
    // Register all available agents
    this.register(new WaiterAgent());
    this.register(new FarmerAgent());
    this.register(new SupportAgent());
    this.register(new JobsAgent());
    this.register(new PropertyAgent());
    this.register(new MarketplaceAgent());
  }

  private setupIntentMapping(): void {
    // Map intents/keywords to agents
    this.intentMapping.set('waiter', 'waiter_agent');
    this.intentMapping.set('farmer', 'farmer_agent');
    this.intentMapping.set('support', 'sales_agent');
    this.intentMapping.set('jobs', 'jobs_agent');
    this.intentMapping.set('property', 'real_estate_agent');
    this.intentMapping.set('marketplace', 'business_broker_agent');
  }

  register(agent: BaseAgent): void {
    this.agents.set(agent.type, agent);
  }

  getAgent(type: string): BaseAgent {
    const agent = this.agents.get(type);
    if (!agent) {
      throw new Error(`Agent not found: ${type}`);
    }
    return agent;
  }

  getAgentByIntent(intent: string): BaseAgent {
    const agentType = this.intentMapping.get(intent);
    if (!agentType) {
      // Fallback to support agent
      return this.getAgent('sales_agent');
    }
    return this.getAgent(agentType);
  }

  listAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }
}
```

---

## 📦 PHASE 3: UNIFIED AI PROVIDER (P0)

**Location:** `supabase/functions/wa-webhook-ai-agents/core/providers/gemini.ts`

```typescript
/**
 * Unified AI Provider using Google Gemini
 * Single provider for all agents
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class GeminiProvider {
  private genAI: GoogleGenerativeAI;
  private defaultModel = 'gemini-2.0-flash-exp';

  constructor() {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not set');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async chat(messages: Message[], config?: ChatConfig): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: config?.model ?? this.defaultModel,
    });

    // Convert messages to Gemini format
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const result = await model.generateContent({
      contents,
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 1000,
      },
    });

    return result.response.text();
  }

  async *stream(messages: Message[], config?: ChatConfig): AsyncIterable<string> {
    const model = this.genAI.getGenerativeModel({
      model: config?.model ?? this.defaultModel,
    });

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const result = await model.generateContentStream({
      contents,
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
        maxOutputTokens: config?.maxTokens ?? 1000,
      },
    });

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
}
```

---

## 📦 PHASE 4: BASE AGENT INTERFACE (P0)

**Location:** `supabase/functions/wa-webhook-ai-agents/core/base-agent.ts`

```typescript
/**
 * Base Agent Interface
 * All agents must implement this
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeminiProvider } from './providers/gemini.ts';
import { Session } from './session-manager.ts';

export interface AgentProcessParams {
  message: string;
  session: Session;
  aiProvider: GeminiProvider;
  supabase: SupabaseClient;
}

export interface AgentResponse {
  message: string;
  agentType: string;
  nextState?: string;
  metadata?: Record<string, any>;
}

export abstract class BaseAgent {
  abstract type: string;
  abstract name: string;
  abstract description: string;

  /**
   * Main processing method - must be implemented by each agent
   */
  abstract process(params: AgentProcessParams): Promise<AgentResponse>;

  /**
   * System prompt for this agent
   */
  abstract getSystemPrompt(): string;

  /**
   * Helper to generate AI response
   */
  protected async generateResponse(
    userMessage: string,
    context: Record<string, any>,
    aiProvider: GeminiProvider
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt();
    const contextString = JSON.stringify(context, null, 2);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'system' as const, content: `Context: ${contextString}` },
      { role: 'user' as const, content: userMessage },
    ];

    return await aiProvider.chat(messages);
  }
}
```

---

## 📦 PHASE 5: UPDATE wa-webhook-ai-agents ENTRY POINT

**Location:** `supabase/functions/wa-webhook-ai-agents/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { UnifiedOrchestrator } from './core/unified-orchestrator.ts';
import { verifyWebhookSignature } from '../_shared/webhook-utils.ts';
import { logStructuredEvent } from '../_shared/observability.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const orchestrator = new UnifiedOrchestrator(supabase);

serve(async (req: Request): Promise<Response> => {
  // ... webhook verification ...

  try {
    const payload = await req.json();
    const message = extractMessage(payload);
    const phone = message.from;
    const text = message.text?.body ?? '';

    // Get agent type from routing (menu selection)
    const agentType = extractAgentType(message);

    // Process with unified orchestrator
    const response = await orchestrator.processMessage({
      phone,
      message: text,
      agentType,
    });

    // Send WhatsApp response
    await sendWhatsAppMessage(phone, response.message);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    await logStructuredEvent('AI_AGENT_ERROR', { error: error.message }, 'error');
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
  }
});

function extractAgentType(message: any): string | undefined {
  // Check if message is from menu selection
  const interactive = message.interactive;
  if (interactive?.list_reply?.id) {
    return interactive.list_reply.id;
  }
  if (interactive?.button_reply?.id) {
    return interactive.button_reply.id;
  }
  return undefined;
}
```

---

## 📊 MIGRATION PLAN

### Step 1: Create New Structure (Week 1)
- [ ] Create `wa-webhook-ai-agents/core/` directory
- [ ] Implement `UnifiedOrchestrator`
- [ ] Implement `AgentRegistry`
- [ ] Implement `GeminiProvider`
- [ ] Implement `BaseAgent`
- [ ] Create database migration for unified tables

### Step 2: Migrate Agents (Week 2)
- [ ] Migrate WaiterAgent to new structure
- [ ] Migrate FarmerAgent to new structure
- [ ] Migrate SupportAgent to new structure
- [ ] Create JobsAgent (currently separate service)
- [ ] Create PropertyAgent (currently separate service)
- [ ] Create MarketplaceAgent (currently separate service)

### Step 3: Update Routing (Week 2)
- [ ] Update route-config.ts to point ALL AI agents to wa-webhook-ai-agents
- [ ] Remove separate wa-webhook-jobs, wa-webhook-property, wa-webhook-marketplace
- [ ] Test menu routing with unified system

### Step 4: Deploy & Test (Week 3)
- [ ] Deploy unified wa-webhook-ai-agents
- [ ] Run comprehensive tests
- [ ] Monitor for 48 hours
- [ ] Fix issues
- [ ] Gradual rollout (10% → 50% → 100%)

### Step 5: Cleanup (Week 4)
- [ ] Remove old orchestrator files
- [ ] Remove duplicate agent code
- [ ] Archive old services
- [ ] Update documentation

---

## ✅ BENEFITS OF UNIFIED APPROACH

### Before (Current - Fragmented)
❌ 4 different orchestrators
❌ Multiple AI providers
❌ Duplicate agent code
❌ Inconsistent session management
❌ Hard to add new agents
❌ Difficult to test
❌ Higher cold start times (multiple functions)

### After (Unified)
✅ **ONE orchestrator** - single source of truth
✅ **ONE AI provider** - consistent responses
✅ **ONE agent registry** - easy to add agents
✅ **ONE session manager** - unified context
✅ **ONE deployment** - faster cold starts
✅ **Easier testing** - all agents in one place
✅ **Better observability** - unified logging

---

## 📋 IMMEDIATE NEXT STEPS

**Priority 1 (This Week):**
1. Create unified orchestrator structure
2. Implement base agent interface
3. Migrate WaiterAgent as proof of concept
4. Test end-to-end flow

**Priority 2 (Next Week):**
1. Migrate all other agents
2. Update routing configuration
3. Deploy to staging
4. Run comprehensive tests

**Priority 3 (Following Week):**
1. Deploy to production (gradual rollout)
2. Monitor metrics
3. Clean up old code
4. Update documentation

---

## 🎯 SUCCESS METRICS

| Metric | Current | Target |
|--------|---------|--------|
| Agent count | 6+ scattered | 6 unified |
| Orchestrators | 4 different | 1 unified |
| Cold start time | ~2s average | <1.5s |
| Code duplication | High | None |
| Test coverage | <20% | >80% |
| Time to add new agent | 2-3 days | 2-3 hours |

---

## ✅ RECOMMENDATION

**YES, PROCEED WITH UNIFIED ARCHITECTURE**

The unified approach is objectively better:
- Simpler to maintain
- Easier to test
- Faster to extend
- More consistent behavior
- Better observability
- Lower operational complexity

**Start with Phase 1-2 this week!**

