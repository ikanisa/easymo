# AI Providers - Quick Start Guide

## 🚀 30-Second Setup

```bash
# 1. Install dependencies
cd packages/ai && pnpm add @google/generative-ai@^0.21.0

# 2. Add to .env
echo "GEMINI_API_KEY=your-key-here" >> .env

# 3. Use in code
import { UnifiedAIProvider } from '@easymo/ai/core';

const ai = new UnifiedAIProvider({
  openai: { apiKey: process.env.OPENAI_API_KEY },
  gemini: { apiKey: process.env.GEMINI_API_KEY },
  costOptimizationEnabled: true,
});

const response = await ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## 💰 When to Use What

| Scenario | Use | Cost | Latency |
|----------|-----|------|---------|
| Simple Q&A | `GeminiFastResponse` | $0.000075/1K | ~200ms |
| Auto-complete | `GeminiFastResponse.autocomplete()` | $0.000075/1K | ~200ms |
| Complex reasoning | `UnifiedAIProvider` (auto-routes to GPT-4o) | $0.0025/1K | ~2s |
| Vision/OCR | `UnifiedAIProvider` (auto-routes to Gemini) | $0.00025/1K | ~1s |
| Tool calling | `UnifiedAIProvider` with tools | Variable | ~2s |

## 📝 Common Patterns

### 1. Simple Query (Cheapest)
```typescript
import { getFastResponse } from '@easymo/ai/core';

const fast = getFastResponse();
const answer = await fast.instant("What's 2+2?");
```

### 2. Auto-Complete
```typescript
const suggestion = await fast.autocomplete("I need to find a");
// → "pharmacy near me"
```

### 3. Classification
```typescript
const urgency = await fast.classify(
  "My car broke down!",
  ['urgent', 'normal', 'low']
);
// → "urgent"
```

### 4. Complex Agent Conversation
```typescript
import { UnifiedAIProvider } from '@easymo/ai/core';

const response = await ai.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Find pharmacies near Kigali' },
  ],
  tools: [googlePlacesTool],
  toolChoice: 'auto',
});
```

### 5. Extract Structured Data
```typescript
const order = await fast.extractJSON(
  "I want 2 pizzas and 3 sodas",
  { items: "array of {name, quantity}" }
);
// → { items: [{ name: "pizza", quantity: 2 }, { name: "soda", quantity: 3 }] }
```

## 🎯 Cost Optimization Tips

1. **Use Fast Response for:**
   - Auto-suggestions
   - Quick lookups
   - Simple classifications
   - Sentiment analysis

2. **Use Unified Provider (auto-routing) for:**
   - Complex reasoning
   - Tool calling
   - Multi-turn conversations

3. **Avoid:**
   - Using GPT-4o for simple tasks
   - Making multiple calls when one batch call works
   - Not caching frequent queries

## ⚡ Performance Best Practices

```typescript
// ❌ Bad: Multiple sequential calls
const q1 = await ai.chat({ messages: [msg1] });
const q2 = await ai.chat({ messages: [msg2] });

// ✅ Good: Batch processing
const results = await fast.batch([msg1, msg2]);

// ✅ Better: Use fast path for simple queries
const result = await fast.instant(simpleQuestion);
```

## 🔧 Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...

# Optional (defaults shown)
AI_PRIMARY_PROVIDER=openai
AI_COST_OPTIMIZATION=true
AI_FALLBACK_ENABLED=true
```

## 🐛 Troubleshooting

### "Fast response not initialized"
```typescript
// Initialize first
import { initializeFastResponse } from '@easymo/ai/core';
initializeFastResponse({ apiKey: process.env.GEMINI_API_KEY });
```

### Fallback not working
```typescript
// Check circuit breaker state
const health = await ai.healthCheck();
console.log(health); // { openai: true, gemini: false }
```

### High costs
```typescript
// Enable metrics to track
ai.on('metrics', (metrics) => {
  console.log(`Provider: ${metrics.provider}, Cost: $${metrics.costUsd}`);
});
```

## 📊 Monitoring

```typescript
// Track provider distribution
ai.on('metrics', (metrics) => {
  if (metrics.fallbackUsed) {
    console.warn('Fallback triggered:', metrics);
  }
  
  // Log to observability platform
  logStructuredEvent('ai_request', {
    provider: metrics.provider,
    cost_usd: metrics.costUsd,
    latency_ms: metrics.latencyMs,
    success: metrics.success,
  });
});
```

## 🚨 Error Handling

```typescript
try {
  const response = await ai.chat({ messages });
} catch (error) {
  if (error.message.includes('Circuit breaker OPEN')) {
    // All providers down - use fallback logic
    return await manualFallback(messages);
  }
  throw error;
}
```

## 📚 More Info

- Full Documentation: `docs/AI_PROVIDER_ROADMAP.md`
- Integration Guide: `docs/AI_NEXT_STEPS.md`
- Implementation Summary: `IMPLEMENTATION_SUMMARY_AI_PROVIDERS.md`

---

**Quick Links:**
- [Unified Provider](packages/ai/src/core/unified-provider.ts)
- [Fast Response](packages/ai/src/core/fast-response.ts)
- [Examples](packages/ai/examples/)
