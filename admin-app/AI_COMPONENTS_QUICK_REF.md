# EasyMO AI Components - Quick Reference 🚀

**Last Updated:** 2025-11-29  
**Phase:** 5 Complete

## 📦 Quick Imports

```typescript
// All AI Components
import {
  ChatCompletionsPlayground,
  RealtimeChat,
  VoiceAgent,
  ImageGenerator,
  AnalyticsDashboard,
  StreamingChat
} from '@/components/ai';

// Agent Components
import {
  AgentToolConfig,
  AgentTestBench,
  AgentCreator
} from '@/components/agents';
```

---

## 🎯 Component Usage

### 1. Chat Completions (OpenAI)
```tsx
<ChatCompletionsPlayground />
```
**Use for:** Testing OpenAI models, prompt engineering, token optimization

---

### 2. Realtime Chat (Streaming)
```tsx
<RealtimeChat
  agentId="my-agent-123"
  sessionId="session-456"
  onMessageSent={(msg) => console.log('User:', msg)}
  onResponseReceived={(res) => console.log('AI:', res)}
/>
```
**Use for:** Real-time conversations, customer support, live assistance

**Props:**
- `agentId?: string` - Optional agent to use
- `sessionId?: string` - Session for conversation history
- `initialMessages?: Message[]` - Pre-populate chat
- `onMessageSent?: (msg: string) => void` - Callback when user sends
- `onResponseReceived?: (res: string) => void` - Callback when AI responds

---

### 3. Voice Agent (Audio)
```tsx
<VoiceAgent
  agentId="driver-assistant"
  provider="openai"  // or "gemini"
  onTranscript={(text, role) => {
    console.log(`[${role}]: ${text}`);
  }}
/>
```
**Use for:** Voice calls, hands-free assistance, driver support

**Props:**
- `agentId?: string` - Agent configuration to use
- `provider?: 'openai' | 'gemini'` - Voice provider
- `onTranscript?: (text: string, role: 'user' | 'assistant') => void`

**Features:**
- Auto voice detection (VAD)
- Real-time transcription
- Mute/unmute controls
- Speaker volume control

---

### 4. Image Generator
```tsx
<ImageGenerator
  onImageGenerated={(image) => {
    console.log('Generated:', image.url);
    // Save to database, etc.
  }}
/>
```
**Use for:** Product images, marketing banners, creative content

**Props:**
- `onImageGenerated?: (image: GeneratedImage) => void`

**Models Supported:**
- DALL·E 3 (1024×1024, 1792×1024, 1024×1792)
- DALL·E 2 (256×256, 512×512, 1024×1024)
- Imagen 3 (multiple aspect ratios)

---

### 5. Agent Tool Config
```tsx
<AgentToolConfig
  agentId="my-agent"
  onToolsUpdated={(tools) => {
    console.log('Tools configured:', tools);
  }}
/>
```
**Use for:** Configuring agent capabilities, adding custom tools

**Available Tools:**
- Google Maps/Places API
- Google Search grounding
- Supabase database queries
- Custom business logic

---

### 6. Agent Test Bench
```tsx
<AgentTestBench
  agentId="my-agent"
  agentName="Customer Support Agent"
/>
```
**Use for:** Testing agent responses, validating behavior, regression testing

**Test Types:**
- Functional tests
- Performance tests
- Tool invocation tests
- Error handling tests

---

### 7. Analytics Dashboard
```tsx
<AnalyticsDashboard />
```
**Use for:** Monitoring usage, tracking costs, performance metrics

**Metrics:**
- Request volume
- Success/error rates
- Token usage
- Cost analysis
- Provider breakdown
- Response latency

---

## 🔧 API Routes Reference

### Chat Completions
```typescript
POST /api/ai/chat
{
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: "Hello!" }
  ],
  temperature: 0.7,
  maxCompletionTokens: 1000
}
```

### Realtime WebSocket
```typescript
// Connect
ws://localhost:3000/api/ai/realtime?provider=openai&model=gpt-4o

// Send message
{
  type: "conversation.item.create",
  item: {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: "Hello" }]
  }
}
```

### Voice Processing
```typescript
POST /api/ai/voice
{
  action: "create_session",
  systemInstruction: "You are a driver assistant",
  voiceConfig: {
    voiceName: "en-US-Standard-A",
    languageCode: "en-US"
  }
}
```

### Image Generation
```typescript
POST /api/ai/images
{
  action: "generate",
  prompt: "A serene landscape with mountains",
  aspectRatio: "16:9"
}
```

---

## 🎨 Styling & Theming

All components use Tailwind CSS and shadcn/ui. Customize with:

