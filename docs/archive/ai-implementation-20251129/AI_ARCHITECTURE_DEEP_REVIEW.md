# EasyMO AI Agents Architecture - Deep Review & Improvement Recommendations

**Audit Date:** 2025-11-28  
**Repository:** ikanisa/easymo  
**Focus:** AI Agent Architecture, SDK Implementation, API Integrations  
**Audited By:** AI Architecture Team

---

## 📋 Executive Summary

The current AI agent implementation in EasyMO is **foundational but significantly underdeveloped** for production use. The codebase has basic agent definition management and a simple chat completions interface, but lacks critical modern AI capabilities.

### Overall AI Readiness Score: **3/10** - Needs significant architectural overhaul

| Capability | Current Status | Required for Production |
|-----------|---------------|------------------------|
| OpenAI Chat API | ⚠️ Basic Implementation | ✅ Required |
| OpenAI Agents SDK | ❌ Not Implemented | ✅ Required |
| Google Gemini API | ❌ Not Implemented | ✅ Required |
| Google ADK (Agent Development Kit) | ❌ Not Implemented | ✅ Required |
| Gemini Live API (Voice) | ❌ Not Implemented | ✅ Required |
| OpenAI Realtime API | ❌ Not Implemented | ✅ Required |
| Google Maps/Places API | ❌ Not Implemented | ✅ Required |
| Google Search Grounding | ❌ Not Implemented | ✅ Required |
| Image Generation (Imagen) | ❌ Not Implemented | ⚠️ Recommended |
| Gemini 2.5 Flash-Lite | ❌ Not Implemented | ✅ Required |
| Multi-Provider Fallback | ❌ Not Implemented | ✅ Required |
| Tool/Function Registry | ❌ Not Implemented | ✅ Required |
| Session Management | ❌ Not Implemented | ✅ Required |

---

## 🏗️ SECTION 1: CURRENT ARCHITECTURE ANALYSIS

### 1.1 Agent Service Layer (`lib/agents/agents-service.ts`)

**✅ What's Implemented:**
- Agent CRUD operations (Create, Read, Update)
- Version management with deployment tracking
- Supabase integration for persistence
- Document association with agents

**🔴 Critical Gaps:**

#### Gap #1: No AI Provider Integration
```typescript
// Current: Only database operations, no AI runtime
export type AgentDefinition = {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  config: Record<string, unknown>; // ❌ Too generic
  // ❌ No OpenAI client
  // ❌ No Gemini client
  // ❌ No model inference logic
}
```

**Impact:** Agents are stored but never executed with AI models.

#### Gap #2: No Tool/Function Definition System
```typescript
// Current
config: Record<string, unknown>; // ❌ Untyped configuration

// Needed
tools: {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}[];
```

**Impact:** Cannot leverage function calling, which is essential for agents that need to interact with external systems (database queries, API calls, etc.).

#### Gap #3: No Agent Runtime/Execution Engine
- Only stores agent definitions
- No actual agent execution logic
- No conversation state management
- No streaming support

**Impact:** Agents exist as static data with no intelligence.

---

### 1.2 Chat Completions (`lib/ai/chat-completions.ts`)

**Status:** ⚠️ Types only, basic implementation in API route

**✅ What Exists:**
```typescript
// Good type definitions
export interface ChatCompletionRequestOptions {
  model?: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  tools?: ChatCompletionTool[];
  // ... other parameters
}
```

**API Implementation** (`app/api/openai/chat/route.ts`):
- ✅ Direct OpenAI API proxy
- ✅ Request validation
- ✅ Error handling
- ❌ No streaming support
- ❌ No response caching
- ❌ No rate limiting
- ❌ No fallback to other providers

**🔴 Critical Issues:**

#### Issue #1: Missing Modern OpenAI Features
```typescript
// Missing:
// - Structured outputs with JSON schema
// - Reasoning field for o1/o3 models
// - Predicted outputs
// - Stored completions
// - Audio input/output
```

#### Issue #2: No Multi-Provider Support
```typescript
// Current: OpenAI only
const openaiResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, ...);

// Needed: Provider abstraction
interface AIProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  stream(request: ChatRequest): AsyncIterator<ChatChunk>;
}
```

#### Issue #3: No Agent Execution Context
- Chat endpoint is standalone
- Not connected to agent definitions
- No knowledge retrieval
- No tool execution

---

### 1.3 Fallback System (`lib/agents/fallback-system.ts`)

