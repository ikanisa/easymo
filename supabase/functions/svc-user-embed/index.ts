// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

async function embedText(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`embedding_failed: ${res.status}`);
  const json = await res.json();
  const emb = json?.data?.[0]?.embedding;
  if (!Array.isArray(emb)) throw new Error('invalid_embedding_response');
  return emb as number[];
}

function mkProfileText(mem: Record<string, any>[], transcripts: Record<string, any>[]) {
  const lines: string[] = [];
  for (const row of mem) {
    if (!row?.key) continue;
    const v = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
    lines.push(`${row.key}: ${v}`);
  }
  const lastFew = transcripts.slice(-5).map((t) => `[${t.role}] ${t.content}`).join('\n');
  if (lastFew) lines.push(`recent_messages:\n${lastFew}`);
  return lines.join('\n');
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_URL_PUBLIC');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE || !OPENAI_API_KEY) return new Response('server_misconfigured', { status: 500 });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let userId: string | undefined;
  try {
    const payload = await req.json();
    userId = typeof payload?.user_id === 'string' ? payload.user_id : undefined;
  } catch {}
  if (!userId) return new Response('missing_user_id', { status: 400 });

  const { data: mem } = await supabase
    .from('assistant_memory')
    .select('key,value')
    .eq('user_id', userId)
    .limit(20);
  const { data: trs } = await supabase
    .from('transcripts')
    .select('role,content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  const text = mkProfileText(Array.isArray(mem) ? mem as any : [], Array.isArray(trs) ? trs as any : []);
  const emb = await embedText(OPENAI_API_KEY, text || userId);
  const { error } = await supabase.from('vector_memory').upsert({
    user_id: userId,
    embedding: emb,
    doc_type: 'profile',
    ref_id: 'user_profile',
  }, { onConflict: 'user_id' } as any);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true, user_id: userId }), { headers: { 'content-type': 'application/json' } });
}

// @ts-ignore
addEventListener('fetch', (e: FetchEvent) => e.respondWith(handler(e.request)));

