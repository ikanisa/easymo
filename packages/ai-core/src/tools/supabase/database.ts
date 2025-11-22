import { SupabaseClient } from '@supabase/supabase-js';
import { Tool, AgentContext } from '../../base/types';

/**
 * Supabase Vector Search Tool
 * Semantic search using pgvector
 */
export const supabaseVectorSearchTool: Tool = {
  name: 'supabase_vector_search',
  description: 'Semantic search across documents using vector embeddings',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      table: { type: 'string', description: 'Table to search (e.g., "documents", "knowledge_base")' },
      limit: { type: 'number', description: 'Number of results' },
      threshold: { type: 'number', description: 'Similarity threshold (0-1)' }
    },
    required: ['query', 'table']
  },
  capabilities: ['search', 'semantic'],
  execute: async (params, context) => {
    const supabase = context.supabase;
    if (!supabase) throw new Error('Supabase client not available in context');

    // Generate embedding for query (using OpenAI or similar)
    const openai = require('openai');
    const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const embedding = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: params.query
    });

    const queryEmbedding = embedding.data[0].embedding;

    // Perform vector search
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: params.threshold || 0.7,
      match_count: params.limit || 5
    });

    if (error) throw error;

    return {
      results: data || [],
      query: params.query
    };
  }
};

/**
 * Supabase RPC Helper Tool
 * Call Supabase RPC functions
 */
export const supabaseRPCTool: Tool = {
  name: 'supabase_rpc',
  description: 'Call Supabase RPC functions (stored procedures)',
  parameters: {
    type: 'object',
    properties: {
      function_name: { type: 'string', description: 'RPC function name' },
      params: { type: 'object', description: 'Function parameters' }
    },
    required: ['function_name']
  },
  capabilities: ['database', 'rpc'],
  execute: async (params, context) => {
    const supabase = context.supabase;
    if (!supabase) throw new Error('Supabase client not available in context');

    const { data, error } = await supabase.rpc(params.function_name, params.params || {});

    if (error) throw error;

    return { result: data };
  }
};

/**
 * Supabase Storage Tool
 * Upload/download files from Supabase Storage
 */
export const supabaseStorageTool: Tool = {
  name: 'supabase_storage',
  description: 'Upload or download files from Supabase Storage',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['upload', 'download', 'list'], description: 'Storage action' },
      bucket: { type: 'string', description: 'Storage bucket name' },
      path: { type: 'string', description: 'File path' },
      file_data: { type: 'string', description: 'Base64 encoded file data (for upload)' }
    },
    required: ['action', 'bucket']
  },
  capabilities: ['storage', 'files'],
  execute: async (params, context) => {
    const supabase = context.supabase;
    if (!supabase) throw new Error('Supabase client not available in context');

    if (params.action === 'upload') {
      const { data, error } = await supabase.storage
        .from(params.bucket)
        .upload(params.path, Buffer.from(params.file_data, 'base64'));

      if (error) throw error;
      return { uploaded: true, path: data.path };
    }

    if (params.action === 'download') {
      const { data, error } = await supabase.storage
        .from(params.bucket)
        .download(params.path);

      if (error) throw error;
      return { file_data: await data.text() };
    }

    if (params.action === 'list') {
      const { data, error } = await supabase.storage
        .from(params.bucket)
        .list(params.path);

      if (error) throw error;
      return { files: data };
    }

    throw new Error('Invalid action');
  }
};

/**
 * Supabase Query Tool
 * Query Supabase tables
 */
export const supabaseQueryTool: Tool = {
  name: 'supabase_query',
  description: 'Query Supabase tables with filters and sorting',
  parameters: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      select: { type: 'string', description: 'Columns to select (e.g., "*" or "id,name")' },
      filters: { type: 'object', description: 'Filter conditions' },
      limit: { type: 'number', description: 'Number of results' }
    },
    required: ['table']
  },
  capabilities: ['database', 'query'],
  execute: async (params, context) => {
    const supabase = context.supabase;
    if (!supabase) throw new Error('Supabase client not available in context');

    let query = supabase.from(params.table).select(params.select || '*');

    // Apply filters
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    if (params.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { results: data || [] };
  }
};