**✅ Good Foundation:**
```typescript
export enum FallbackErrorType {
  SUPABASE_UNAVAILABLE = "supabase_unavailable",
  QUERY_FAILED = "query_failed",
  NETWORK_ERROR = "network_error",
  AUTH_ERROR = "auth_error",
  TIMEOUT = "timeout",
}
```

- Error classification system
- Graceful degradation patterns
- Scoring and ranking algorithms

**⚠️ Missing AI-Specific Fallbacks:**
```typescript
// Needed additions:
enum AIFallbackType {
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  MODEL_UNAVAILABLE = "model_unavailable",
  CONTEXT_LENGTH_EXCEEDED = "context_length_exceeded",
  PROVIDER_ERROR = "provider_error",
}

// Provider fallback chain:
// GPT-4 → GPT-4o-mini → Gemini Pro → Gemini Flash → Error
```

---

### 1.4 Domain-Specific Agent Services

The codebase has **9 domain services** that should be AI-powered but are currently pure CRUD:

| Service File | Purpose | AI Integration | Priority |
|-------------|---------|----------------|----------|
| `driver-requests-service.ts` | Driver request handling | ❌ No AI | 🔴 High |
| `pharmacy-service.ts` | Pharmacy operations | ❌ No AI | 🟡 Medium |
| `property-rentals-service.ts` | Property listings | ❌ No AI | 🟡 Medium |
| `quincaillerie-service.ts` | Hardware store | ❌ No AI | 🟢 Low |
| `schedule-trips-service.ts` | Trip scheduling | ❌ No AI | 🔴 High |
| `shops-service.ts` | Shop management | ❌ No AI | 🟡 Medium |

**Example - Driver Requests (Current):**
```typescript
// Just returns static fallback data
export async function listDriverRequests(): Promise<DriverRequestsResponse> {
  return createFallbackResponse(
    FALLBACK_DRIVER_REQUESTS,
    "driver_requests",
    "Database unavailable. Showing sample data.",
    "Check Supabase connection"
  );
}
```

**Example - Driver Requests (Needed):**
```typescript
export async function listDriverRequests(
  context: AgentContext
): Promise<DriverRequestsResponse> {
  // 1. Retrieve from database
  const requests = await db.query(...);
  
  // 2. Use AI to rank/filter based on context
  const ranked = await agent.rank(requests, {
    userLocation: context.location,
    preferences: context.userPreferences,
    urgency: calculateUrgency(requests)
  });
  
  // 3. Generate natural language summaries
  const enriched = await agent.summarize(ranked);
  
  return enriched;
}
```

---

## 🎯 SECTION 2: RECOMMENDED ARCHITECTURE

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  AI AGENT ORCHESTRATION LAYER                    │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   OpenAI     │  │   Google     │  │   Multi-Provider     │  │
│  │ Agents SDK   │  │     ADK      │  │   Router/Fallback    │  │
│  │              │  │              │  │                      │  │
│  │ - GPT-4o     │  │ - Gemini Pro │  │ - Rate limiting      │  │
│  │ - o1/o3      │  │ - Flash-Lite │  │ - Cost optimization  │  │
│  │ - Realtime   │  │ - Live API   │  │ - Health checks      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │
│  │                    TOOL REGISTRY                          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │  │
│  │  │ Google  │ │ Google  │ │ Supabase│ │ Domain-Specific │ │  │
│  │  │  Maps   │ │ Search  │ │   DB    │ │     Tools       │ │  │
│  │  │         │ │         │ │         │ │                 │ │  │
│  │  │ Places  │ │ Ground- │ │ Vector  │ │ - Mobility      │ │  │
│  │  │ Direct. │ │ ing API │ │ Search  │ │ - Marketplace   │ │  │
│  │  │ Matrix  │ │         │ │         │ │ - Scheduling    │ │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  REALTIME LAYER                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  OpenAI    │  │  Gemini     │  │   WebSocket     │   │  │
│  │  │  Realtime  │  │  Live API   │  │   Manager       │   │  │
│  │  │  (Voice)   │  │  (Voice)    │  │                 │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                SESSION MANAGEMENT                         │  │
│  │  - Conversation history                                   │  │
│  │  - Context window optimization                            │  │
│  │  - State persistence (Redis)                              │  │
│  │  - Agent memory                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Details

