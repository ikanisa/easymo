// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

type Biz = { id: string; name?: string; category?: string; region?: string; description?: string; tags?: any };

async function embedText(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`embedding_failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  const emb = json?.data?.[0]?.embedding;
  if (!Array.isArray(emb)) throw new Error('invalid_embedding_response');
  return emb as number[];
}

function repr(b: Biz) {
  const tags = Array.isArray(b.tags) ? b.tags.join(',') : (typeof b.tags === 'string' ? b.tags : '');
  return [b.name ?? '', b.category ?? '', b.region ?? '', b.description ?? '', tags]
    .filter((s) => String(s).trim().length > 0)
    .join('\n');
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_URL_PUBLIC');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE || !OPENAI_API_KEY) return new Response('server_misconfigured', { status: 500 });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let limit = 10;
  let region: string | undefined;
  let reembed = false;
  let businessId: string | undefined;
  try {
    const payload = await req.json();
    if (payload && typeof payload === 'object') {
      if (payload.limit) limit = Math.max(1, Math.min(200, Number(payload.limit)));
      if (typeof payload.region === 'string') region = payload.region;
      if (payload.reembed === true) reembed = true;
      if (typeof payload.business_id === 'string') businessId = payload.business_id;
    }
  } catch { /* allow empty */ }

  // Select businesses missing embeddings (or forced reembed)
  let q = supabase.from('businesses').select('*').limit(limit);
  if (businessId) q = q.eq('id', businessId);
  if (!reembed && !businessId) q = q.is('embedding', null);
  if (region) q = q.ilike('region', `%${region}%`);
  const { data: rows, error } = await q as any;
  if (error) return new Response(`select_failed: ${error.message}`, { status: 500 });
  const items: Biz[] = Array.isArray(rows) ? (rows as any) : [];
  let updated = 0;
  for (const b of items) {
    try {
      const text = repr(b);
      const emb = await embedText(OPENAI_API_KEY, text);
      const { error: upErr } = await supabase.from('businesses').update({ embedding: emb }).eq('id', b.id);
      if (upErr) throw upErr;
      updated++;
    } catch (err) {
      await supabase.from('vector_memory').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        embedding: new Array(1536).fill(0),
        doc_type: 'embed_error',
        ref_id: String((err as any)?.message ?? err),
      }).catch(() => undefined);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: items.length, updated }), {
    headers: { 'content-type': 'application/json' },
  });
}

// @ts-ignore
addEventListener('fetch', (e: FetchEvent) => e.respondWith(handler(e.request)));
