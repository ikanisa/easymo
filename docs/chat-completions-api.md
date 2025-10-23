# OpenAI Chat Completions API Reference

This document captures the structure and operational guidance for working with OpenAI's Chat Completions REST API. Use it as a reference when integrating conversational and multimodal models into Easymo services, CLIs, or test harnesses.

## Endpoint Summary

| HTTP Method | Path | Description |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | Create a model response given a multi-message conversation context. |
| `GET` | `/v1/chat/completions/{completion_id}` | Retrieve a stored chat completion (requires the original request to set `store: true`). |
| `GET` | `/v1/chat/completions/{completion_id}/messages` | Fetch the stored messages that composed a completion request. |
| `GET` | `/v1/chat/completions` | List stored chat completions. |
| `POST` | `/v1/chat/completions/{completion_id}` | Update metadata for a stored chat completion. |
| `DELETE` | `/v1/chat/completions/{completion_id}` | Delete a stored chat completion. |

> **Tip:** The platform team recommends using the newer **Responses** API for greenfield builds, but Chat Completions remains widely used, especially when exercising legacy function calling flows or using SDKs without Responses bindings.

## Creating a Chat Completion

`POST https://api.openai.com/v1/chat/completions`

**Required fields**

- `model`: Target model identifier (for example, `gpt-4o` or a reasoning model like `o3`).
- `messages`: Array describing the conversation history. Message content can mix modalities depending on the model (text, images, audio).

**Common options**

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `frequency_penalty` | number | `0` | Range `[-2, 2]`; discourages repetition when positive. |
| `logit_bias` | object | `null` | Map token IDs to bias adjustments `[-100, 100]`. |
| `logprobs` | boolean | `false` | When `true`, returns per-token log probabilities. |
| `max_completion_tokens` | integer | `null` | Hard cap on generated tokens (use instead of deprecated `max_tokens`). |
| `metadata` | object | `{}` | Up to 16 key-value pairs for downstream analytics. |
| `modalities` | array | `['text']` | Enables multi-output modes (e.g., `['text', 'audio']` for `gpt-4o-audio-preview`). |
| `n` | integer | `1` | Number of choices; be aware of token-based billing per choice. |
| `parallel_tool_calls` | boolean | `true` | Allows concurrent tool invocations. |
| `prediction` | object | `null` | Provide known output fragments to lower latency. |
| `presence_penalty` | number | `0` | Range `[-2, 2]`; encourages new topics when positive. |
| `prompt_cache_key` | string | — | Enables prompt caching (supersedes `user`). |
| `reasoning_effort` | string | `medium` | For reasoning models (`minimal`, `low`, `medium`, `high`). |
| `response_format` | object | `null` | Force JSON output via `{ type: 'json_schema', json_schema: {...} }` or `{ type: 'json_object' }`. |
| `safety_identifier` | string | — | Stable hashed user identifier for safety heuristics. |
| `service_tier` | string | `auto` | Choose between `auto`, `default`, `flex`, or `priority`. |
| `stop` | string / array | `null` | Up to four stop sequences. Not supported on `o3`/`o4-mini`. |
| `store` | boolean | `false` | Persist the completion for later retrieval. Required for list/get/update/delete operations. |
| `stream` | boolean | `false` | Enable Server-Sent Events streaming. |
| `temperature` | number | `1` | Sampling temperature. Adjust alongside or instead of `top_p`. |
| `tool_choice` | string / object | `auto` | Lock, disable, or force specific tool calls. |
| `tools` | array | `[]` | Declare tool schemas (legacy `functions` is deprecated). |
| `top_logprobs` | integer | — | Top-N token probabilities (0–20). |
| `top_p` | number | `1` | Nucleus sampling parameter. |
| `verbosity` | string | `medium` | Controls verbosity of reasoning models (`low`, `medium`, `high`). |
| `web_search_options` | object | `null` | Configure web search tool usage when available. |

**Deprecated fields**

- `function_call` and `functions` (use `tool_choice` and `tools`).
- `max_tokens` (use `max_completion_tokens`).
- `seed` (beta, determinism not guaranteed; monitor `system_fingerprint`).
- `user` (use `prompt_cache_key` or `safety_identifier`).

### Example request

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5",
    "messages": [
      { "role": "developer", "content": "You are a helpful assistant." },
      { "role": "user", "content": "Hello!" }
    ]
  }'