#### **Multi-Provider Router**
Intelligently routes requests based on:
- **Cost:** Gemini Flash (cheaper) vs GPT-4 (expensive)
- **Latency:** Flash-Lite for real-time, o1 for complex reasoning
- **Capabilities:** Image gen → Imagen, Voice → Gemini Live
- **Availability:** Auto-fallback on errors/rate limits

#### **Tool Registry**
Centralized function definitions:
```typescript
const MOBILITY_TOOLS = [
  {
    name: "find_nearby_drivers",
    description: "Find available drivers near a location",
    parameters: {
      type: "object",
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        radius_km: { type: "number", default: 5 }
      },
      required: ["lat", "lng"]
    },
    handler: findNearbyDrivers
  }
];
```

---

## 📦 SECTION 3: IMPLEMENTATION PLAN

### Phase 1: Core Infrastructure (Week 1)

**Goal:** Set up AI provider clients and basic routing

#### 1.1 Install Required Packages
```bash
cd admin-app
npm install \
  @google/generative-ai@^0.21.0 \
  @googlemaps/google-maps-services-js@^3.4.0 \
  p-retry@^6.2.0 \
  p-queue@^8.0.1 \
  zod@^3.25.0 \
  ws@^8.18.0
```

**Note:** OpenAI `^4.104.0` already installed ✅

#### 1.2 Create Provider Clients

**File:** `admin-app/lib/ai/providers/openai-client.ts`
```typescript
import OpenAI from 'openai';

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  cachedClient = new OpenAI({
    apiKey,
    organization: process.env.OPENAI_ORG_ID,
    maxRetries: 3,
    timeout: 60_000,
  });
  
  return cachedClient;
}
```

**File:** `admin-app/lib/ai/providers/gemini-client.ts`
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

let cachedClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;
  
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }
  
  cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
}

export const GEMINI_MODELS = {
  FLASH_LITE: 'gemini-2.5-flash-lite',
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro',
} as const;
```

#### 1.3 Multi-Provider Router

**File:** `admin-app/lib/ai/router.ts`
```typescript
import pRetry from 'p-retry';
import { getOpenAIClient } from './providers/openai-client';
import { getGeminiClient, GEMINI_MODELS } from './providers/gemini-client';

type Provider = 'openai' | 'gemini';

interface RouteRequest {
  messages: Array<{ role: string; content: string }>;
  preferredProvider?: Provider;
  maxCost?: 'low' | 'medium' | 'high';
  requiresVision?: boolean;
  requiresTools?: boolean;
}

export async function routeChatRequest(request: RouteRequest) {
  const provider = selectProvider(request);
  
  return pRetry(
    async () => {
      if (provider === 'openai') {
        return executeOpenAI(request);
      } else {
        return executeGemini(request);
      }
    },
    {
      retries: 2,
      onFailedAttempt: async (error) => {
        console.warn(`Provider ${provider} failed, attempting fallback`);
        // Fallback to alternative provider
        if (provider === 'openai') {
          return executeGemini(request);
        } else {
          return executeOpenAI(request);
        }
      }
    }
  );
}

function selectProvider(request: RouteRequest): Provider {
  if (request.preferredProvider) {
    return request.preferredProvider;
  }
  
  // Cost-based routing
  if (request.maxCost === 'low') {
    return 'gemini'; // Flash-Lite is cheaper
  }
  
  // Default to OpenAI for compatibility
  return 'openai';
}

async function executeOpenAI(request: RouteRequest) {
  const client = getOpenAIClient();
  return client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: request.messages,
  });
}

async function executeGemini(request: RouteRequest) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ 
    model: GEMINI_MODELS.FLASH_LITE 
  });
  
  // Convert OpenAI format to Gemini format
  const geminiMessages = request.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
  
  const chat = model.startChat({ history: geminiMessages.slice(0, -1) });
  const result = await chat.sendMessage(
    geminiMessages[geminiMessages.length - 1].parts[0].text
  );
  
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: result.response.text()
      }
    }]
  };
}
```

#### 1.4 Health Checks

**File:** `admin-app/app/api/ai/health/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/ai/providers/openai-client';
import { getGeminiClient } from '@/lib/ai/providers/gemini-client';

