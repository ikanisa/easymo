# EasyMO AI Agents - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Verify Installation

All packages are already installed. Verify:

```bash
cd admin-app
npm list openai @google/generative-ai ws p-retry p-queue
```

### Step 2: Configure API Keys (Supabase Secrets)

Add these secrets in Supabase Dashboard → Settings → Secrets:

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-...

# Google AI
GOOGLE_AI_API_KEY=AIza...
GOOGLE_CLOUD_PROJECT=easymo-prod

# Google Maps
GOOGLE_MAPS_API_KEY=AIza...

# Feature Flags (all enabled by default)
ENABLE_OPENAI_REALTIME=true
ENABLE_GEMINI_LIVE=true
ENABLE_IMAGE_GENERATION=true
ENABLE_GOOGLE_SEARCH_GROUNDING=true
```

### Step 3: Test Basic Chat

```typescript
// test-ai.ts
import { quickChat } from '@/lib/ai';

async function test() {
  const response = await quickChat('Hello, how are you?');
  console.log(response);
}

test();
```

Run:
```bash
npx tsx test-ai.ts
```

---

## 📖 Usage Examples

### 1. Simple Chat Completion

```typescript
import { routeChatRequest } from '@/lib/ai';

const response = await routeChatRequest({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is EasyMO?' }
  ],
  preferredProvider: 'openai', // or 'gemini' or omit for auto
});

console.log(response.choices[0].message.content);
```

### 2. Mobility Agent (Ride Booking)

```typescript
import { mobilityAgent } from '@/lib/ai/domain';

// Find nearby drivers
const drivers = await mobilityAgent.findNearbyDrivers({
  location: { lat: -1.9536, lng: 30.0606 }, // Kigali
  vehicleType: 'moto',
  radius: 3000, // 3km
});

console.log(drivers.response);

// Get trip quote
const quote = await mobilityAgent.calculateTripQuote({
  origin: { lat: -1.9536, lng: 30.0606 },
  destination: { lat: -1.9441, lng: 30.0619 },
  vehicleType: 'car',
});

console.log(quote.response);
```

### 3. Marketplace Agent (Product Search)

```typescript
import { marketplaceAgent } from '@/lib/ai/domain';

// Search products
const products = await marketplaceAgent.searchProducts('aspirin', 'pharmacy');
console.log(products.response);

// Get recommendations
const recommendations = await marketplaceAgent.getProductRecommendations({
  category: 'pain relievers',
  budget: 5000, // RWF
  preferences: ['fast-acting', 'no-prescription'],
});

console.log(recommendations.response);
```

### 4. Support Agent (Customer Help)

```typescript
import { supportAgent } from '@/lib/ai/domain';

// Answer question
const answer = await supportAgent.answerQuestion(
  'How do I cancel my trip?',
  { userId: 'user123', recentTrips: ['trip456'] }
);

console.log(answer.response);

// Troubleshoot issue
const solution = await supportAgent.troubleshootBooking({
  tripId: 'trip456',
  issue: 'Driver not arriving',
  userId: 'user123',
});

console.log(solution.response);
```

### 5. Voice Interactions (Gemini Live)

```typescript
import { createLiveSession, textToSpeech } from '@/lib/ai/google/gemini-live';

// Create voice session
const session = await createLiveSession({ voiceName: 'Kore' });

// Text to speech
const audio = await textToSpeech(session, 'Hello, welcome to EasyMO!');

// Play audio in browser
if (audio.audioData) {
  const audioElement = new Audio(
    `data:${audio.audioMimeType};base64,${audio.audioData}`
  );
  audioElement.play();
}
```

### 6. Search with Grounding (Citations)

```typescript
import { searchWithGrounding } from '@/lib/ai/google/search-grounding';

const result = await searchWithGrounding('What is the current weather in Kigali?');

console.log('Answer:', result.text);
console.log('Sources:', result.sources);
console.log('Search Queries Used:', result.searchQueries);
```

### 7. Image Generation

```typescript
import { generateProductImage } from '@/lib/ai/google/imagen';

const image = await generateProductImage({
  productName: 'EasyMO Branded T-Shirt',
  productCategory: 'Apparel',
  style: 'professional',
  backgroundColor: 'white',
});

// Use in React component
<img 
  src={`data:${image.images[0].mimeType};base64,${image.images[0].base64Data}`}
  alt="Generated product image"
/>
```

---

## 🌐 API Endpoints

### Chat Completions

```bash
POST /api/ai/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "provider": "openai",
  "temperature": 0.7
}
```

### Domain Agents

```bash
POST /api/ai/agents
Content-Type: application/json

{
  "agent": "mobility",
  "message": "Find me a moto driver near Nyabugogo"
}
```

### Voice Processing

```bash
POST /api/ai/voice
Content-Type: application/json

