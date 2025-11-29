# AI Agents UI Components - Quick Reference

## 🚀 Quick Start

### Import Components

```tsx
// Voice & Chat
import { VoiceAgent, RealtimeChat } from '@/components/ai';

// Image Generation
import { ImageGenerator } from '@/components/ai';

// Agent Management
import { AgentCreator, AgentToolConfig, AgentTestBench } from '@/components/agents';
```

## 📖 Component Usage

### 1. Voice Agent

```tsx
<VoiceAgent
  agentId="my-agent"
  provider="openai" // or "gemini"
  onTranscript={(text, role) => {
    console.log(`${role}: ${text}`);
  }}
/>
```

**Features**: Bidirectional voice, real-time transcription, mic/speaker controls

---

### 2. Realtime Chat

```tsx
<RealtimeChat
  agentId="my-agent"
  sessionId="unique-session"
  initialMessages={[]}
  onMessageSent={(msg) => console.log('Sent:', msg)}
  onResponseReceived={(res) => console.log('Received:', res)}
/>
```

**Features**: Streaming responses, function calls, auto-scroll, reconnection

---

### 3. Image Generator

```tsx
<ImageGenerator
  onImageGenerated={(image) => {
    console.log('Generated:', image.url);
    // Upload to CDN, save to DB, etc.
  }}
/>
```

**Features**: DALL-E 2/3, Imagen 3, negative prompts, batch generation

---

### 4. Tool Configuration

```tsx
<AgentToolConfig
  agentId="my-agent"
  tools={existingTools}
  onToolsUpdated={(tools) => {
    console.log('Updated tools:', tools);
  }}
/>
```

**Features**: Enable/disable tools, test execution, schema visualization

---

### 5. Test Bench

```tsx
<AgentTestBench
  agentId="my-agent"
  agentName="Customer Support Agent"
/>
```

**Features**: Test management, batch execution, pass/fail validation, import/export

---

### 6. Enhanced Agent Creator

```tsx
<AgentCreator />
```

**New Fields**:
- Provider selection (OpenAI, Gemini, Multi)
- Model selection (GPT-4o, Gemini 2.0 Flash, etc.)

---

## 🎯 Demo Page

Access all components in one place:

```
/ai-playground
```

5 tabs: Chat, Voice, Images, Tools, Tests

---

## 🔌 API Integration

### Required Endpoints

```typescript
// Chat completions
POST /api/ai/chat
{
  agentId: string;
  provider: 'openai' | 'gemini';
  model: string;
  messages: Message[];
  temperature?: number;
}

// Image generation
POST /api/ai/images
{
  provider: 'openai' | 'google';
  model: string;
  prompt: string;
  size: string;
  quality?: 'standard' | 'hd';
}

// Tool testing
POST /api/agents/{id}/tools/{toolId}/test
{
  ...toolParameters
}

// WebSocket endpoints
wss://{host}/api/ai/realtime?provider={}&agentId={}
wss://{host}/api/ai/voice?provider={}&agentId={}
```

---

## 🎨 Styling

All components use shadcn/ui and are fully responsive:
- Dark mode support
- Tailwind CSS
- Mobile-friendly
- Accessibility compliant

---

## 🔐 Security Notes

**Client-side**: No API keys exposed  
**Server-side**: Implement auth, rate limiting, sandboxing

---

## 📦 Dependencies

Already available in admin-app:
- `@/components/ui/*` (shadcn/ui)
- React hooks
- Next.js

**Required for server**:
- `openai` package
- `@google/generative-ai`
- WebSocket server (ws)

---

## ⚡ Performance

- WebSocket connection reuse
- Lazy loading
- Efficient re-renders
- Audio buffering
- Debounced inputs

---

## 🐛 Troubleshooting

### Voice not working
- Check HTTPS (required for mic access)
- Browser compatibility (Chrome/Edge preferred)

### WebSocket disconnections
- Check network stability
- Verify server WebSocket support

### Image generation slow
- Normal for HD quality
- Use standard quality for faster results

---

## 📚 Documentation

Full docs: `AI_AGENTS_PHASE5_COMPLETE.md`

Component files:
- `components/ai/VoiceAgent.tsx`
- `components/ai/RealtimeChat.tsx`
- `components/ai/ImageGenerator.tsx`
- `components/agents/AgentToolConfig.tsx`
- `components/agents/AgentTestBench.tsx`

---

## ✅ Checklist for Production

- [ ] Implement API endpoints
- [ ] Set up WebSocket infrastructure
- [ ] Configure API keys (Supabase secrets)
- [ ] Add authentication guards
- [ ] Implement rate limiting
- [ ] Set up error monitoring
- [ ] Load testing
- [ ] User documentation

---

**Phase 5 Complete** ✅  
Ready for backend integration and deployment!
