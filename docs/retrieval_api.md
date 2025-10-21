# Retrieval API Guide

This guide explains how to work with OpenAI's Retrieval API using vector stores for semantic search. It covers creating stores, uploading files, searching, tuning queries, and managing stored content so that application code can surface relevant knowledge efficiently.

## Quickstart Workflow

1. **Create a vector store.**
   ```python
   from openai import OpenAI
   client = OpenAI()

   vector_store = client.vector_stores.create(name="Support FAQ")
   ```
2. **Upload a file and wait for ingestion to finish.**
   ```python
   client.vector_stores.files.upload_and_poll(
       vector_store_id=vector_store.id,
       file=open("customer_policies.txt", "rb"),
   )
   ```
3. **Issue a semantic search query.**
   ```python
   results = client.vector_stores.search(
       vector_store_id=vector_store.id,
       query="What is the return policy?",
   )
   ```

## Performing Semantic Search

Semantic search uses embeddings to match conceptually similar text, even when there are few overlapping keywords. Query the vector store with natural language and review the ranked results (10 by default, up to 50 with `max_num_results`). Each result includes the file, similarity score, and chunked content that triggered the match.

### Example Response Structure

```json
{
  "object": "vector_store.search_results.page",
  "search_query": "How many woodchucks are allowed per passenger?",
  "data": [
    {
      "file_id": "file-12345",
      "filename": "woodchuck_policy.txt",
      "score": 0.85,
      "attributes": {
        "region": "North America",
        "author": "Wildlife Department"
      },
      "content": [
        {"type": "text", "text": "According to the latest regulations, each passenger is allowed to carry up to two woodchucks."},
        {"type": "text", "text": "Ensure that the woodchucks are properly contained during transport."}
      ]
    }
  ],
  "has_more": false
}
```

### Query Rewriting

Set `rewrite_query=True` to let the API automatically refine the search string for better recall. The rewritten query is returned in the `search_query` field.

### Attribute Filtering

Filter results before searching by adding `attribute_filter`. Combine comparison and compound operators to constrain searches by metadata such as region, date, or filename.

```json
{
  "type": "and",
  "filters": [
    {"type": "eq", "key": "region", "value": "us"},
    {"type": "gte", "key": "date", "value": 1672531200}
  ]
}
```

### Ranking Controls

Tune ranking with `ranking_options`. Choose a ranker (`auto` or `default-2024-08-21`) and optionally set `score_threshold` (0.0–1.0) to drop low-confidence matches.

## Managing Vector Stores

Vector stores index files by chunking and embedding their contents.

### Storage and Pricing

- Up to 1 GB across all stores is free.
- Beyond 1 GB costs $0.10 per GB per day.
- Set expiration policies to automatically delete idle stores and reduce costs.

### Chunking Defaults

Files are chunked into 800-token segments with a 400-token overlap. Customize this via `chunking_strategy` (100–4096 tokens per chunk, overlap ≤ 50%).

### Supported File Size Limits

- Maximum file size: 512 MB.
- Maximum tokens per file: 5,000,000.

## Vector Store Operations

| Operation | Description |
| --- | --- |
| `vector_stores.create` | Create a new store (optionally seeding with file IDs). |
| `vector_stores.retrieve/update/delete/list` | Manage lifecycle of stores. |
| `vector_stores.files.upload_and_poll` | Upload and index a file, blocking until ingestion completes. |
| `vector_stores.files.create` | Attach existing uploaded files with optional attributes. |
| `vector_stores.file_batches.create_and_poll` | Batch associate multiple files. |
| `vector_stores.files.delete` | Remove a file from a store. |

Each vector store file can store up to 16 attribute keys (≤ 256 characters per key) for later filtering.

### Example File Attachment with Attributes

```python
client.vector_stores.files.create(
    vector_store_id=vector_store.id,
    file_id="file_123",
    attributes={
        "region": "US",
        "category": "Marketing",
        "date": 1672531200,
    },
)
```

## Expiration Policies

Use `expires_after` to expire stores relative to `created_at` or `last_active_at`.

```python
client.vector_stores.update(
    vector_store_id=vector_store.id,
    expires_after={
        "anchor": "last_active_at",
        "days": 7,
    },
)
```

## Synthesizing Answers with Search Results

Feed formatted search chunks into a model (for example `gpt-4.1`) to generate grounded responses.

```python
formatted_results = format_results(results)

completion = client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "developer", "content": "Produce a concise answer to the query based on the provided sources."},
        {
            "role": "user",
            "content": f"Sources: {formatted_results}\n\nQuery: '{user_query}'",
        },
    ],
)

print(completion.choices[0].message.content)
```

Example `format_results` helper:

```python
def format_results(results):
    formatted_results = ""
    for result in results.data:
        formatted_result = f"<result file_id='{result.file_id}' file_name='{result.file_name}'>"
        for part in result.content:
            formatted_result += f"<content>{part.text}</content>"
        formatted_results += formatted_result + "</result>"
    return f"<sources>{formatted_results}</sources>"
```

This pattern keeps answers grounded in retrieved text while allowing downstream models to craft concise summaries.

## Supabase Edge Function Proxy

The `supabase/functions/retrieval-search` edge function wraps the Retrieval API so the admin
panel can issue signed requests without exposing the OpenAI key in the browser. It accepts a
`POST` payload with `query`, optional `vectorStoreId`, `maxResults`, `rewriteQuery`, and
`attributeFilter` keys. The function enforces admin authentication, normalises filters, clamps
`maxResults` to the supported 1–50 range, and forwards the call to OpenAI. Responses are
returned with execution metadata, including elapsed milliseconds and token usage when available.

Environment variables required by the function:

- `OPENAI_API_KEY` – server-side key authorised for Retrieval operations
- `OPENAI_RETRIEVAL_VECTOR_STORE_ID` – default store used when the request omits an explicit ID

Run `npm run test:functions` to execute the accompanying Deno tests that cover authentication,
missing key handling, and the OpenAI proxy flow.

## Admin Retrieval Playground

The developer dashboard now includes a "Retrieval Playground" card that lives in
`src/components/developer/RetrievalPlayground.tsx`. It allows operators to:

- Provide a vector store ID (or rely on `VITE_OPENAI_VECTOR_STORE_ID` in `.env`) and send
  semantic queries from the browser.
- Toggle automatic query rewriting, control the maximum number of chunks (capped at 50), and
  experiment with JSON attribute filters.
- Inspect each returned chunk’s similarity score, metadata attributes, and raw text content.
- Review call telemetry such as elapsed time and total tokens consumed.

Results are fetched through `AdminAPI.searchRetrieval`, which calls the new edge function.
Errors are surfaced via toast notifications while responses are rendered inside a scrollable
result panel.
