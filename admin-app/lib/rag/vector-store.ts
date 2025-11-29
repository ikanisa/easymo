// RAG with Supabase pgvector

import { createClient } from "@supabase/supabase-js";

import { getOpenAIClient } from "../ai/providers/openai-client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export class VectorStore {
  private openai = getOpenAIClient();
  private tableName: string;

  constructor(tableName: string = "documents") {
    this.tableName = tableName;
  }

  // Generate embeddings using OpenAI
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  }

  // Store document with embedding
  async addDocument(content: string, metadata?: Record<string, any>): Promise<string> {
    const embedding = await this.generateEmbedding(content);

    const { data, error } = await supabase
      .from(this.tableName)
      .insert({
        content,
        metadata,
        embedding,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  // Batch add documents
  async addDocuments(
    documents: Array<{ content: string; metadata?: Record<string, any> }>
  ): Promise<string[]> {
    const docsWithEmbeddings = await Promise.all(
      documents.map(async (doc) => ({
        content: doc.content,
        metadata: doc.metadata,
        embedding: await this.generateEmbedding(doc.content),
      }))
    );

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(docsWithEmbeddings)
      .select();

    if (error) throw error;
    return data.map((d) => d.id);
  }

  // Similarity search
  async search(
    query: string,
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<Array<{ id: string; content: string; metadata?: any; similarity: number }>> {
    const queryEmbedding = await this.generateEmbedding(query);

    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) throw error;
    return data;
  }

  // Delete document
  async deleteDocument(id: string): Promise<void> {
    const { error } = await supabase.from(this.tableName).delete().eq("id", id);

    if (error) throw error;
  }

  // Update document
  async updateDocument(
    id: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const embedding = await this.generateEmbedding(content);

    const { error } = await supabase
      .from(this.tableName)
      .update({ content, metadata, embedding })
      .eq("id", id);

    if (error) throw error;
  }
}

export const vectorStore = new VectorStore();

// RAG query function
export async function ragQuery(
  question: string,
  context?: string,
  numResults: number = 3
): Promise<{ answer: string; sources: Array<{ content: string; metadata?: any }> }> {
  const openai = getOpenAIClient();

  // 1. Search for relevant documents
  const results = await vectorStore.search(question, numResults);

  // 2. Build context from results
  const contextText = results.map((r, i) => `[${i + 1}] ${r.content}`).join("\n\n");

  // 3. Generate answer with context
  const messages = [
    {
      role: "system" as const,
      content: `You are a helpful assistant. Answer questions based on the provided context.
If the context doesn't contain relevant information, say so.
Always cite your sources using [1], [2], etc.`,
    },
    {
      role: "user" as const,
      content: `Context:\n${contextText}\n\n${context ? `Additional context: ${context}\n\n` : ""}Question: ${question}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3,
  });

  return {
    answer: response.choices[0].message.content || "",
    sources: results.map((r) => ({
      content: r.content,
      metadata: r.metadata,
    })),
  };
}

// Chunk text for better embeddings
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

// Process document (split into chunks and store)
export async function processDocument(
  text: string,
  metadata?: Record<string, any>
): Promise<string[]> {
  const chunks = chunkText(text);

  return await vectorStore.addDocuments(
    chunks.map((chunk) => ({
      content: chunk,
      metadata: { ...metadata, chunkIndex: chunks.indexOf(chunk) },
    }))
  );
}
