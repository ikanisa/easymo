import { Buffer } from "buffer";
import { fileURLToPath } from "url";
import { TextDecoder } from "util";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.SERVICE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  null;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY ??
  null;
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ??
  process.env.ADMIN_OPENAI_API_KEY ??
  process.env.NEXT_PUBLIC_OPENAI_API_KEY ??
  null;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || process.env.ADMIN_OPENAI_BASE_URL || undefined;
const AGENT_DOCS_BUCKET = process.env.AGENT_DOCS_BUCKET ?? "agent-docs";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase service-role credentials are required (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
}
if (!OPENAI_API_KEY) {
  throw new Error("OpenAI credentials missing. Set OPENAI_API_KEY or ADMIN_OPENAI_API_KEY.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });

const decoder = new TextDecoder("utf-8");

function chunkText(text, chunkSize = 800, overlap = 200) {
  const normalized = text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + chunkSize);
    const slice = normalized.slice(start, end).trim();
    if (slice) {
      chunks.push(slice);
    }
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

function estimateTokens(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words * 1.3));
}

async function fetchPendingDocuments(limit = 5) {
  const { data, error } = await supabase
    .from("agent_documents")
    .select("id, agent_id, title, source_url, storage_path, metadata, embedding_status")
    .in("embedding_status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function claimDocument(document) {
  const { data, error } = await supabase
    .from("agent_documents")
    .update({ embedding_status: "processing" })
    .eq("id", document.id)
    .eq("embedding_status", document.embedding_status)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function loadDocumentContent(document) {
  if (document.storage_path) {
    const { data, error } = await supabase.storage
      .from(AGENT_DOCS_BUCKET)
      .download(document.storage_path);
    if (error) throw error;
    if (typeof data.arrayBuffer === "function") {
      const buffer = Buffer.from(await data.arrayBuffer());
      return decoder.decode(buffer);
    }
    if (data instanceof Uint8Array) {
      return decoder.decode(data);
    }
    if (data instanceof Buffer) {
      return decoder.decode(data);
    }
    throw new Error(`Unsupported storage payload for document ${document.id}`);
  }
  if (document.source_url) {
    const response = await fetch(document.source_url);
    if (!response.ok) {
      throw new Error(`Failed to fetch source URL ${document.source_url}: ${response.status}`);
    }
    return await response.text();
  }
  throw new Error(`Document ${document.id} has no storage_path or source_url to ingest.`);
}

async function upsertChunks(document, chunks, embeddings) {
  const rows = chunks.map((content, index) => ({
    document_id: document.id,
    chunk_index: index,
    content,
    embedding: embeddings[index].embedding,
    token_count: estimateTokens(content),
    metadata: {
      chunk_created_at: new Date().toISOString(),
      character_count: content.length,
    },
  }));

  await supabase.from("agent_document_chunks").delete().eq("document_id", document.id);
  const { error } = await supabase.from("agent_document_chunks").insert(rows);
  if (error) throw error;
}

async function markDocumentReady(document, chunkCount) {
  const metadata = { ...(document.metadata ?? {}) };
  metadata.embedding_model = EMBEDDING_MODEL;
  metadata.embedding_chunk_count = chunkCount;
  metadata.embedding_updated_at = new Date().toISOString();
  await supabase
    .from("agent_documents")
    .update({ embedding_status: "ready", metadata })
    .eq("id", document.id);
}

async function markDocumentFailed(document, error) {
  const metadata = { ...(document.metadata ?? {}) };
  metadata.embedding_last_error = error instanceof Error ? error.message : String(error);
  metadata.embedding_failed_at = new Date().toISOString();
  await supabase
    .from("agent_documents")
    .update({ embedding_status: "failed", metadata })
    .eq("id", document.id);
}

async function processDocument(document) {
  const claimed = await claimDocument(document);
  if (!claimed) {
    console.log(`skip document ${document.id}: could not claim status transition`);
    return;
  }

  try {
    const raw = await loadDocumentContent(document);
    const chunks = chunkText(raw);
    if (chunks.length === 0) {
      console.warn(`document ${document.id} produced no chunks; marking ready without embeddings`);
      await supabase
        .from("agent_document_chunks")
        .delete()
        .eq("document_id", document.id);
      await markDocumentReady(document, 0);
      return;
    }

    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: chunks,
    });

    if (!embeddingResponse.data?.length) {
      throw new Error("OpenAI returned no embeddings for document.");
    }
    if (embeddingResponse.data.length !== chunks.length) {
      throw new Error(
        `Expected ${chunks.length} embeddings but received ${embeddingResponse.data.length}.`,
      );
    }

    await upsertChunks(document, chunks, embeddingResponse.data);
    await markDocumentReady(document, chunks.length);

    console.log(
      `embedded document ${document.id} (${chunks.length} chunks, tokens=${embeddingResponse.usage?.total_tokens ?? "n/a"})`,
    );
  } catch (error) {
    console.error(`embedding failed for document ${document.id}`, error);
    await markDocumentFailed(document, error);
  }
}

export async function ingestPendingDocuments(batchSize = 5) {
  const documents = await fetchPendingDocuments(batchSize);
  for (const document of documents) {
    await processDocument(document);
  }
  return documents.length;
}

async function main() {
  const batchSize = Number.parseInt(process.env.EMBEDDING_BATCH_SIZE ?? "5", 10);
  const processed = await ingestPendingDocuments(batchSize);
  console.log(`processed ${processed} documents for embeddings`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error("embedding ingestion failed", error);
    process.exit(1);
  });
}