```tsx
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

<Card className="custom-class">
  <RealtimeChat />
</Card>
```

**Theme Variables:**
- `--primary` - Primary brand color
- `--secondary` - Secondary color
- `--muted` - Muted text/backgrounds
- `--accent` - Accent highlights

---

## 🔐 Environment Setup

### Required Secrets (Supabase)
```bash
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...
GOOGLE_MAPS_API_KEY=AIza...
GOOGLE_SEARCH_API_KEY=AIza...
GOOGLE_SEARCH_ENGINE_ID=...
```

### Feature Flags
```bash
ENABLE_OPENAI_REALTIME=true
ENABLE_GEMINI_LIVE=true
ENABLE_IMAGE_GENERATION=true
```

---

## 🚨 Error Handling

All components include error boundaries:

```tsx
import { ErrorBoundary } from '@/components/ui/error-boundary';

<ErrorBoundary fallback={<div>Something went wrong</div>}>
  <VoiceAgent />
</ErrorBoundary>
```

---

## 📊 Performance Tips

### 1. Lazy Load Components
```tsx
import dynamic from 'next/dynamic';

const VoiceAgent = dynamic(() => 
  import('@/components/ai').then(mod => mod.VoiceAgent),
  { ssr: false }
);
```

### 2. Memoize Callbacks
```tsx
const handleMessage = useCallback((msg: string) => {
  console.log('Message:', msg);
}, []);

<RealtimeChat onMessageSent={handleMessage} />
```

### 3. Optimize Re-renders
```tsx
import { memo } from 'react';

const MemoizedChat = memo(RealtimeChat);
```

---

## 🧪 Testing

### Unit Test Example
```typescript
import { render, screen } from '@testing-library/react';
import { RealtimeChat } from '@/components/ai';

test('renders chat interface', () => {
  render(<RealtimeChat />);
  expect(screen.getByText(/realtime chat/i)).toBeInTheDocument();
});
```

### Integration Test Example
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useWebSocket } from '@/lib/hooks';

test('connects to WebSocket', async () => {
  const { result } = renderHook(() => useWebSocket('/api/ai/realtime'));
  await waitFor(() => expect(result.current.isConnected).toBe(true));
});
```

---

## 🐛 Common Issues & Solutions

### Issue: WebSocket won't connect
**Solution:**
```typescript
// Check route is deployed
fetch('/api/ai/realtime').then(r => console.log(r.status));

// Ensure proper protocol
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
```

### Issue: Voice agent no audio
**Solution:**
```typescript
// Check microphone permissions
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(() => console.log('Mic access granted'))
  .catch(err => console.error('Mic access denied:', err));
```

### Issue: Images not generating
**Solution:**
```typescript
// Verify API key is set
fetch('/api/ai/health')
  .then(r => r.json())
  .then(data => console.log('API status:', data));
```

---

## 📱 Responsive Design

All components are responsive:
- **Mobile:** Stack vertically, full-width controls
- **Tablet:** Side-by-side layouts where appropriate
- **Desktop:** Multi-column layouts, expanded controls

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
  <Card className="lg:col-span-1">Sidebar</Card>
  <Card className="lg:col-span-2">Main content</Card>
</div>
```

---

## 🎯 Best Practices

### 1. Always handle loading states
```tsx
const [isLoading, setIsLoading] = useState(false);

{isLoading ? <Loader /> : <RealtimeChat />}
```

### 2. Provide user feedback
```tsx
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: "Success",
  description: "Message sent successfully"
});
```

### 3. Clean up resources
```tsx
useEffect(() => {
  const ws = new WebSocket(url);
  return () => ws.close(); // Cleanup
}, []);
```

---

## 🔗 Related Documentation

- **Full Documentation:** `AI_PHASE5_UI_COMPLETE.md`
- **Quick Start:** `AI_QUICK_START_GUIDE.md`
- **Architecture:** `AI_ARCHITECTURE_VISUAL.txt`
- **API Reference:** Component JSDoc comments

---

## 🆘 Getting Help

1. Check component prop types (TypeScript)
2. View browser console for errors
3. Review API route logs
4. Check Supabase Secrets configuration
5. Verify environment variables

---

## ✅ Quick Checklist

Before deploying:
- [ ] All API keys configured in Supabase Secrets
- [ ] Environment variables set
- [ ] Component exports verified
- [ ] TypeScript compilation successful
- [ ] Browser console clean (no errors)
- [ ] WebSocket connections working
- [ ] Audio permissions granted
- [ ] Image generation tested
- [ ] Analytics tracking enabled

---

**Version:** 1.0  
**Status:** ✅ Production Ready  
**Need Help?** Check the full documentation or component source code