export async function GET() {
  const health = {
    openai: 'unknown',
    gemini: 'unknown',
    timestamp: new Date().toISOString()
  };
  
  // Test OpenAI
  try {
    const client = getOpenAIClient();
    await client.models.list({ limit: 1 });
    health.openai = 'healthy';
  } catch (error) {
    health.openai = 'unhealthy';
  }
  
  // Test Gemini
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    await model.generateContent('test');
    health.gemini = 'healthy';
  } catch (error) {
    health.gemini = 'unhealthy';
  }
  
  const status = health.openai === 'healthy' || health.gemini === 'healthy' 
    ? 200 
    : 503;
  
  return NextResponse.json(health, { status });
}
```

---

### Phase 2: Google Integrations (Week 2)

#### 2.1 Google Maps Integration

**File:** `admin-app/lib/integrations/google-maps.ts`
```typescript
import { Client, TravelMode } from '@googlemaps/google-maps-services-js';

const client = new Client({});
const API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function findNearbyPlaces(params: {
  lat: number;
  lng: number;
  radius: number;
  type?: string;
}) {
  const response = await client.placesNearby({
    params: {
      location: { lat: params.lat, lng: params.lng },
      radius: params.radius,
      type: params.type,
      key: API_KEY
    }
  });
  
  return response.data.results;
}

export async function getDirections(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode?: TravelMode;
}) {
  const response = await client.directions({
    params: {
      origin: `${params.origin.lat},${params.origin.lng}`,
      destination: `${params.destination.lat},${params.destination.lng}`,
      mode: params.mode ?? TravelMode.driving,
      key: API_KEY
    }
  });
  
  return response.data.routes[0];
}

export async function calculateDistanceMatrix(params: {
  origins: Array<{ lat: number; lng: number }>;
  destinations: Array<{ lat: number; lng: number }>;
}) {
  const response = await client.distancematrix({
    params: {
      origins: params.origins.map(o => `${o.lat},${o.lng}`),
      destinations: params.destinations.map(d => `${d.lat},${d.lng}`),
      key: API_KEY
    }
  });
  
  return response.data;
}
```

#### 2.2 Google Search Grounding

**File:** `admin-app/lib/ai/google/search-grounding.ts`
```typescript
import { getGeminiClient } from '../providers/gemini-client';

export async function searchWithGrounding(query: string) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearchRetrieval: {} }]
  });
  
  const result = await model.generateContent(query);
  const response = result.response;
  
  return {
    text: response.text(),
    groundingMetadata: response.candidates?.[0]?.groundingMetadata,
    sources: response.candidates?.[0]?.groundingMetadata?.webSearchQueries
  };
}
```

#### 2.3 Gemini Live API (Voice)

**File:** `admin-app/lib/ai/google/gemini-live.ts`
```typescript
import { getGeminiClient } from '../providers/gemini-client';

export async function createLiveSession() {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // Configure for live audio
    generationConfig: {
      responseModalities: ['audio'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
      }
    }
  });
  
  return {
    id: crypto.randomUUID(),
    model,
    isActive: true
  };
}

export async function processAudioInput(
  session: { model: any },
  audioData: Uint8Array
) {
  const result = await session.model.generateContent({
    contents: [{
      role: 'user',
      parts: [{ inlineData: { mimeType: 'audio/wav', data: audioData } }]
    }]
  });
  
  return result.response;
}
```

---

### Phase 3: Tool Registry & Agent Execution (Week 3)

#### 3.1 Tool Registry

**File:** `admin-app/lib/ai/tools/registry.ts`
```typescript
import { z } from 'zod';
import { findNearbyPlaces, getDirections } from '@/lib/integrations/google-maps';

export const TOOL_SCHEMAS = {
  find_nearby_drivers: z.object({
    lat: z.number(),
    lng: z.number(),
    radius_km: z.number().default(5)
  }),
  
  get_directions: z.object({
    origin: z.object({ lat: z.number(), lng: z.number() }),
    destination: z.object({ lat: z.number(), lng: z.number() }),
    mode: z.enum(['driving', 'walking', 'bicycling', 'transit']).optional()
  }),
  
  search_marketplace: z.object({
    query: z.string(),
    category: z.string().optional(),
    max_results: z.number().default(10)
  })
};

export const TOOL_HANDLERS = {
  find_nearby_drivers: async (args: z.infer<typeof TOOL_SCHEMAS.find_nearby_drivers>) => {
    // Implementation
    return findNearbyPlaces({
      lat: args.lat,
      lng: args.lng,
      radius: args.radius_km * 1000,
      type: 'taxi_stand'
    });
  },
  
  get_directions: async (args: z.infer<typeof TOOL_SCHEMAS.get_directions>) => {
    return getDirections(args);
  }
};