```

### Example response

```json
{
  "id": "chatcmpl-B9MBs8CjcvOU2jLn4n570S5qMJKcT",
  "object": "chat.completion",
  "created": 1741569952,
  "model": "gpt-4.1-2025-04-14",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I assist you today?",
        "refusal": null,
        "annotations": []
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 19,
    "completion_tokens": 10,
    "total_tokens": 29
  },
  "service_tier": "default"
}
```

## Working with Stored Completions

When `store: true` is set, the platform persists the completion and exposes read/write lifecycle endpoints. This is useful for audit logging or for building admin tooling that can replay conversations.

- **Retrieve a completion:** `GET /v1/chat/completions/{completion_id}`
- **List completions:** `GET /v1/chat/completions`
- **Fetch messages:** `GET /v1/chat/completions/{completion_id}/messages`
- **Update metadata:** `POST /v1/chat/completions/{completion_id}` with `{ "metadata": { ... } }`
- **Delete completion:** `DELETE /v1/chat/completions/{completion_id}`

Each response mirrors the original completion object and includes token usage, parameters, and any metadata applied during creation or updates.

## Streaming Responses

Set `stream: true` to receive incremental `chat.completion.chunk` payloads via Server-Sent Events. Each chunk shares the same `id`, `created`, and `model`. The `choices` array emits deltas until `finish_reason` equals `stop`. Enable `stream_options: { "include_usage": true }` to append a final chunk with aggregated token usage.

## Tooling & Function Calling

Chat Completions supports JSON schema-based tool definitions through the `tools` field. When the model triggers a tool call, the response contains a `tool_calls` array with JSON arguments. Reply using `tool_choice` to constrain or force execution, or set `tool_choice: "none"` to disable tool calls entirely.

> **Parallel tool calls** are enabled by default (`parallel_tool_calls: true`). Disable this if backend services cannot handle concurrent requests.

## Migration Guidance

- Prefer the Responses API for new agents where you need deterministic tool orchestrations, multimodal IO, or stateful sessions.
- Continue using Chat Completions for backwards compatibility with SDKs or workflows that expect the `choices` array payload shape.
- Review rate limits per model and service tier. `flex` and `priority` tiers can provide higher throughput at increased cost.

## Troubleshooting Checklist

1. **Invalid model error** – Verify entitlements or switch to an available base model (`gpt-4o`, `gpt-4o-mini`).
2. **Tool schema mismatch** – Ensure `tools` definitions align with JSON schema expectations and that the model actually supports tool calling.
3. **Streaming stalls** – Confirm the HTTP client handles SSE correctly and that no corporate proxy strips the `text/event-stream` response.
4. **Token overruns** – Combine `max_completion_tokens` with `stream: true` so the client can abort when approaching limits.
5. **Stored completion missing** – Remember to set `store: true` during creation; otherwise lookup endpoints will return 404.

## Authentication & Headers

- Always pass a valid **secret key** via the `Authorization: Bearer <token>` header. Runtime environments should source this value from Supabase, the hosting secret store, or local `.env` secrets rather than hard-coding keys.
- Set `OpenAI-Beta: assistants=v2` only when targeting beta functionality. Leaving experimental headers enabled in production traffic may cause unexpected behavior when the beta program ends.
- When working inside the browser (e.g., Next.js app routes), proxy requests through the Easymo API tier to avoid exposing private keys to clients.

## Conversation Assembly Tips

- Compose the `messages` array with `system`, `developer`, and `user` roles before appending `assistant` turns. This keeps guardrails stable and enables deterministic audit logs.
- Prefer short, task-focused instructions. When a flow requires lengthy domain context, store reusable context snippets in Supabase and hydrate conversations dynamically.
- For multimodal inputs, make sure assets are pre-signed URLs reachable by OpenAI. Local file paths from build artifacts will fail unless uploaded to object storage first.

## Error Surfaces & Retries

| HTTP Status | Typical Cause | Recommended Remediation |
| --- | --- | --- |
| `400` | Invalid schema, missing `model`, malformed `messages` | Log validation errors, run schema tests in CI before deploy. |
| `401` | Invalid API key or key missing required scope | Rotate credentials, check hosting secret names. |
| `429` | Rate limit exceeded | Back off with exponential retry and monitor the `x-ratelimit-*` headers. |
| `500/502/503` | Transient platform issue | Retry with jitter. Escalate to OpenAI support if outages persist > 5 minutes. |

Implement retries with circuit breakers on the server so the client UI (web or mobile) receives a friendly fallback state instead of a raw 5xx.

## Streaming Implementation Example

```typescript
import { createParser } from 'eventsource-parser';

export async function streamChatCompletion(req: Request) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      messages: req.messages,
    }),
  });

  const parser = createParser(event => {
    if (event.type === 'event' && event.data !== '[DONE]') {
      const chunk = JSON.parse(event.data);
      req.controller.enqueue(chunk.choices?.[0]?.delta?.content ?? '');
    }
  });

  for await (const chunk of response.body as any) {
    parser.feed(new TextDecoder().decode(chunk));
  }
}
```

This pattern matches the Next.js App Router stream utilities we deploy in the self-hosted admin app. Ensure the `Request` object above carries an `AbortController` so users can cancel long generations.

## Observability & Logging

- Include the OpenAI `request_id` and Easymo session identifier in structured logs to correlate slowdowns across services.
- Emit latency histograms and token usage counters to our Grafana dashboards. These numbers help finance forecast monthly OpenAI spend.
- Capture the prompt **shape** (hash of prompt text and tool schema) rather than raw content to remain compliant with privacy requirements.

## Rollout Checklist for Self-Hosted Deploys

1. Add or update `OPENAI_API_KEY` secrets in the hosting secret store for each environment (`staging`, `production`).
2. Run integration tests (`pnpm test --filter @easymo/app --runInBand`) to confirm the UI still renders completion responses.
3. Verify streaming endpoints locally with `pnpm dev` before promoting the commit to the main branch.
4. Tag the release in `CHANGELOG.md` once smoke tests pass and the deployment is live.

These steps ensure the documentation matches the operational playbook expected by our incident response and deployment teams.

## Change Log

- **2025-03-10** – Document created with parameter table refresh and explicit migration guidance.
