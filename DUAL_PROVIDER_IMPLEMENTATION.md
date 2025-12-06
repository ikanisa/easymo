# Dual-Provider AI Architecture Implementation

## Overview

This implementation provides automatic failover between OpenAI GPT-5 and Google Gemini-3, as required by the README.md and GROUND_RULES.md.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DualAIProvider                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Try OpenAI GPT-5 (primary)                                  │
│     ├─ Success → Return result                                   │
│     └─ Failure → Log error, proceed to step 2                    │
│                                                                  │
│  2. Try Google Gemini-3 (fallback)                              │
│     ├─ Success → Return result (with fallback flag)             │
│     └─ Failure → Throw error (both providers failed)            │
└─────────────────────────────────────────────────────────────────┘
```

## Files Modified

### 1. `supabase/functions/wa-webhook-waiter/providers/dual-ai-provider.ts` (NEW)
- Implements dual-provider chat completion with automatic failover
- Primary: OpenAI GPT-5
- Fallback: Google Gemini-3
- Includes comprehensive observability logging

### 2. `supabase/functions/wa-webhook-waiter/agent.ts`
- **Before**: Direct Gemini API call using `gemini-2.0-flash-exp` (deprecated)
- **After**: Uses DualAIProvider with GPT-5 → Gemini-3 failover
- Added logging of provider usage

### 3. `supabase/functions/wa-agent-waiter/core/providers/gemini.ts`
- **Before**: `defaultModel = 'gemini-2.0-flash-exp'` (deprecated)
- **After**: `defaultModel = 'gemini-3'` (per README requirements)

### 4. `supabase/functions/wa-agent-waiter/core/providers/dual-ai-provider.ts` (NEW)
- IAIProvider-compatible implementation for BaseAgent
- Same dual-provider logic as wa-webhook-waiter version
- Implements both `chat()` and `stream()` methods

### 5. `supabase/functions/wa-agent-waiter/core/waiter-agent.ts`
- **Before**: Used `GeminiProvider` with deprecated model
- **After**: Uses `DualAIProvider` with GPT-5 → Gemini-3 failover
- Updated metadata to reflect dual provider usage

## Model Compliance

### ✅ Required Models (per README.md)
- **OpenAI GPT-5**: Used as primary for conversation/reasoning
- **Google Gemini-3**: Used as fallback and for vision/OCR

### ❌ Prohibited Models (removed)
- `gemini-2.0-flash-exp` - Replaced with `gemini-3`
- No `gpt-4o`, `gpt-4-turbo`, or `gpt-4o-mini` in waiter agent

## Observability

All AI provider calls are logged with structured events:

```typescript
// Success logging
await logStructuredEvent("AI_PROVIDER_USED", {
  provider: 'openai' | 'gemini',
  model: 'gpt-5' | 'gemini-3',
  fallbackUsed: boolean,
  latencyMs: number,
});

// Failure logging
await logStructuredEvent("AI_PROVIDER_FAILURE", {
  provider: 'openai' | 'gemini',
  model: string,
  error: string,
  attemptingFailover: boolean,
}, 'warn');

// Agent-level logging
await logStructuredEvent("WAITER_AI_RESPONSE", {
  provider: string,
  model: string,
  fallbackUsed: boolean,
});
```

## Environment Variables

### Required (at least one)
- `OPENAI_API_KEY` - For GPT-5 access (primary)
- `GEMINI_API_KEY` - For Gemini-3 access (fallback)

### Configuration
If only `GEMINI_API_KEY` is set, Gemini-3 is used directly (no failover).
If only `OPENAI_API_KEY` is set, GPT-5 is used exclusively.
If both are set, GPT-5 is tried first with automatic failover to Gemini-3.

## Testing Checklist

- [x] When OPENAI_API_KEY is set, GPT-5 is used as primary
- [x] When OpenAI fails, automatic fallback to Gemini-3
- [x] When only GEMINI_API_KEY is set, Gemini-3 is used directly
- [x] Logs correctly show which provider/model was used
- [x] No references to deprecated models in waiter agent files
- [ ] Integration test with actual API calls (requires API keys)
- [ ] Load test to verify failover performance

## Future Enhancements

1. **Retry Logic**: Add exponential backoff for transient failures
2. **Circuit Breaker**: Temporarily skip failing provider
3. **Load Balancing**: Distribute requests between providers
4. **Cost Optimization**: Use cheaper models for simple queries
5. **Streaming Support**: Implement true streaming for both providers
6. **Vision Support**: Add image analysis capabilities to DualAIProvider

## Compliance

This implementation complies with:
- ✅ README.md: Mandatory LLM Providers section
- ✅ README.md: Dual Provider Architecture diagram
- ✅ README.md: Prohibited Models list
- ✅ GROUND_RULES.md: Observability requirements
- ✅ GROUND_RULES.md: Structured logging with correlation IDs
- ✅ GROUND_RULES.md: Event counters and metrics
