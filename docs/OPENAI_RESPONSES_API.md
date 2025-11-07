# OpenAI Responses API Reference

This guide documents how EasyMO services interact with the OpenAI Responses API. It consolidates supported endpoints, required parameters, and example payloads to help engineers wire new workflows or troubleshoot existing integrations.

## Base URL

```
https://api.openai.com/v1
```

All requests must include an `Authorization: Bearer <OPENAI_API_KEY>` header and, when sending JSON bodies, `Content-Type: application/json`.

## Endpoint Summary

| Endpoint | Description |
| --- | --- |
| `POST /responses` | Create a new model response. Supports streaming, tool invocation, JSON or text outputs, and custom instructions. |
| `GET /responses/{response_id}` | Retrieve the full response payload for a previously created response. |
| `DELETE /responses/{response_id}` | Delete a stored response. |
| `POST /responses/{response_id}/cancel` | Cancel an in-flight response that was created with the `background` flag. |
| `GET /responses/{response_id}/input_items` | List the input items (messages, files, etc.) that were part of the request. |
| `POST /responses/input_tokens` | Return the token count for a potential request without executing the model. |

## Create a Response (`POST /responses`)

Create new text or JSON output, optionally invoking tools or streaming results.

### Core Parameters

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `model` | string | *required* | Model to run, e.g. `gpt-4o`, `gpt-5`, or `o3`. |
| `input` | string or array | `null` | Text, image URLs, or file references that supply context. |
| `instructions` | string | `null` | Additional system/developer message injected ahead of the input. |
| `conversation` | string or object | `null` | Attach to or extend an existing conversation. |
| `tools` | array | `[]` | Functions, built-in tools, or MCP connectors available to the model. |
| `tool_choice` | string or object | `auto` | Force a specific tool or disable tool use. |
| `temperature` | number | `1` | Sampling temperature (0–2). |
| `top_p` | number | `1` | Nucleus sampling alternative to `temperature`. |
| `max_output_tokens` | integer | `null` | Hard limit for generated tokens (visible + reasoning). |
| `max_tool_calls` | integer | `null` | Caps the total number of tool invocations. |
| `parallel_tool_calls` | boolean | `true` | Allow the model to execute tool calls in parallel. |
| `stream` | boolean | `false` | Return Server Sent Events as the response is generated. |
| `stream_options` | object | `null` | Configure streamed responses (e.g., include logprobs). |
| `background` | boolean | `false` | Run the response asynchronously; use `cancel` to abort. |
| `service_tier` | string | `auto` | Override the project default (`default`, `flex`, `priority`). |
| `store` | boolean | `true` | Persist the response for later retrieval. |
| `metadata` | map | `{}` | Up to 16 key/value pairs for custom tracking. |
| `prompt_cache_key` | string | `null` | Hint for OpenAI caching to boost hit rates. |

Additional nested options exist for structured text output (`text`), reasoning controls (`reasoning`), and JSON prompt templates (`prompt`).

### Example

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4.1",
    "input": "Tell me a three sentence bedtime story about a unicorn."
  }'
```

The API returns a `response` object containing output items (assistant messages, tool calls, etc.), usage metrics, and request metadata.

### Tool Invocation

When exposing tools, provide their JSON schemas in `tools`. The model can emit tool call items; the caller must execute the tool and feed results back with `responses.submitToolOutputs`. Limit tool usage via `max_tool_calls` or by setting `tool_choice` explicitly.

### Streaming

Enable streaming with `stream: true`. Each SSE event yields deltas for model output, tool calls, or reasoning steps. Use `stream_options` to include logprobs or obfuscation controls.

## Retrieve a Response (`GET /responses/{response_id}`)

Fetch a stored response after creation:

```bash
curl https://api.openai.com/v1/responses/resp_123 \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

The returned payload matches the shape of the original create response, including output items, metadata, and usage totals.

## Delete a Response (`DELETE /responses/{response_id}`)

Remove a stored response when it is no longer needed:

```bash
curl -X DELETE https://api.openai.com/v1/responses/resp_123 \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

The service replies with `{ "id": "resp_123", "deleted": true }` on success.

## Cancel a Background Response (`POST /responses/{response_id}/cancel`)

For responses started with `background: true`, issue a cancel request:

```bash
curl -X POST https://api.openai.com/v1/responses/resp_123/cancel \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Cancellation returns the final response object, with `status` reflecting the terminal state.

## List Input Items (`GET /responses/{response_id}/input_items`)

Inspect the original input items that seeded a response:

```bash
curl https://api.openai.com/v1/responses/resp_abc123/input_items \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

The response is a list with pagination metadata (`first_id`, `last_id`, `has_more`).

## Estimate Input Tokens (`POST /responses/input_tokens`)

Request token counts prior to execution:

```bash
curl -X POST https://api.openai.com/v1/responses/input_tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5",
    "input": "Tell me a joke."
  }'
```

The service responds with an `input_tokens` integer summarising token usage for the provided input, helpful for quota checks or streaming budgets.

## Usage Notes

- Responses default to storage; set `store: false` for ephemeral generations.
- Use `previous_response_id` to supply follow-up prompts without resending context, or pass a `conversation` object to stitch multi-turn histories.
- The `include` query/body parameter adds supplementary data to returned responses (e.g., tool output artifacts, logprobs).
- For auditability, populate `metadata` with identifiers (workflow ID, customer ID) — values are strings up to 512 characters.
- Combine `background: true` with webhook callbacks (via `metadata` or conversation state) to build async pipelines without blocking clients.

Refer to the OpenAI platform docs for model-specific capabilities (vision, function calling limits, reasoning modes) and rate limits.

## Response Object Anatomy

Every successful call returns a `response` envelope that contains both the model output and operational metadata:

- `id`: Stable identifier that downstream services can persist for auditing or retries.
- `status`: Final state of the run (`completed`, `in_progress`, `failed`, `queued`, `cancelled`, or `incomplete`).
- `output`: Ordered list of items—assistant messages, tool calls, images, or reasoning traces depending on the request.
- `usage`: Token accounting split into `input_tokens`, `output_tokens`, and optional `reasoning_tokens` when using reasoning models.
- `parallel_tool_calls`: Indicates whether the run attempted concurrent tool execution (useful for debugging deterministic flows).
- `service_tier`: Echoes the tier that actually processed the request when `service_tier` is set to `auto`.

Persist the entire payload when workflows must be replayable; otherwise, store the `id` plus enough metadata to re-fetch when needed.

## Error Handling & Retries

The API responds with standard HTTP status codes:

- `400 Bad Request` – malformed payloads, unsupported parameters, or context window overruns.
- `401/403` – authentication or project access issues; confirm the API key and project entitlements.
- `429 Too Many Requests` – rate limit throttle; respect the `retry-after` header before retrying.
- `500+` – transient platform errors; use exponential backoff with jitter and cap total retry time.

For background jobs, poll `GET /responses/{response_id}` or subscribe to your queueing mechanism before retrying to avoid duplicate work.

## Security & Operational Tips

- Rotate API keys regularly and scope them to the minimum set of models required by the service.
- Log `response.metadata` together with internal workflow identifiers so that security investigations can cross-reference requests.
- When handling PII or regulated data, combine `store: false` with downstream redaction to prevent persistence in OpenAI's storage.
- Capture `usage` metrics per tenant to reconcile costs and catch unexpected spikes early.

## Response Payload Example

```json
{
  "id": "resp_67ccd2bed1ec8190b14f964abc0542670bb6a6b452d3795b",
  "object": "response",
  "created_at": 1741476542,
  "status": "completed",
  "model": "gpt-4.1-2025-04-14",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "In a peaceful grove beneath a silver moon..."
        }
      ]
    }
  ],
  "parallel_tool_calls": true,
  "usage": {
    "input_tokens": 36,
    "output_tokens": 87,
    "total_tokens": 123,
    "output_tokens_details": {
      "reasoning_tokens": 0
    }
  },
  "metadata": {},
  "text": {
    "format": { "type": "text" }
  }
}
```

### Field Reference

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable identifier that downstream services should persist for audit logs and reruns. |
| `object` | string | Always `response`; useful for envelope validation. |
| `created_at` | number | Unix epoch seconds when the response was created. |
| `status` | string | Terminal state (`completed`, `failed`, `in_progress`, `queued`, `cancelled`, `incomplete`). |
| `model` | string | Echo of the model actually used, including revision tags. |
| `output` | array | Ordered list of response items (messages, tool calls, images, reasoning traces). |
| `parallel_tool_calls` | boolean | Indicates whether the run attempted concurrent tool execution. |
| `usage` | object | Token accounting plus optional reasoning breakdown. |
| `metadata` | map | Custom key/value pairs sent at request time; returned unmodified. |
| `text` | object | Present when structured text options were supplied. |

### Output Item Types

| Item Type | Description | Action Items |
| --- | --- | --- |
| `message` | Assistant or tool messages. | Render in chat transcripts or pipe to workflow handlers. |
| `tool_call` | Invocation request for a registered tool. | Execute the tool, then respond with `responses.submitToolOutputs`. |
| `error` | Model-surfaced failure details. | Log and propagate to telemetry; inspect `error.code` and `error.message`. |
| `reasoning` | o-series reasoning traces. | Optionally store for debugging; may contain sensitive intermediate steps. |

### Usage Metrics

`usage` returns both aggregate and detailed counters. Persist per-tenant to power chargeback reports and to catch regressions. When using reasoning models, inspect `output_tokens_details.reasoning_tokens` to gauge additional billing impact.

## Error Response Envelope

Errors follow the standard OpenAI API structure:

```json
{
  "error": {
    "code": "invalid_request_error",
    "message": "Model gpt-foo does not exist",
    "param": "model",
    "type": "invalid_request_error"
  }
}
```

### Operational Guidance

- Retry `rate_limit_exceeded` and `server_error` codes with exponential backoff (initial delay 2s, multiplier 2.0, max 32s).
- Do not retry `invalid_request_error` or `authentication_error` — surface to support dashboards immediately.
- When the API returns streaming errors, the final SSE frame carries the same envelope; capture and normalize before logging.

## Integration Checklist for EasyMO Services

1. Inject `OPENAI_API_KEY` via the EasyMO secrets manager; never bake into build artifacts.
2. Include `metadata.workflow_id`, `metadata.tenant_id`, and `metadata.region` so observability dashboards can segment usage.
3. Store raw responses in the analytics warehouse when `store: true`; otherwise persist the `id` and fetch-on-demand.
4. When invoking background runs, enqueue the `response_id` into the async worker queue and gate retries on the fetch status.
5. For Netlify deployments, whitelist `api.openai.com` in the outgoing network policy and confirm environment variables in the project dashboard.

## Conversation & Session Management

- **Threading follow-ups:** Use `conversation` objects to stitch multi-step workflows without resending all prior context. Persist the `conversation.id` alongside your EasyMO job identifier so workers can retrieve the correct history.
- **Stateless resume:** When replaying traffic or debugging a single turn, prefer `previous_response_id` so the platform automatically preloads prior input items.
- **Selective truncation:** Set `truncation: "auto"` to allow OpenAI to drop the oldest items when you approach the model's context window, while logging dropped message IDs to maintain auditability.
- **Privacy filters:** Run outbound prompts through EasyMO's redaction middleware before attaching files or raw transcripts to `input` entries, especially for customer escalations.

## Background Jobs & Webhooks

- Combine `background: true` with an EasyMO job queue so UI threads can enqueue work and return immediately to the customer.
- Deliver completion webhooks by storing the `response_id` and correlating it with internal job tickets; workers should poll `GET /responses/{response_id}` until `status` transitions to a terminal state.
- Guard against duplicate execution by recording a idempotency key in `metadata.idempotency_key` and short-circuiting if a matching run already completed.
- When cancelling, emit a compensating event in the queue (e.g., `responses.cancelled`) so downstream processors can reconcile partial work.

## Node.js Integration Example

```ts
import fetch from "node-fetch";

