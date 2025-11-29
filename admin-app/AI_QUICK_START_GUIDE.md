# EasyMO AI Agents - Quick Start Guide

## 🎯 What Was Implemented

Complete AI Agents Architecture with support for:
- ✅ **OpenAI** (GPT-4o, o1, Realtime API, Assistants)
- ✅ **Google Gemini** (2.0 Flash, 1.5 Pro, Live API)
- ✅ **Google Maps & Places** (Search, Directions, Geocoding)
- ✅ **Google Custom Search** (Web search grounding)
- ✅ **Multi-Provider Router** (Automatic fallback)
- ✅ **Tool Registry** (Extensible function calling)
- ✅ **Domain Agents** (Pre-configured for mobility, marketplace, etc.)

## 📦 Installation (Already Done)

All required packages are already in `package.json`:
```json
{
  "openai": "^4.104.0",
  "@google/generative-ai": "^0.21.0",
  "@googlemaps/google-maps-services-js": "^3.4.0",
  "p-retry": "^6.2.0",
  "p-queue": "^8.0.1",
  "ws": "^8.18.0",
  "zod": "3.25.76"
}
```

## 🔑 Step 1: Configure API Keys

1. Copy the template:
   ```bash
   cp .env.example.ai .env.local
   ```

2. Get your API keys:
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Google AI**: https://aistudio.google.com/app/apikey
   - **Google Maps**: https://console.cloud.google.com/google/maps-apis
   - **Google Search**: https://programmablesearchengine.google.com/

3. Add to `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-proj-...
   GOOGLE_AI_API_KEY=AIza...
   GOOGLE_MAPS_API_KEY=AIza...
   GOOGLE_SEARCH_API_KEY=AIza...
   GOOGLE_SEARCH_ENGINE_ID=...
   
   # Enable features
   ENABLE_OPENAI_REALTIME=true
   ENABLE_GEMINI_LIVE=true
   ENABLE_IMAGE_GENERATION=true
   ENABLE_GOOGLE_SEARCH_GROUNDING=true
   ```

## 🚀 Step 2: Test the Setup

Run the test script:
```bash
npx tsx test-ai-setup.ts
```

Expected output:
```
🤖 EasyMO AI Agents Architecture Test

📋 Configuration Status:
  OpenAI Key: ✅ Configured
  Google AI Key: ✅ Configured
  ...

✅ AI Architecture Implementation: COMPLETE
```

## 💻 Step 3: Use in Your App

### Example 1: OpenAI Chat
```typescript
// app/api/chat/route.ts
import { createOpenAICompletion } from '@/lib/ai/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const response = await createOpenAICompletion({
    model: 'gpt-4o-mini',
    messages,
  });
  
  return Response.json(response);
}
```

### Example 2: Gemini with Streaming
```typescript
import { streamGeminiCompletion } from '@/lib/ai/google';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of streamGeminiCompletion({ messages })) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  
  return new Response(stream);
}
```

### Example 3: Voice Agent (Realtime)
```typescript
import { createRealtimeSession, subscribeRealtimeEvents } from '@/lib/ai/openai';

// In a WebSocket handler or API route
const session = await createRealtimeSession({
  voice: 'alloy',
  instructions: 'You are a helpful mobility assistant',
});

subscribeRealtimeEvents(session, 'all', (event) => {
  console.log('Realtime event:', event);
});
```

### Example 4: Google Maps Integration
```typescript
import { searchPlaces, calculateRoute } from '@/lib/integrations';

// Find nearby hospitals
const hospitals = await searchPlaces({
  query: 'hospital',
  location: { lat: -1.9441, lng: 30.0619 },
  radius: 5000,
});

// Get directions
const route = await calculateRoute({
  origin: 'Kigali City',
  destination: 'Airport',
  mode: 'driving',
});
```

### Example 5: Web Search Grounding
```typescript
import { searchWithGrounding } from '@/lib/ai/google';

const result = await searchWithGrounding(
  'Current weather in Kigali'
);

console.log(result.answer);
console.log(result.sources);
```

