/**
 * Implementation Priority Roadmap
 * 
 * Based on comprehensive AI ecosystem analysis
 * Focus: Cost optimization (60-70% savings) + Production readiness
 */

# AI Provider Integration Roadmap

## ✅ Phase 1: Core Integration (Week 1-2) - **STARTED**

### 1.1 Unified Provider Interface ✅
**File:** `packages/ai/src/core/unified-provider.ts`
**Status:** Implemented
**Features:**
- Automatic fallback (OpenAI ↔ Gemini)
- Cost-based routing (simple queries → Gemini Flash-Lite)
- Circuit breaker pattern
- Unified metrics & observability

**Integration:**
```typescript
import { UnifiedAIProvider } from '@easymo/ai/core/unified-provider';

const provider = new UnifiedAIProvider({
  openai: { apiKey: process.env.OPENAI_API_KEY },
  gemini: { apiKey: process.env.GEMINI_API_KEY },
  primaryProvider: 'openai',
  costOptimizationEnabled: true,
});

// Automatically routes to optimal provider
const response = await provider.chat({
  messages: [{ role: 'user', content: 'Find pharmacies near me' }],
});
```

### 1.2 Gemini Flash-Lite Fast Path ✅
**File:** `packages/ai/src/core/fast-response.ts`
**Status:** Implemented
**Cost:** $0.000075/1K tokens (75x cheaper than GPT-4o)
**Use Cases:**
- Auto-completes
- Simple Q&A
- Quick classifications
- Sentiment analysis

**Example:**
```typescript
import { GeminiFastResponse } from '@easymo/ai/core/fast-response';

const fast = new GeminiFastResponse({ apiKey: process.env.GEMINI_API_KEY });

// Instant response (~200ms)
const answer = await fast.instant("What's the capital of Rwanda?");

// Auto-complete
const suggestion = await fast.autocomplete("I need to find a");

// Classification
const urgency = await fast.classify(message, ['urgent', 'normal', 'low']);
```

### 1.3 Agent Service Migration ⏳
**Target:** `services/agent-core/src/modules/agents/agents.service.ts`
**Current:** Uses OpenAI Responses API with text concatenation
**Goal:** Migrate to UnifiedAIProvider with structured outputs

**Before:**
```typescript
const input = options.messages
  .map((message) => `[${message.role}] ${message.content}`)
  .join("\n");

const response = await this.client.responses.create({ model, metadata, input });
```

**After:**
```typescript
const response = await this.unifiedProvider.chat({
  messages: options.messages,
  tools: agentTools,
  responseFormat: { type: 'json_object' },
  metadata: options.metadata,
});
```

**Action Items:**
- [ ] Update `AgentsService` to use `UnifiedAIProvider`
- [ ] Add structured output schemas
- [ ] Migrate existing agents to new interface
- [ ] Add observability (correlation IDs, structured logs)

---

## 🎙️ Phase 2: Voice & Multimodal (Week 3-4)

### 2.1 WhatsApp Voice Integration
**Current:** OpenAI Realtime API exists (`packages/agents/src/capabilities/openai_realtime.ts`) but not connected
**Goal:** Enable voice note responses via WhatsApp

**Architecture:**
```
WhatsApp Voice Note → wa-webhook → OpenAI Realtime API → Voice Response
                                   ↓
                              Transcription stored in DB
```

**Action Items:**
- [ ] Connect `wa-webhook` to OpenAI Realtime client
- [ ] Add voice note detection in webhook handler
- [ ] Implement audio streaming (WhatsApp → OpenAI)
- [ ] Store transcriptions in `conversations` table
- [ ] Add voice response delivery

### 2.2 Gemini Live API Integration
**Status:** Partially implemented (`packages/ai/src/providers-gemini-live.ts`)
**Current:** Browser-based only (uses `window.AudioContext`)
**Goal:** Server-side voice conversations

**New File:** `packages/ai/src/core/gemini-voice.ts`
```typescript
export class GeminiVoiceService {
  async connectSession(config: {
    systemInstruction: string;
    voiceName: string;
    language: 'en' | 'rw' | 'fr';
  }): Promise<VoiceSession>;
  
  async sendAudio(session: VoiceSession, audioChunk: Buffer): Promise<void>;
  async disconnect(session: VoiceSession): Promise<void>;
}
```

**Action Items:**
- [ ] Create server-side Gemini Live client (no browser deps)
- [ ] Integrate with SIP trunks (Twilio)
- [ ] Add multi-language support (Kinyarwanda, English, French)
- [ ] Connect to agent orchestrator

### 2.3 Speech-to-Text / Text-to-Speech
**Provider:** OpenAI Whisper + TTS
**Location:** `packages/ai/src/core/speech.ts`

**Features:**
- Transcribe WhatsApp voice notes
- Generate voice responses
- Multi-language support

---

## 🖼️ Phase 3: Advanced Features (Week 5-6)

### 3.1 Google Imagen Integration
**Status:** Not implemented
**File:** `packages/ai/src/tools/imagen.ts`
**Cost:** $0.04/image

**Use Cases:**
- Product visualization for marketplace
- Property images for real estate
- Marketing materials

```typescript
export async function generateImage(prompt: string, config?: {
  aspectRatio?: '1:1' | '16:9' | '9:16';
  numberOfImages?: number;
}): Promise<string>;
```

