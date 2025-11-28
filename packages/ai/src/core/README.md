# AI Core - Unified Provider

## Status: Phase 1 Implementation

This directory contains the core AI provider abstraction layer.

### Files

- `unified-provider.ts` - Unified interface for OpenAI + Gemini
- `fast-response.ts` - Gemini Flash-Lite for cost optimization
- `index.ts` - Public exports

### Current Status

✅ **OpenAI Integration**: Fully functional
⚠️ **Gemini Integration**: Pending - needs @easymo/ai-core dependency resolution

### Note on Dependencies

The Gemini client integration requires `@easymo/ai-core` package which has circular dependency issues. 
For now, the unified provider works with OpenAI only. Gemini support will be enabled once the package 
structure is refactored.

### Usage (OpenAI only for now)

```typescript
import { UnifiedAIProvider } from '@easymo/ai/core';

const provider = new UnifiedAIProvider({
  openai: { apiKey: process.env.OPENAI_API_KEY },
  gemini: { apiKey: process.env.GEMINI_API_KEY }, // Not yet functional
  primaryProvider: 'openai',
});

const response = await provider.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Next Steps

1. Refactor package structure to avoid circular dependencies
2. Enable Gemini client integration
3. Add unit tests
4. Complete integration with AgentsService
