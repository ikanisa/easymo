import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type Provider = 'bing' | 'serpapi';

async function searchBing(query: string, topN: number, apiKey: string) {
  const url = new URL('https://api.bing.microsoft.com/v7.0/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(topN, 50)));
  const resp = await fetch(url.toString(), { headers: { 'Ocp-Apim-Subscription-Key': apiKey } });
  if (!resp.ok) throw new Error(`bing_failed:${resp.status}`);
  const json = await resp.json();
  const webPages = json?.webPages?.value ?? [];
  return webPages.map((i: any) => ({ title: i?.name, url: i?.url })).slice(0, topN);
}

async function searchSerpApi(query: string, topN: number, apiKey: string) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.min(topN, 50)));
  url.searchParams.set('api_key', apiKey);
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`serpapi_failed:${resp.status}`);
  const json = await resp.json();
  const results = json?.organic_results ?? [];
  return results.map((i: any) => ({ title: i?.title, url: i?.link })).slice(0, topN);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const { id } = params;
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const query = String(body?.query || '').trim();
  const topN = Math.max(1, Math.min(Number(body?.top_n ?? 5), 50));
  const provider: Provider = (String(body?.provider || '').toLowerCase() as Provider) || (process.env.SEARCH_API_PROVIDER as Provider) || 'bing';
  if (!query) return NextResponse.json({ error: 'query_required' }, { status: 400 });
  const maxPerHour = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_HOUR || '0') || 0;
  const maxPerDay = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_DAY || '0') || 0;
  const maxPerRequest = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_REQUEST || '0') || 0;
  let remaining = Infinity;
  if (maxPerHour > 0) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('agent_documents').select('id', { count: 'exact', head: true }).eq('agent_id', id).gte('created_at', since);
    remaining = Math.max(0, maxPerHour - (count ?? 0));
    if (remaining <= 0) return NextResponse.json({ error: 'rate_limited', limit: maxPerHour }, { status: 429 });
  }
  if (maxPerDay > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('agent_documents').select('id', { count: 'exact', head: true }).eq('agent_id', id).gte('created_at', since);
    const dailyRemaining = Math.max(0, maxPerDay - (count ?? 0));
    if (dailyRemaining <= 0) return NextResponse.json({ error: 'rate_limited_daily', limit: maxPerDay }, { status: 429 });
    remaining = Math.min(remaining, dailyRemaining);
  }

  try {
    let items: { title?: string; url: string }[] = [];
    if (provider === 'bing') {
      const key = process.env.BING_SEARCH_API_KEY || process.env.SEARCH_API_KEY;
      if (!key) return NextResponse.json({ error: 'bing_api_key_missing' }, { status: 500 });
      items = await searchBing(query, topN, key);
    } else if (provider === 'serpapi') {
      const key = process.env.SERPAPI_KEY || process.env.SEARCH_API_KEY;
      if (!key) return NextResponse.json({ error: 'serpapi_key_missing' }, { status: 500 });
      items = await searchSerpApi(query, topN, key);
    } else {
      return NextResponse.json({ error: 'unknown_provider' }, { status: 400 });
    }

    if (!items.length) return NextResponse.json({ imported: 0 });
    const urlsAll = items.map((r) => r.url);
    const uniqueUrlsAll = Array.from(new Set(urlsAll));
    const duplicatesBatch = urlsAll.length - uniqueUrlsAll.length;
    // DB duplicates
    const { data: existingRows } = await admin.from('agent_documents').select('source_url').eq('agent_id', id).in('source_url', uniqueUrlsAll);
    const existingSet = new Set((existingRows ?? []).map((r: any) => r.source_url));
    const newUrls = uniqueUrlsAll.filter((u) => !existingSet.has(u));
    let cap = Number.isFinite(remaining as number) ? (remaining as number) : rowsAll.length;
    if (maxPerRequest > 0) cap = Math.min(cap, maxPerRequest);
    const chosenUrls = newUrls.slice(0, cap);
    const rowsAll = uniqueUrlsAll.map((u) => ({ agent_id: id, title: (items.find((it) => it.url === u)?.title) || u, source_url: u, embedding_status: 'pending' }));
    const rows = chosenUrls.map((u) => ({ agent_id: id, title: (items.find((it) => it.url === u)?.title) || u, source_url: u, embedding_status: 'pending' }));
    const { data, error } = await admin
      .from('agent_documents')
      .upsert(rows, { onConflict: 'agent_id,source_url' })
      .select('id');
    if (error) return NextResponse.json({ error }, { status: 400 });
    const imported = data?.length ?? 0;
    const duplicatesDb = existingSet.size;
    const skippedCap = Math.max(0, newUrls.length - chosenUrls.length);
    return NextResponse.json({ imported, duplicates: duplicatesBatch + duplicatesDb, skipped: skippedCap, provider });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}

export const runtime = "edge";
