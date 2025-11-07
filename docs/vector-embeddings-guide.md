# Vector Embeddings Guide

This guide summarizes how to work with OpenAI's third-generation embedding models (the `text-embedding-3` family) and outlines the most common product scenarios that benefit from vector-based representations of text.

## Overview

An *embedding* is a list of floating point numbers representing the semantic meaning of text. The distance between two embeddings indicates their relatedness: smaller distances correspond to greater similarity.

OpenAI currently offers two third-generation embedding models:

| Model | Dimensions | Pages per dollar* | MTEB Score | Max tokens |
| --- | --- | --- | --- | --- |
| `text-embedding-3-small` | 1,536 (default) | 62,500 | 62.3% | 8,192 |
| `text-embedding-3-large` | 3,072 (default) | 9,615 | 64.6% | 8,192 |

\*Approximate pages of text assuming ~800 tokens per page.

These models improve multilingual performance, cost efficiency, and allow dimension control via the `dimensions` parameter.

## Getting Started

Install the official OpenAI SDK and request an embedding:

```ts
import OpenAI from "openai";

const client = new OpenAI();

const embedding = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: "Your text string goes here",
  encoding_format: "float",
});

console.log(embedding.data[0].embedding.length); // 1536
```

For Python developers:

```python
from openai import OpenAI

client = OpenAI()
response = client.embeddings.create(
    model="text-embedding-3-large",
    input="Sample text",
    encoding_format="float",
)
vector = response.data[0].embedding
```

The response includes the embedding vector and token usage metadata.

## Dimension Control

Set the `dimensions` parameter to shorten embeddings without retraining:

```python
response = client.embeddings.create(
    model="text-embedding-3-large",
    input="Flexible dimensions",
    dimensions=1024,
)
```

To manually shorten a vector, slice the array and apply L2 normalization:

```python
import numpy as np

vector = response.data[0].embedding
truncated = np.array(vector[:256])
normalized = truncated / np.linalg.norm(truncated)
```

## Core Use Cases

* **Semantic Search:** Rank documents by cosine similarity between query and document embeddings.
* **Clustering & Visualization:** Group related items with algorithms like k-means and visualize using t-SNE.
* **Recommendations:** Recommend items whose embeddings are near a user's preference vector.
* **Anomaly Detection:** Flag embeddings that fall far from expected clusters.
* **Classification & Zero-Shot Labeling:** Compare text embeddings against class label embeddings to infer categories.
* **Cold-Start Recommendations:** Average embeddings of user reviews or product feedback to create representative vectors.

## Best Practices

* Preprocess text by replacing newlines and trimming whitespace.
* Use cosine similarity (or dot product) because embeddings are unit normalized.
* Cache embeddings and store them in a vector database for efficient similarity search.
* Monitor storage costs when working with large embedding dimensions; consider shortening vectors where possible.
* For multilingual content, prefer `text-embedding-3-large` for higher accuracy.

## Resources

* [OpenAI Embeddings Documentation](https://platform.openai.com/docs/guides/embeddings)
* [OpenAI Cookbook Examples](https://github.com/openai/openai-cookbook)

This guide should help bootstrap embeddings-based features—search, recommendations, analytics, and more—into your fullstack applications.

## Fullstack Integration Blueprint

The typical production workflow for embeddings involves three services:

1. **Ingestion worker** that converts incoming content into embeddings and writes them to a vector store.
2. **Application database** that keeps relational metadata (owner IDs, permissions, timestamps) aligned with the embedding rows.
3. **Query-time API** that looks up candidate records via similarity search and merges them with fresh metadata before returning results to the UI.

A minimal TypeScript ingestion worker might look like this:

```ts
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function indexDocument(doc: { id: string; content: string }) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: doc.content,
  });

  const vector = embedding.data[0].embedding;

  await supabase.from("documents").upsert({
    id: doc.id,
    content: doc.content,
    embedding: vector,
  });
}
```

Supabase, PostgreSQL with pgvector, Pinecone, and Weaviate are all compatible vector stores. The key requirements are support for the embedding dimensionality you choose and fast approximate nearest-neighbor search.

## Query-Time Retrieval API (Next.js / Netlify)

When deploying to Netlify, the API route should be stateless and edge-friendly. The following route performs a hybrid metadata + vector lookup and returns highlighted excerpts for display in a React client:

```ts
// app/api/search/route.ts
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function POST(request: Request) {
  const { query, limit = 5, userId } = await request.json();

  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query,
  });

  const queryVector = embeddingResponse.data[0].embedding;

  const { data: matches, error } = await supabase.rpc("match_documents", {
    query_embedding: queryVector,
    match_count: limit,
    user_id: userId,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return Response.json(matches);
}
```

The `match_documents` function is a PostgreSQL stored procedure that encapsulates permissions and vector similarity logic:

```sql
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int,
  user_id uuid
)
returns table (
  id uuid,
  content text,
  similarity float
) language sql stable as $$
  select d.id, d.content, 1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where d.owner_id = user_id
  order by d.embedding <-> query_embedding
  limit match_count;
$$;
```

This pattern keeps the API route lightweight and Netlify-friendly while letting the database enforce authorization.

## Embedding Quality Checklist

Before promoting an embeddings-backed feature, validate the following:

* **Unit tests** for ingestion and search pipelines covering empty input, non-English text, and repeated writes.
* **Offline evaluation** using a labeled validation set to compute recall@k or mean reciprocal rank.
* **Online safeguards** such as minimum similarity thresholds or human review for low-confidence results.
* **Observability** instrumentation (latency histograms, error rates, request volume) to confirm the pipeline is healthy post-deploy.

## Rollout Strategy

1. Populate a shadow vector index in production from a read-only replica of your transactional database.
2. Mirror live queries into the new search endpoint and compare results with the legacy solution.
3. Gradually dial up traffic through a feature flag; fall back instantly by toggling the flag if anomaly detection alerts trigger.
4. Document the on-call playbook so the feature can be safely supported after it ships.

These steps align with our deployment checklist for Netlify-backed services and help guarantee smooth reviews and rollouts.

## Implementation References

* CLI worker: run `npm run embeddings:sync` to convert newly uploaded agent documents into chunked embeddings stored in `agent_document_chunks`.
* Supabase migration `20251207112000_agent_document_embeddings.sql` provisions the `agent_document_chunks` table, IVFFlat index, and the `match_agent_document_chunks` RPC used at query time.
* Admin API route `admin-app/app/api/agents/[id]/search/route.ts` exposes a semantic search endpoint tailored for Netlify deployments.
* Admin UI page `admin-app/app/(admin)/agents/[id]/search/page.tsx` offers a fully client-side search workflow and token accounting dashboard for operator QA.