**Action Items:**
- [ ] Add Google Cloud AI Platform SDK
- [ ] Implement `generateImage()` tool
- [ ] Add to agent tool registry
- [ ] Create storage integration (Supabase Storage)

### 3.2 Google Search Grounding
**Status:** Implemented in Gemini provider ✅
**Current:** Available via `googleSearch: {}` tool
**Enhancement:** Add to agent orchestrator

**Action Items:**
- [ ] Register as standard tool in agent registry
- [ ] Add caching for search results
- [ ] Implement rate limiting

### 3.3 OpenAI Assistants API Migration
**Goal:** Use official Agents SDK instead of raw API
**File:** `packages/ai/src/agents/openai-assistants.ts`

```typescript
export class OpenAIAssistantsService {
  async createAgent(config: AgentConfig): Promise<Assistant>;
  async runAgent(assistantId: string, thread: Thread, message: string): Promise<Run>;
}
```

**Benefits:**
- Built-in code interpreter
- File search capability
- Thread management
- Persistent memory

---

## 🏭 Phase 4: Production Hardening (Week 7-8)

### 4.1 Cost Tracking & Analytics
**File:** `packages/ai/src/observability/cost-tracker.ts`

**Metrics:**
- Cost per conversation
- Cost per agent type
- Provider breakdown
- Daily/monthly budgets

**Dashboard:**
- Integrate with Supabase Analytics
- Real-time cost alerts
- Budget threshold warnings

### 4.2 Provider Health Monitoring
**File:** `packages/ai/src/observability/health-monitor.ts`

**Features:**
- Continuous health checks
- Latency monitoring
- Error rate tracking
- Automatic provider rotation on degradation

### 4.3 Load Testing
**Goal:** Validate 100+ concurrent agent conversations
**Tools:** k6, Artillery

**Scenarios:**
- Simultaneous WhatsApp messages
- Concurrent voice sessions
- Tool execution under load
- Fallback behavior under failure

---

## 📊 Cost Optimization Strategy

| Use Case | Current Provider | Optimized Provider | Savings |
|----------|-----------------|-------------------|---------|
| Simple Q&A | GPT-4o ($0.0025) | Gemini Flash-Lite ($0.000075) | **97%** |
| Complex reasoning | GPT-4o | GPT-4o | 0% |
| Vision/OCR | GPT-4V ($0.01) | Gemini 2.0 Flash ($0.00025) | **97.5%** |
| Voice (realtime) | OpenAI ($0.06/min) | Gemini Live ($0.32/hr) | **20%** |
| Search grounding | OpenAI + Custom | Gemini (free) | **100%** |

**Estimated Total Savings:** 60-70% on AI costs

---

## 🚀 Quick Start

### Install Dependencies
```bash
pnpm add @google/generative-ai@^0.21.0 @google/genai@^1.0.0
pnpm --filter @easymo/ai install
pnpm --filter @easymo/ai build
```

### Environment Variables
```bash
# .env
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
GOOGLE_CLOUD_PROJECT=your-project
AI_PRIMARY_PROVIDER=openai
AI_COST_OPTIMIZATION=true
AI_FALLBACK_ENABLED=true
```

### Usage Example
```typescript
import { UnifiedAIProvider } from '@easymo/ai/core/unified-provider';
import { GeminiFastResponse } from '@easymo/ai/core/fast-response';

// For normal conversations
const provider = new UnifiedAIProvider({
  openai: { apiKey: process.env.OPENAI_API_KEY },
  gemini: { apiKey: process.env.GEMINI_API_KEY },
  costOptimizationEnabled: true,
});

// For quick responses
const fast = new GeminiFastResponse({ 
  apiKey: process.env.GEMINI_API_KEY 
});

// Automatic routing
const response = await provider.chat({
  messages: [{ role: 'user', content: userMessage }],
  tools: agentTools,
});
```

---

## 📝 Next Steps

1. **Review Implementation** (You)
   - Validate `unified-provider.ts`
   - Validate `fast-response.ts`
   - Provide feedback

2. **Integration** (Week 1)
   - Update `AgentsService` to use Unified Provider
   - Wire agent registry to runtime
   - Add observability hooks

3. **Testing** (Week 2)
   - Unit tests for unified provider
   - Integration tests for fallback
   - Cost tracking validation

4. **Deployment** (Week 3)
   - Staging deployment
   - A/B test cost savings
   - Monitor latency impact
   - Full production rollout

---

## 📚 Documentation

- **Architecture:** `docs/ai-provider-architecture.md`
- **Cost Analysis:** `docs/ai-cost-optimization.md`
- **API Reference:** `packages/ai/README.md`
- **Migration Guide:** `docs/ai-provider-migration.md`

---

## ❓ Questions & Decisions Needed

1. **Primary Provider:** Should we default to `openai` or `gemini`?
   - **Recommendation:** `openai` for reliability, fallback to `gemini` for cost
   
2. **Cost Optimization:** Enable by default?
   - **Recommendation:** Yes, with override per agent type
   
3. **Voice Priority:** OpenAI Realtime vs Gemini Live?
   - **Recommendation:** OpenAI for WhatsApp (better quality), Gemini for SIP calls (cheaper)

4. **Image Generation:** Should we add Imagen now or defer?
   - **Recommendation:** Defer to Phase 3 unless immediate business need

---

**Status:** Phase 1 foundation complete. Ready for integration testing.
