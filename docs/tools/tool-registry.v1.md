# Moltbot Tool Registry v1

> **Core Invariant:** Moltbot returns intent + structured args; backend executes tools and logs everything.

## Naming Convention

All tools follow: `marketplace.<verb>_<object>`

| Tool | Purpose |
|------|---------|
| `search_vendors` | Find candidate vendors matching request |
| `get_request_snapshot` | Get canonical request state |
| `send_client_message` | Send WhatsApp to client |
| `send_vendor_message` | Send WhatsApp to vendor |
| `record_vendor_reply` | Persist + parse vendor reply |
| `create_ocr_job` | Queue OCR processing |
| `get_ocr_result` | Fetch OCR status/result |
| `request_call_consent` | Ask for call permission |
| `start_call` | Initiate WhatsApp call |
| `update_request_state` | Transition request state |

---

## Tool Definitions

### 1. marketplace.search_vendors

Find vendors matching request criteria.

```typescript
interface SearchVendorsInput {
  request_id: string;
  category: string;
  filters?: {
    location_radius_km?: number;
    min_rating?: number;
    tags?: string[];
  };
  limit?: number; // default 5, max 15
}

interface SearchVendorsOutput {
  vendors: Array<{
    vendor_id: string;
    name: string;
    phone: string;
    distance_km?: number;
    rating?: number;
    tags?: string[];
  }>;
  total_available: number;
}
```

---

### 2. marketplace.get_request_snapshot

Get current request state + context.

```typescript
interface GetRequestSnapshotInput {
  request_id: string;
}

interface GetRequestSnapshotOutput {
  request_id: string;
  conversation_id: string;
  state: MoltbotRequestState;
  requirements: Record<string, unknown>;
  shortlist: MoltbotShortlistItem[];
  vendor_outreach_summary: MoltbotVendorOutreachSummary;
  last_messages: Array<{
    direction: 'inbound' | 'outbound';
    body: string | null;
    timestamp: string;
  }>;
  ocr?: MoltbotOcrResult;
}
```

---

### 3. marketplace.send_client_message

Send WhatsApp message to the client.

```typescript
interface SendClientMessageInput {
  request_id: string;
  message: string;
  idempotency_key: string; // format: request:{id}:hash:{content_hash}
  message_type?: 'text' | 'interactive';
  interactive_options?: string[]; // for quick reply buttons
}

interface SendClientMessageOutput {
  success: boolean;
  provider_message_id?: string;
  error?: string;
}
```

> **Idempotency:** If `idempotency_key` exists with success, return cached result.

---

### 4. marketplace.send_vendor_message

Send WhatsApp message to a vendor.

```typescript
interface SendVendorMessageInput {
  request_id: string;
  vendor_id: string;
  message: string;
  idempotency_key: string;
}

interface SendVendorMessageOutput {
  success: boolean;
  provider_message_id?: string;
  outreach_id?: string; // moltbot_vendor_outreach.id
  error?: string;
}
```

---

### 5. marketplace.record_vendor_reply

Record and parse a vendor's reply.

```typescript
interface RecordVendorReplyInput {
  request_id: string;
  vendor_id: string;
  message: string;
  provider_message_id: string;
  parsed_data?: {
    has_stock: boolean;
    price?: number;
    availability?: string;
    notes?: string;
  };
}

interface RecordVendorReplyOutput {
  success: boolean;
  outreach_id: string;
  state: MoltbotVendorOutreachState; // now 'replied'
}
```

---

### 6. marketplace.create_ocr_job

Queue an image/document for OCR processing.

```typescript
interface CreateOcrJobInput {
  request_id: string;
  message_id: string;
  media_url: string;
  media_type: string; // mime type
}

interface CreateOcrJobOutput {
  job_id: string;
  status: 'pending' | 'processing';
}
```

---

### 7. marketplace.get_ocr_result

Get OCR job status/result.

```typescript
interface GetOcrResultInput {
  job_id: string;
}

interface GetOcrResultOutput {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted?: Record<string, unknown>;
  confidence?: number;
  error?: string;
}
```

---

### 8. marketplace.request_call_consent

Request permission to call the client.