{
  "action": "text-to-speech",
  "text": "Welcome to EasyMO",
  "voiceName": "Kore"
}
```

### Search with Grounding

```bash
POST /api/ai/search
Content-Type: application/json

{
  "query": "Best practices for ride-sharing safety",
  "type": "factual"
}
```

### Image Generation

```bash
POST /api/ai/images
Content-Type: application/json

{
  "action": "product",
  "productName": "Safety Helmet",
  "productCategory": "Safety Equipment"
}
```

---

## 🔧 Configuration

### Provider Selection

The system automatically routes requests to the best provider based on:

1. **Cost** - Gemini for low-cost, OpenAI for quality
2. **Capability** - Vision, voice, tools support
3. **Availability** - Automatic fallback on errors

Override with:

```typescript
routeChatRequest({
  messages: [...],
  preferredProvider: 'gemini', // or 'openai'
  maxCost: 'low', // 'low' | 'medium' | 'high'
});
```

### Feature Flags

Control features via environment variables:

```bash
ENABLE_OPENAI_REALTIME=true    # OpenAI Realtime API
ENABLE_GEMINI_LIVE=true        # Gemini Live voice
ENABLE_IMAGE_GENERATION=true   # Imagen image gen
ENABLE_GOOGLE_SEARCH_GROUNDING=true  # Search grounding
```

Check status:

```typescript
import { getProviderStatus } from '@/lib/ai/config';

const status = getProviderStatus();
console.log(status);
/*
{
  openai: { configured: true, features: { chat: true, realtime: true } },
  gemini: { configured: true, features: { chat: true, live: true } },
  integrations: { googleMaps: true, googleSearch: true }
}
*/
```

---

## 🛠️ Development Tips

### 1. Use TypeScript Types

All functions are fully typed:

```typescript
import type { AIMessage, AICompletionOptions } from '@/lib/ai/types';

const messages: AIMessage[] = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'user', content: 'Hello!' },
];
```

### 2. Error Handling

All functions throw typed errors:

```typescript
import { quickChat } from '@/lib/ai';

try {
  const response = await quickChat('Hello');
} catch (error) {
  console.error('AI Error:', error.message);
}
```

### 3. Streaming Responses

For long-running completions:

```typescript
import { streamOpenAICompletion } from '@/lib/ai/openai/agents-sdk';

for await (const chunk of streamOpenAICompletion({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Write a story...' }],
})) {
  process.stdout.write(chunk);
}
```

### 4. Session Management

For multi-turn conversations:

```typescript
import { sessionManager } from '@/lib/ai/session-manager';

const session = sessionManager.create('user123');
sessionManager.addMessage(session.id, 'user', 'Hello!');
sessionManager.addMessage(session.id, 'assistant', 'Hi there!');

const messages = session.messages; // Use in next request
```

---

## 📊 Monitoring

All AI interactions are logged:

```typescript
import { logStructuredEvent } from '@/lib/monitoring/logger';

// Automatic logging in API routes
await logStructuredEvent('AI_CHAT_REQUEST', {
  provider: 'openai',
  model: 'gpt-4o-mini',
  messageCount: 3,
});
```

View logs in:
- Supabase Dashboard → Logs
- Application monitoring tools

---

## 🔍 Debugging

### Check Provider Status

```typescript
import { AI_CONFIG, isConfigured } from '@/lib/ai/config';

console.log('OpenAI configured:', isConfigured('openai'));
console.log('Gemini configured:', isConfigured('gemini'));
console.log('Config:', AI_CONFIG);
```

### Test Individual Components

```typescript
import { getOpenAIClient } from '@/lib/ai/providers/openai-client';
import { getGeminiClient } from '@/lib/ai/providers/gemini-client';

// Test OpenAI
const openai = getOpenAIClient();
console.log('OpenAI client:', openai);

// Test Gemini
const gemini = getGeminiClient();
console.log('Gemini client:', gemini);
```

---

## 📚 Additional Resources

- **Full Implementation:** `AI_AGENTS_COMPLETE_IMPLEMENTATION.md`
- **Architecture Review:** `AI_ARCHITECTURE_DEEP_REVIEW.md`
- **API Reference:** JSDoc comments in source files
- **Type Definitions:** `lib/ai/types.ts`

---

## 🎯 Next Steps

1. ✅ Configure API keys in Supabase Secrets
2. ✅ Test each endpoint with real keys
3. ✅ Build UI components for chat interface
4. ✅ Add usage analytics and cost tracking
5. ✅ Implement caching for frequent queries

---

**Ready to go!** Start with the simple examples and build from there. All code is production-ready and fully typed.