export function getToolDefinitions() {
  return Object.entries(TOOL_SCHEMAS).map(([name, schema]) => ({
    type: 'function' as const,
    function: {
      name,
      description: TOOL_DESCRIPTIONS[name],
      parameters: zodToJsonSchema(schema)
    }
  }));
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  find_nearby_drivers: 'Find available drivers near a specific location',
  get_directions: 'Get turn-by-turn directions between two points',
  search_marketplace: 'Search the marketplace for products or services'
};

function zodToJsonSchema(schema: z.ZodType): any {
  // Convert Zod schema to JSON Schema
  // Use zod-to-json-schema package or implement manually
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(schema._def.shape()).map(([key, val]) => [
        key,
        { type: typeof val === 'number' ? 'number' : 'string' }
      ])
    )
  };
}
```

#### 3.2 Agent Executor

**File:** `admin-app/lib/ai/agent-executor.ts`
```typescript
import { getOpenAIClient } from './providers/openai-client';
import { getToolDefinitions, TOOL_HANDLERS } from './tools/registry';
import type { AgentDefinition } from '@/lib/agents/agents-service';

export async function executeAgent(
  agent: AgentDefinition,
  userMessage: string,
  context?: { userId?: string; location?: { lat: number; lng: number } }
) {
  const client = getOpenAIClient();
  const tools = getToolDefinitions();
  
  const messages = [
    {
      role: 'system' as const,
      content: agent.description || 'You are a helpful assistant.'
    },
    {
      role: 'user' as const,
      content: userMessage
    }
  ];
  
  let response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools,
    tool_choice: 'auto'
  });
  
  // Handle tool calls
  while (response.choices[0].finish_reason === 'tool_calls') {
    const toolCalls = response.choices[0].message.tool_calls!;
    
    for (const toolCall of toolCalls) {
      const handler = TOOL_HANDLERS[toolCall.function.name as keyof typeof TOOL_HANDLERS];
      const args = JSON.parse(toolCall.function.arguments);
      const result = await handler(args);
      
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [toolCall]
      } as any);
      
      messages.push({
        role: 'tool' as const,
        content: JSON.stringify(result),
        tool_call_id: toolCall.id
      });
    }
    
    // Continue conversation with tool results
    response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto'
    });
  }
  
  return {
    message: response.choices[0].message.content,
    toolCalls: messages.filter(m => m.role === 'tool').length,
    usage: response.usage
  };
}
```

---

### Phase 4: Enhanced Chat API (Week 4)

**File:** `admin-app/app/api/ai/chat/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { routeChatRequest } from '@/lib/ai/router';
import { executeAgent } from '@/lib/ai/agent-executor';
import { getAgent } from '@/lib/agents/agents-service';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { messages, agentId, provider, stream } = body;
  
  try {
    // If agentId provided, use agent executor
    if (agentId) {
      const agentResult = await getAgent(agentId);
      if (!agentResult.ok) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }
      
      const agent = (agentResult.data as any).agent;
      const lastMessage = messages[messages.length - 1].content;
      
      const result = await executeAgent(agent, lastMessage);
      
      return NextResponse.json({
        id: crypto.randomUUID(),
        choices: [{
          message: {
            role: 'assistant',
            content: result.message
          },
          finish_reason: 'stop'
        }],
        usage: result.usage
      });
    }
    
    // Otherwise use multi-provider router
    const result = await routeChatRequest({
      messages,
      preferredProvider: provider
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'AI request failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
```

---

### Phase 5: UI Components (Week 5)

#### 5.1 Enhanced Agent Creator

**File:** `admin-app/components/agents/AgentCreator.tsx` (enhance existing)

Add tool configuration UI:
```typescript
// Add to existing component
const [selectedTools, setSelectedTools] = useState<string[]>([]);

// In form
<Field label="Tools" htmlFor="tools">
  <div className="space-y-2">
    {AVAILABLE_TOOLS.map(tool => (
      <label key={tool.name} className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selectedTools.includes(tool.name)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedTools([...selectedTools, tool.name]);
            } else {
              setSelectedTools(selectedTools.filter(t => t !== tool.name));
            }
          }}
        />
        <span>{tool.label}</span>
      </label>
    ))}
  </div>
</Field>
```

#### 5.2 Chat Playground with Agent Selection

**File:** `admin-app/components/ai/ChatPlayground.tsx`
```typescript
"use client";

