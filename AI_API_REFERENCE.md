# 📡 EasyMO AI - Complete API Reference

Base URL: `http://localhost:3000/api` (development)

---

## 🗂️ Table of Contents

1. [Chat API](#chat-api)
2. [Streaming API](#streaming-api)
3. [Agents API](#agents-api)
4. [Assistants API](#assistants-api)
5. [RAG API](#rag-api)
6. [Multi-Modal API](#multi-modal-api)
7. [Analytics API](#analytics-api)
8. [Google Integrations](#google-integrations)

---

## 1. Chat API

### POST /api/ai/chat

Standard chat completions with multi-provider support.

**Request:**
```json
{
  "messages": [
    {"role": "system", "content": "You are helpful"},
    {"role": "user", "content": "Hello!"}
  ],
  "provider": "openai" | "gemini",  // optional, default: "openai"
  "maxCost": "low" | "medium" | "high"  // optional
}
```

**Response:**
```json
{
  "id": "chatcmpl-xxx",
  "created": 1732864290,
  "model": "gpt-4o-mini",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help?"
    }
  }],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  }
}
```

**Rate Limits:** 100 requests/minute

**Example:**
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is EasyMO?"}
    ],
    "provider": "gemini"
  }'
```

---

## 2. Streaming API

### POST /api/ai/stream

Server-sent events (SSE) streaming for real-time responses.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Tell me a story"}
  ],
  "provider": "openai" | "gemini"
}
```

**Response:** Server-Sent Events
```
data: {"content":"Once"}
data: {"content":" upon"}
data: {"content":" a"}
data: {"content":" time"}
data: [DONE]
```

**Example:**
```bash
curl -N -X POST http://localhost:3000/api/ai/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Count to 20"}]
  }'
```

**JavaScript Client:**
```javascript
const response = await fetch('/api/ai/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      const parsed = JSON.parse(data);
      console.log(parsed.content);
    }
  }
}
```

---

## 3. Agents API

### GET /api/ai/agents

List available agents.

**Response:**
```json
{
  "agents": [
    {
      "id": "mobility-agent",
      "name": "Mobility Agent",
      "description": "Handles ride booking",
      "tools": ["searchDrivers", "bookRide", "getLocations"]
    }
  ]
}
```

### POST /api/ai/agents

Execute an agent.

**Request:**
```json
{
  "agentId": "mobility-agent",
  "input": "Find me a driver near Kigali Convention Centre",
  "context": {}
}
```

**Response:**
```json
{
  "success": true,
  "output": "Found 3 drivers within 1km...",
  "toolCalls": [
    {"tool": "searchDrivers", "result": {...}}
  ]
}
```

---

## 4. Assistants API

### GET /api/ai/assistants

**Actions:**
- `?action=list` - List all assistants
- `?action=get&id=xxx` - Get specific assistant
- `?action=templates` - Get pre-built templates

**Examples:**
```bash
# List all
curl "http://localhost:3000/api/ai/assistants?action=list"

# Get one
curl "http://localhost:3000/api/ai/assistants?action=get&id=asst_xxx"

# Get templates
curl "http://localhost:3000/api/ai/assistants?action=templates"
```

### POST /api/ai/assistants

**Actions:**

#### Create Assistant
```json
{
  "action": "create",
  "name": "Support Bot",
  "instructions": "You help users with EasyMO",
  "model": "gpt-4o-mini",
  "tools": [
    {"type": "file_search"},
    {"type": "code_interpreter"}
  ]
}
```

#### Chat with Assistant
```json
{
  "action": "chat",
  "assistantId": "asst_xxx",
  "messages": [
    {"role": "user", "content": "How do I book a ride?"}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "threadId": "thread_xxx",
  "messages": [
    {
      "role": "assistant",
      "content": "To book a ride: 1) Open app, 2) ..."
    }
  ]
}
```

#### Update Assistant
```json
{
  "action": "update",
  "assistantId": "asst_xxx",
  "config": {
    "name": "New Name",
    "instructions": "Updated instructions"
  }
}
```

#### Delete Assistant
```json
{
  "action": "delete",
  "assistantId": "asst_xxx"
}
```

---

## 5. RAG API

### GET /api/ai/rag

Search documents by similarity.

**Parameters:**
- `query` (required): Search query
- `limit` (optional): Number of results (default: 5)

**Example:**
```bash
curl "http://localhost:3000/api/ai/rag?query=booking&limit=3"
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "doc-123",
      "content": "To book a ride...",
      "metadata": {"category": "mobility"},
      "similarity": 0.89
    }
  ],
  "count": 3
}
```

### POST /api/ai/rag

**Actions:**

#### Add Single Document
```json
{
  "action": "add_document",
  "content": "EasyMO provides ride-hailing services...",
  "metadata": {
    "category": "mobility",
    "source": "user-guide"
  }
}
```

#### Add Multiple Documents
```json
{
  "action": "add_documents",
  "documents": [
    {"content": "Document 1...", "metadata": {}},
    {"content": "Document 2...", "metadata": {}}
  ]
}
```

#### Process Long Document (Auto-chunk)
```json
{
  "action": "process_document",
  "text": "Very long document text (10,000+ words)...",
  "metadata": {"title": "User Guide", "version": "2.0"}
}
```

**Response:**
```json
{
  "success": true,
  "ids": ["chunk-1", "chunk-2", "chunk-3"],
  "chunks": 3
}
```

#### RAG Query (Search + Generate)
```json
{
  "action": "query",
  "question": "How do I schedule a trip?",
  "context": "User is on mobile app",  // optional
  "numResults": 3  // optional, default: 3
}
```

**Response:**
```json
{
  "success": true,
  "answer": "To schedule a trip: [1] Open the app...",
  "sources": [
    {
      "content": "Trip scheduling guide...",
      "metadata": {"category": "mobility"}
    }
  ]
}
```

#### Update Document
```json
{
  "action": "update",
  "id": "doc-123",
  "content": "Updated content...",
  "metadata": {"updated": true}
}
```

#### Delete Document
```json
{
  "action": "delete",
  "id": "doc-123"
}
```

---

## 6. Multi-Modal API

### POST /api/ai/multimodal

**Actions:**

#### Analyze Image (GPT-4 Vision)
```json
{
  "action": "analyze_image",
  "imageUrl": "https://example.com/car.jpg",
  "prompt": "Is this vehicle suitable for ride-hailing?"
}
```

**Response:**
```json
{
  "success": true,
  "description": "This is a modern sedan...",
  "objects": ["car", "vehicle", "sedan"],
  "metadata": {
    "model": "gpt-4o",
    "timestamp": "2025-11-29T..."
  }
}
```

#### Analyze Image (Gemini)
```json
{
  "action": "analyze_image_gemini",
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQ...",
  "prompt": "Describe this image"
}
```

#### Extract Text (OCR)
```json
{
  "action": "extract_text",
  "imageUrl": "https://example.com/document.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "text": "Extracted text from image..."
}
```

#### Generate Image (DALL-E 3)
```json
{
  "action": "generate_image",
  "prompt": "A futuristic electric vehicle in Kigali",
  "size": "1024x1024" | "1792x1024" | "1024x1792"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://oaidalleapiprodscus.blob.core.windows.net/...",
  "revisedPrompt": "A sleek, modern electric vehicle..."
}
```

#### Compare Images
```json
{
  "action": "compare_images",
  "imageUrl1": "https://example.com/car1.jpg",
  "imageUrl2": "https://example.com/car2.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "similarity": "Both images show sedans...",
  "differences": "Image 1 is blue, Image 2 is red..."
}
```

#### Transcribe Audio
```bash
curl -X POST http://localhost:3000/api/ai/multimodal \
  -F "action=transcribe_audio" \
  -F "audio=@recording.mp3"
```

**Response:**
```json
{
  "success": true,
  "text": "Transcribed audio content..."
}
```

#### Text to Speech
```json
{
  "action": "text_to_speech",
  "text": "Welcome to EasyMO!",
  "voice": "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
}
```

**Response:** Audio file (MP3)

---

## 7. Analytics API

### GET /api/analytics

Get usage analytics and metrics.

**Parameters:**
- `type`: `all` | `usage` | `errors` | `performance`

**Examples:**

#### All Metrics
```bash
curl "http://localhost:3000/api/analytics?type=all"
```

**Response:**
```json
{
  "data": {
    "summary": {
      "totalRequests": 1523,
      "totalErrors": 12,
      "avgResponseTime": 324,
      "successRate": 99.2
    },
    "usage": {...},
    "errors": {...},
    "performance": {...}
  }
}
```

#### Usage Stats
```bash
curl "http://localhost:3000/api/analytics?type=usage"
```

**Response:**
```json
{
  "data": {
    "usage": {
      "totalRequests": 1523,
      "successfulRequests": 1511,
      "failedRequests": 12,
      "totalTokens": 234567,
      "totalCost": 0.1234,
      "averageDuration": 324,
      "byProvider": {
        "openai": 1200,
        "gemini": 323
      }
    }
  }
}
```

#### Error Stats
```bash
curl "http://localhost:3000/api/analytics?type=errors"
```

#### Performance Stats
```bash
curl "http://localhost:3000/api/analytics?type=performance"
```

**Response:**
```json
{
  "data": {
    "overall": {
      "count": 1523,
      "avgDuration": 324,
      "minDuration": 89,
      "maxDuration": 1234,
      "p50": 280,
      "p95": 650,
      "p99": 980,
      "successRate": 99.2
    }
  }
}
```

---

## 8. Google Integrations

### POST /api/google/maps

Location services and directions.

**Actions:**

#### Geocode Address
```json
{
  "action": "geocode",
  "address": "Kigali Convention Centre"
}
```

#### Reverse Geocode
```json
{
  "action": "reverse_geocode",
  "lat": -1.9442,
  "lng": 30.0619
}
```

#### Search Places
```json
{
  "action": "search_places",
  "query": "restaurants near me",
  "location": {"lat": -1.9442, "lng": 30.0619},
  "radius": 1000
}
```

#### Get Directions
```json
{
  "action": "directions",
  "origin": "Kigali Airport",
  "destination": "Kigali Convention Centre",
  "mode": "driving"
}
```

### POST /api/google/search

Grounded search with citations.

```json
{
  "query": "Latest Rwanda mobility trends",
  "numResults": 5
}
```

---

## 🔐 Authentication

All endpoints require valid Supabase session (except public endpoints).

**Headers:**
```
Authorization: Bearer <supabase-access-token>
```

---

## 📊 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/ai/chat | 100 | 1 minute |
| /api/ai/stream | 50 | 1 minute |
| /api/ai/agents | 20 | 1 minute |
| /api/ai/assistants | 30 | 1 minute |
| /api/ai/rag | 50 | 1 minute |
| /api/ai/multimodal | 20 | 1 minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1732864350
```

---

## ❌ Error Responses

**Standard Error Format:**
```json
{
  "error": "Error message",
  "details": "Detailed error information",
  "code": "ERROR_CODE"
}
```

**Common Status Codes:**
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth)
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

---

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Test All Features
```bash
# Run test suite
cd admin-app
npm test

# Or use the test script
./test-ai-features.sh
```

---

**Last Updated:** 2025-11-29  
**Version:** 1.0.0