```typescript
interface RequestCallConsentInput {
  request_id: string;
  scope: string; // e.g., 'concierge', 'support'
  reason: string; // shown to client
}

interface RequestCallConsentOutput {
  consent_id: string;
  state: 'requested';
  message_sent: boolean;
}
```

---

### 9. marketplace.start_call

Initiate WhatsApp call (requires valid consent).

```typescript
interface StartCallInput {
  consent_id: string;
}

interface StartCallOutput {
  success: boolean;
  call_attempt_id?: string;
  provider_call_id?: string;
  error?: string;
}
```

> **Gate:** Fails if consent state is not `granted` or is expired.

---

### 10. marketplace.update_request_state

Transition request to new state.

```typescript
interface UpdateRequestStateInput {
  request_id: string;
  new_state: MoltbotRequestState;
  reason?: string;
  fallback_message?: string; // for error state
}

interface UpdateRequestStateOutput {
  success: boolean;
  previous_state: MoltbotRequestState;
  current_state: MoltbotRequestState;
  error?: string; // if invalid transition
}
```

> **Gate:** Validates transition against `MOLTBOT_STATE_TRANSITIONS`.

---

## Common Headers

Every tool call includes:

```typescript
interface ToolCallMeta {
  request_id: string;
  idempotency_key: string;
  actor: 'moltbot' | 'system' | 'admin';
  timestamp: string; // ISO 8601
}
```

## Audit Contract

Every tool call produces an audit record:

```typescript
interface ToolAuditRecord {
  id: string;
  request_id: string;
  tool_name: string;
  input_hash: string; // SHA256 of JSON input
  output_hash: string; // SHA256 of JSON output
  success: boolean;
  duration_ms: number;
  error?: string;
  created_at: string;
}
```

---

### 11. discovery.web_search_items

Fetch anonymized web search results (OpenAI or Gemini) for a chat post and persist them as `external_feed_items` (gadgets for the chat UI).

```typescript
interface DiscoveryWebSearchItemsInput {
  post_id: string;
  need: string;
  category?: string;
  location_text?: string;
  engine?: 'openai' | 'gemini' | 'auto';
  max_results?: number;
}

interface ExternalFeedItem {
  feed_item_id: string;
  source: 'openai_web_search' | 'gemini_google_grounding';
  title: string;
  snippet?: string;
  url: string;
  phone?: string;
  location_text?: string;
  confidence?: number;
}

interface DiscoveryWebSearchItemsOutput {
  engine: 'openai' | 'gemini' | 'none';
  feed_items: ExternalFeedItem[];
  disabled?: boolean;
  reason?: string;
}
```

> **Gates:** Requires `EXTERNAL_DISCOVERY_ENABLED`; budgets capped by `DISCOVERY_MAX_CALLS_PER_REQUEST` (max 2 per post) and deduplicated by `(post_id, source, url)`.

---

### 12. discovery.maps_places_items

Use Google Maps Places grounding to capture nearby vendors for a web post and store the results as `external_feed_items`.

```typescript
interface DiscoveryMapsPlacesItemsInput {
  post_id: string;
  need: string;
  location_text?: string;
  radius_km?: number;
  max_results?: number;
}

interface DiscoveryMapsPlacesItemsOutput {
  feed_items: ExternalFeedItem[];
  disabled?: boolean;
  reason?: string;
}
```

> **Gates:** Requires `MAPS_ENRICHMENT_ENABLED`; budgets obey `MAPS_MAX_CALLS_PER_REQUEST`. Results tagged with `source = 'maps_places'`.

---

### 13. discovery.social_profile_items

Surface social-media profile matches (LinkedIn/Instagram/X etc.) for a post and persist them for UI cards.

```typescript
interface DiscoverySocialProfileItemsInput {
  post_id: string;
  need: string;
  category?: string;
  location_text?: string;
  engine?: 'openai' | 'gemini' | 'auto';
  max_results?: number;
}

interface DiscoverySocialProfileItemsOutput {
  engine: 'openai' | 'gemini' | 'none';
  feed_items: ExternalFeedItem[];
  disabled?: boolean;
  reason?: string;
}
```

> **Gates:** Requires both `EXTERNAL_DISCOVERY_ENABLED` and `SOCIAL_DISCOVERY_ENABLED`; shares the `DISCOVERY_MAX_CALLS_PER_REQUEST` budget. Results tagged with `source = 'social'`.