import { useState } from 'react';
import { useAgentsList } from '@/lib/queries/agents';

export function ChatPlayground() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{role: string; content: string}>>([]);
  const [input, setInput] = useState('');
  
  const { data: agentsData } = useAgentsList();
  const agents = agentsData?.agents ?? [];
  
  const handleSend = async () => {
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...messages, userMessage],
        agentId: selectedAgent
      })
    });
    
    const result = await response.json();
    const assistantMessage = {
      role: 'assistant',
      content: result.choices[0].message.content
    };
    
    setMessages(prev => [...prev, assistantMessage]);
  };
  
  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b">
        <select
          value={selectedAgent ?? ''}
          onChange={(e) => setSelectedAgent(e.target.value || null)}
          className="w-full p-2 border rounded"
        >
          <option value="">No Agent (Direct Chat)</option>
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded ${
              msg.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
            } max-w-[80%]`}
          >
            {msg.content}
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 p-2 border rounded"
          placeholder="Type a message..."
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

---

## 🗂️ SECTION 4: UPDATED FILE STRUCTURE

```
admin-app/
├── lib/
│   ├── ai/
│   │   ├── index.ts                    # Main exports
│   │   ├── router.ts                   # ✨ NEW: Multi-provider router
│   │   ├── agent-executor.ts           # ✨ NEW: Agent execution engine
│   │   ├── chat-completions.ts         # Existing (keep)
│   │   │
│   │   ├── providers/
│   │   │   ├── openai-client.ts        # ✨ NEW
│   │   │   └── gemini-client.ts        # ✨ NEW
│   │   │
│   │   ├── tools/
│   │   │   ├── registry.ts             # ✨ NEW: Tool definitions
│   │   │   └── handlers.ts             # ✨ NEW: Tool implementations
│   │   │
│   │   └── google/
│   │       ├── search-grounding.ts     # ✨ NEW
│   │       └── gemini-live.ts          # ✨ NEW
│   │
│   ├── integrations/
│   │   ├── google-maps.ts              # ✨ NEW
│   │   └── index.ts
│   │
│   └── agents/
│       ├── agents-service.ts           # Existing (enhance)
│       ├── fallback-system.ts          # Existing (enhance)
│       └── domain/
│           ├── mobility-agent.ts       # ✨ NEW
│           └── marketplace-agent.ts    # ✨ NEW
│
├── components/
│   ├── ai/
│   │   ├── ChatPlayground.tsx          # ✨ NEW
│   │   └── AgentToolConfig.tsx         # ✨ NEW
│   │
│   └── agents/
│       └── AgentCreator.tsx            # Existing (enhance)
│
└── app/
    └── api/
        └── ai/
            ├── chat/route.ts           # ✨ NEW (enhanced)
            ├── health/route.ts         # ✨ NEW
            └── agents/
                └── [id]/
                    └── execute/route.ts # ✨ NEW
```

---

## 🔐 SECTION 5: ENVIRONMENT VARIABLES

Add to `.env.local`:

```bash
# OpenAI (already configured)
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# Google AI
GOOGLE_AI_API_KEY=AIza...
GOOGLE_CLOUD_PROJECT=easymo-prod

# Google Maps
GOOGLE_MAPS_API_KEY=AIza...

