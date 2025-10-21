# File Search Tool Guide

## Overview
The file search tool lets Responses API conversations look up relevant snippets from your uploaded knowledge base before the model drafts a reply. It issues semantic and keyword lookups against the vector stores you specify and cites the files that influenced the answer, helping the model ground its responses in the latest project documentation.

## Prerequisites
1. Create a vector store that contains the documents you want the model to reference.
2. Upload files to that vector store so they are available for retrieval.
3. Pass the vector store identifier when you enable the tool for a Responses API call.

## Basic Usage
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-4.1",
    input="What is deep research by OpenAI?",
    tools=[{
        "type": "file_search",
        "vector_store_ids": ["<vector_store_id>"]
    }]
)
print(response)
```
When the tool is active, the API returns both the generated message and a record of the search that ran. The message includes inline citations that indicate which uploaded files were consulted.

## Limiting Result Volume
Control latency and token usage by capping the number of retrieved chunks:
```python
response = client.responses.create(
    model="gpt-4.1",
    input="What is deep research by OpenAI?",
    tools=[{
        "type": "file_search",
        "vector_store_ids": ["<vector_store_id>"],
        "max_num_results": 2
    }]
)
```
Reducing the maximum results may omit useful passages, so balance the limit against answer quality requirements.

## Inspecting Search Results
Set `include=["file_search_call.results"]` to receive the raw search hits alongside the model response. This is useful for debugging or for persisting the retrieved passages in your own application logs.

## Metadata Filters
Filter retrieval to specific file subsets by applying metadata predicates defined on the uploaded files:
```python
response = client.responses.create(
    model="gpt-4.1",
    input="What is deep research by OpenAI?",
    tools=[{
        "type": "file_search",
        "vector_store_ids": ["<vector_store_id>"],
        "filters": {
            "type": "in",
            "key": "category",
            "value": ["blog", "announcement"]
        }
    }]
)
```

## Supported File Types
File search supports plain text, code, Microsoft Office, PDF, and several other common formats. Text assets must use UTF-8, UTF-16, or ASCII encodings. See the official retrieval guide for the full list of MIME types.

## Operational Considerations
- Stick to the Responses API rate limits (100 RPM on tier 1, 500 RPM for tiers 2–3, 1000 RPM for tiers 4–5).
- Monitor token usage, especially when requesting large result sets or combining file search with other tools.
- You do not need to run or host the retrieval pipeline yourself—the managed tool executes remotely within OpenAI infrastructure.

## Multi-Store Retrieval Patterns
When you maintain separate knowledge bases (for example, onboarding materials and API specs), you can query multiple stores in a single call. The model will merge the retrieved context before responding:
```python
response = client.responses.create(
    model="gpt-4.1", 
    input="Summarize our OAuth onboarding checklist", 
    tools=[{
        "type": "file_search",
        "vector_store_ids": [
            onboarding_store_id,
            api_spec_store_id,
        ],
    }],
)
```
To fine-tune relevance, tag documents with metadata (e.g., `{"team": "platform"}`) and pair multi-store retrieval with filters so only the appropriate passages are surfaced for each request.

## Streaming Responses with Citations
File search works with streaming Responses API calls. Request a stream to start rendering output while retrieval completes in the background:
```python
with client.responses.stream(
    model="gpt-4.1",
    input="Draft a changelog entry for the payments release",
    tools=[{"type": "file_search", "vector_store_ids": [release_notes_store_id]}],
) as stream:
    for event in stream:
        if event.type == "response.citation_delta":
            handle_citation_update(event)
        elif event.type == "response.output_text.delta":
            render_text(event.delta)
```
The `response.citation_delta` events arrive as soon as supporting documents are identified, allowing UI layers to show “source cards” incrementally while the text is being generated.

## Production Readiness Checklist
- **Alerting:** Capture file search latency and error metrics so you can respond to provider incidents or quota exhaustion.
- **Backoff policy:** Implement retries with exponential backoff for transient `429` (rate limit) or `5xx` errors, and log correlation IDs returned in the API response headers for troubleshooting.
- **Redaction:** Pre-process uploads to strip secrets or personal data—retrieved content is echoed back to the user verbatim.
- **Access control:** Restrict vector store IDs by tenant or environment to prevent cross-team data leakage in multi-tenant apps.
- **Caching:** Cache high-volume prompts and their grounded answers when compliance allows it, reducing load on the retrieval pipeline and lowering latency for repeated questions.

## JavaScript Quick Start
```typescript
import OpenAI from "openai";

const client = new OpenAI();

async function answerWithSources(prompt: string) {
  const response = await client.responses.create({
    model: "gpt-4.1",
    input: prompt,
    tools: [
      {
        type: "file_search",
        vector_store_ids: [process.env.ONBOARDING_STORE_ID!, process.env.API_SPEC_STORE_ID!],
        filters: {
          type: "in",
          key: "region",
          value: ["us"],
        },
      },
    ],
  });

  const answer = response.output_text;
  const citations = response.output?.[0]?.content?.flatMap((item: any) => item.annotations ?? []) ?? [];

  return { answer, citations };
}
```
The JavaScript SDK mirrors the Python surface area—pass an array of `vector_store_ids`, and include optional filters to scope retrieval to the correct tenant or geography. The returned object exposes both the composed text and any citation metadata so you can surface sources in your UI.

## Failure Handling Patterns
- **Graceful degradation:** If the file search tool is temporarily unavailable, fall back to a cached answer or a template that asks the user to retry. Maintain a timeout so that primary workflows continue even when retrieval is slow.
- **Selective retries:** Retry only idempotent requests that return `429` or `5xx` statuses. For deterministic errors like `400` (bad filters) surface a developer alert rather than hammering the API.
- **User messaging:** Propagate correlation IDs to client logs and display human-friendly error messages when citations cannot be generated. This builds trust while keeping production metrics actionable.

## Observability Checklist
- Log the `file_search_call` payload whenever you include raw results, and ship those logs to your observability stack for query volume tracking.
- Record latency percentiles (P50/P95/P99) per vector store so you can pinpoint slow stores or unexpectedly large documents.
- Add alerts that fire when file search citation counts drop to zero for popular prompts—this often indicates a misconfigured filter or expired vector store ID.

## Launch Readiness Questions
- Have you validated that every supported tenant has the expected files uploaded to its vector store?
- Are rate limits for the Responses API reflected in your autoscaling and retry configuration?
- Do you have a data retention policy that covers both the uploaded files and the logs that contain retrieved snippets?
- Is there an incident playbook that outlines how to rotate credentials, pause ingestion, or roll back to a previous dataset if corrupted content is detected?