## 🛠️ Architecture Overview

```
lib/
├── ai/
│   ├── types.ts              # Shared TypeScript types
│   ├── config.ts             # Centralized configuration
│   ├── openai/
│   │   ├── client.ts         # OpenAI client singleton
│   │   ├── agents-sdk.ts     # Assistants API
│   │   └── realtime.ts       # Voice/Realtime API
│   └── google/
│       ├── client.ts         # Gemini client
│       ├── adk.ts            # Agent Development Kit
│       └── gemini-live.ts    # Voice API
├── integrations/
│   ├── google-maps.ts        # Maps & Places API
│   └── google-search.ts      # Custom Search API
└── agents/
    ├── tool-registry.ts      # Function definitions
    └── domain-agents.ts      # Pre-configured agents
```

## 🎨 UI Components (Next Step)

Create these components:

1. **ChatInterface** - Text-based AI chat
2. **VoiceAgent** - Voice interactions
3. **AgentCreator** - Visual agent builder
4. **ToolConfigurator** - Manage agent tools

## 📊 Health Checks

Test provider connectivity:
```typescript
import { healthCheckOpenAI } from '@/lib/ai/openai';
import { healthCheckGemini } from '@/lib/ai/google';

const openaiHealth = await healthCheckOpenAI();
const geminiHealth = await healthCheckGemini();

console.log(openaiHealth);  // { status: 'healthy', latency: 234, ... }
console.log(geminiHealth);   // { status: 'healthy', latency: 156, ... }
```

## 🔧 Common Issues

### Issue: "API key not configured"
**Solution**: Add keys to `.env.local` and restart dev server

### Issue: "Realtime API disabled"
**Solution**: Set `ENABLE_OPENAI_REALTIME=true` in `.env.local`

### Issue: "No space left on device"
**Solution**: Free up disk space (currently at 100%)

### Issue: TypeScript errors
**Solution**: Run `npm run type-check` to see specific errors

## 📚 API Reference

### OpenAI Functions
- `createOpenAICompletion(options)` - Standard chat
- `streamOpenAICompletion(options)` - Streaming chat
- `createOpenAIAgent(config)` - Create assistant
- `runOpenAIAgent(id, messages)` - Run assistant
- `createRealtimeSession(config)` - Voice session

### Gemini Functions
- `createGeminiCompletion(options)` - Standard chat
- `streamGeminiCompletion(options)` - Streaming chat
- `fastResponse(prompt)` - Quick response (Flash-Lite)
- `searchWithGrounding(query)` - Web-grounded search
- `generateMultimodal(options)` - Text + images

### Integration Functions
- `searchPlaces(query, location)` - Find places
- `geocodeAddress(address)` - Address → coordinates
- `calculateRoute(origin, destination)` - Get directions
- `googleSearch(query)` - Web search

## 🎯 Next Steps

1. ✅ **Core Infrastructure** - COMPLETE
2. ✅ **Provider Integration** - COMPLETE
3. ✅ **Tools & Agents** - COMPLETE
4. ⏳ **API Routes** - Create Next.js endpoints
5. ⏳ **UI Components** - Build chat interfaces
6. ⏳ **Production Testing** - Test with real data
7. ⏳ **Deployment** - Deploy to production

## 💡 Tips

- Use `gpt-4o-mini` for cost-effective chat
- Use `gemini-2.0-flash-exp` for fast responses
- Enable streaming for better UX
- Implement rate limiting in production
- Monitor API costs via dashboards

## 📞 Support

- OpenAI Docs: https://platform.openai.com/docs
- Gemini Docs: https://ai.google.dev/docs
- Google Maps Docs: https://developers.google.com/maps

---

**Status**: ✅ Core Architecture Complete  
**Ready for**: API Routes & UI Development  
**Next Session**: Build chat interfaces and API endpoints