# Feature Flags
ENABLE_GEMINI=true
ENABLE_GOOGLE_MAPS=true
ENABLE_SEARCH_GROUNDING=true
```

**Security Note:** Never expose these in `NEXT_PUBLIC_*` variables. ✅ Already enforced by prebuild checks.

---

## ✅ SECTION 6: IMPLEMENTATION CHECKLIST

### Phase 1: Core Infrastructure (Week 1)
- [ ] Install required packages (`@google/generative-ai`, `@googlemaps/google-maps-services-js`, etc.)
- [ ] Create `lib/ai/providers/openai-client.ts`
- [ ] Create `lib/ai/providers/gemini-client.ts`
- [ ] Create `lib/ai/router.ts` (multi-provider routing)
- [ ] Create `app/api/ai/health/route.ts`
- [ ] Add environment variables
- [ ] Test health endpoint

### Phase 2: Google Integrations (Week 2)
- [ ] Create `lib/integrations/google-maps.ts`
- [ ] Implement Places API integration
- [ ] Implement Directions API integration
- [ ] Implement Distance Matrix API
- [ ] Create `lib/ai/google/search-grounding.ts`
- [ ] Create `lib/ai/google/gemini-live.ts`
- [ ] Test all Google APIs

### Phase 3: Tool Registry & Agent Execution (Week 3)
- [ ] Create `lib/ai/tools/registry.ts`
- [ ] Define tool schemas with Zod
- [ ] Implement tool handlers
- [ ] Create `lib/ai/agent-executor.ts`
- [ ] Enhance `lib/agents/agents-service.ts` with tool support
- [ ] Test agent execution with tools

### Phase 4: Enhanced Chat API (Week 4)
- [ ] Create `app/api/ai/chat/route.ts`
- [ ] Implement agent-aware chat
- [ ] Add streaming support
- [ ] Add session management
- [ ] Test with multiple agents

### Phase 5: UI Components (Week 5)
- [ ] Enhance `components/agents/AgentCreator.tsx` with tool selection
- [ ] Create `components/ai/ChatPlayground.tsx`
- [ ] Create `components/ai/AgentToolConfig.tsx`
- [ ] Add agent execution page
- [ ] Test full user workflow

---

## 📊 SECTION 7: SUCCESS METRICS

### Before Implementation
- ✅ Agent definitions: Stored only
- ✅ Chat API: Basic OpenAI proxy
- ❌ AI providers: OpenAI only
- ❌ Tools: None
- ❌ Agent execution: Not implemented

### After Implementation
- ✅ Agent definitions: Full lifecycle management
- ✅ Chat API: Multi-provider with routing
- ✅ AI providers: OpenAI + Gemini with fallback
- ✅ Tools: 10+ tools (Maps, Search, DB queries)
- ✅ Agent execution: Full runtime with tool calling
- ✅ Voice: Gemini Live API integration
- ✅ Search: Google Search grounding
- ✅ Images: Ready for Imagen integration

### Performance Targets
- **Latency:** < 2s for Flash-Lite responses
- **Cost:** 70% reduction by routing to Gemini for simple queries
- **Reliability:** 99.9% uptime with multi-provider fallback
- **Tool Success Rate:** > 95% for tool executions

---

## 🚀 SECTION 8: NEXT STEPS

### Immediate (This Week)
1. **Review this document** with engineering team
2. **Allocate resources:** 2 senior developers
3. **Set up Google Cloud Project** for AI APIs
4. **Obtain API keys** for OpenAI, Google AI, Google Maps

### Week 1 Actions
1. Install packages and create provider clients
2. Implement health checks
3. Test OpenAI and Gemini connectivity

### Future Enhancements (Beyond 5 weeks)
- [ ] OpenAI Realtime API for voice
- [ ] Image generation with Imagen
- [ ] Agent marketplace (public agent sharing)
- [ ] Advanced observability (trace all AI calls)
- [ ] Cost analytics dashboard
- [ ] A/B testing framework for model selection

---

## 📚 SECTION 9: REFERENCES

### Documentation
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Google AI (Gemini) Documentation](https://ai.google.dev/docs)
- [Google Maps Platform](https://developers.google.com/maps/documentation)
- [OpenAI Agents SDK](https://platform.openai.com/docs/assistants/overview)

### Code Examples
- OpenAI Function Calling: [Link](https://platform.openai.com/docs/guides/function-calling)
- Gemini Tools/Function Calling: [Link](https://ai.google.dev/gemini-api/docs/function-calling)
- Google Maps Services (Node.js): [Link](https://github.com/googlemaps/google-maps-services-js)

---

## 🎯 CONCLUSION

The EasyMO AI agents architecture requires a **comprehensive overhaul** to achieve production readiness. The current implementation (3/10 readiness) provides a foundation but lacks:

1. **AI Provider Integration** - No actual AI inference
2. **Multi-Provider Support** - Locked into OpenAI only
3. **Tool/Function Calling** - No external integrations
4. **Agent Execution Engine** - Agents are static data
5. **Google Integrations** - Critical for mobility (Maps, Search)

The proposed 5-week implementation plan will elevate the architecture to **production-ready (9/10)** with:
- ✅ Multi-provider routing (OpenAI + Gemini)
- ✅ Cost optimization (Flash-Lite for simple queries)
- ✅ Tool registry (Maps, Search, DB)
- ✅ Agent execution runtime
- ✅ Enhanced UI components

**Estimated Effort:** 5 weeks, 2-3 developers  
**Expected ROI:** 70% cost reduction, 10x capability increase

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-28  
**Next Review:** After Phase 1 completion