export async function createUnicornStory() {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input: "Tell me a three sentence bedtime story about a unicorn.",
      metadata: {
        workflow_id: "storybook",
        tenant_id: "demo",
      },
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`OpenAI request failed: ${error.error?.message ?? res.status}`);
  }

  const response = await res.json();
  return response.output?.[0]?.content?.[0]?.text ?? "";
}
```

Wrap this helper in EasyMO's service layer so React/Next.js clients issue typed RPC calls instead of hitting OpenAI directly. Capture `response.usage` for chargeback reporting and append to your analytics pipeline.

## Streaming from the Browser

When running on Netlify edge or the browser, consume Server Sent Events to progressively render assistant output:

```ts
export async function streamResponse(signal?: AbortSignal) {
  const res = await fetch("/api/openai/responses", { method: "POST", signal });
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let done = false;

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) {
      const text = decoder.decode(chunk.value, { stream: true });
      text
        .split("\n\n")
        .filter(Boolean)
        .forEach((event) => {
          if (!event.startsWith("data:")) return;
          const payload = JSON.parse(event.slice(5));
          // Dispatch to UI reducers or append to chat transcript
          window.dispatchEvent(new CustomEvent("openai-delta", { detail: payload }));
        });
    }
  }
}
```

Expose this helper behind an `/api/openai/responses` route that forwards `stream: true` calls to OpenAI and relays SSE frames to the client. Always guard the route with session checks and rate limiting to prevent abuse.
