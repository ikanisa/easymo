import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

function parseFolderId(input: string): string | null {
  try {
    // Accept raw ID or drive folder URL
    if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;
    const m = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

async function getServiceAccountToken(): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_DRIVE_SA_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_DRIVE_SA_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;
  privateKey = privateKey.replace(/\\n/g, "\n");
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  function b64u(input: string) { return Buffer.from(input).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_'); }
  const headerB64 = b64u(JSON.stringify(header));
  const claimB64 = b64u(JSON.stringify(claim));
  const toSign = `${headerB64}.${claimB64}`;
  const signer = crypto.createSign('RSA-SHA256'); signer.update(toSign); signer.end();
  const signature = signer.sign(privateKey);
  const sigB64 = signature.toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
  const assertion = `${toSign}.${sigB64}`;
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.access_token || null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const saToken = await getServiceAccountToken();
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const folder = String(body?.folder || '').trim();
  const id = params.id;
  const folderId = parseFolderId(folder);
  if (!folderId) return NextResponse.json({ error: 'invalid_folder' }, { status: 400 });
  const pageSize = Math.min(Number(body?.page_size ?? 100), 1000);
  const maxPerHour = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_HOUR || '0') || 0;
  const maxPerDay = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_DAY || '0') || 0;
  const maxPerRequest = Number(process.env.AGENT_DOCS_IMPORT_MAX_PER_REQUEST || '0') || 0;

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder'`);
  url.searchParams.set('fields', 'files(id,name,mimeType,webViewLink,webContentLink)');
  url.searchParams.set('pageSize', String(pageSize));
  if (apiKey) url.searchParams.set('key', apiKey);

  let resp: Response;
  try {
    resp = await fetch(url.toString(), saToken ? { headers: { Authorization: `Bearer ${saToken}` } } : undefined);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
  if (!resp.ok) return NextResponse.json({ error: `drive_list_failed:${resp.status}` }, { status: 502 });
  const json = await resp.json();
  const files = Array.isArray(json?.files) ? json.files : [];
  if (maxPerHour > 0) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('agent_documents').select('id', { count: 'exact', head: true }).eq('agent_id', id).gte('created_at', since);
    const remaining = Math.max(0, maxPerHour - (count ?? 0));
    if (remaining <= 0) return NextResponse.json({ error: 'rate_limited', limit: maxPerHour }, { status: 429 });
    if (files.length > remaining) files.length = remaining;
  }
  if (maxPerDay > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('agent_documents').select('id', { count: 'exact', head: true }).eq('agent_id', id).gte('created_at', since);
    const dailyRemaining = Math.max(0, maxPerDay - (count ?? 0));
    if (dailyRemaining <= 0) return NextResponse.json({ error: 'rate_limited_daily', limit: maxPerDay }, { status: 429 });
    if (files.length > dailyRemaining) files.length = dailyRemaining;
  }
  if (maxPerRequest > 0 && files.length > maxPerRequest) files.length = maxPerRequest;
  if (!files.length) return NextResponse.json({ imported: 0, reason: 'no_files' }, { status: 200 });
  const urlsAll = files.map((f: any) => f?.webViewLink || `https://drive.google.com/file/d/${f?.id}/view`);
  const uniqueUrlsAll = Array.from(new Set(urlsAll));
  const duplicatesBatch = urlsAll.length - uniqueUrlsAll.length;
  const { data: existingRows } = await admin.from('agent_documents').select('source_url').eq('agent_id', id).in('source_url', uniqueUrlsAll);
  const existingSet = new Set((existingRows ?? []).map((r: any) => r.source_url));
  const newUrls = uniqueUrlsAll.filter((u) => !existingSet.has(u));

  const mapByUrl: Record<string, any> = Object.fromEntries(files.map((f: any) => {
    const url = f?.webViewLink || `https://drive.google.com/file/d/${f?.id}/view`;
    return [url, f];
  }));
  const rows = newUrls.map((u) => {
    const f = mapByUrl[u];
    return {
      agent_id: id,
      title: (f?.name || u),
      source_url: u,
      embedding_status: 'pending',
      metadata: { mimeType: f?.mimeType || null, driveId: f?.id }
    };
  });
  const { data, error } = await admin
    .from('agent_documents')
    .upsert(rows, { onConflict: 'agent_id,source_url' })
    .select('id');
  if (error) return NextResponse.json({ error }, { status: 400 });
  const imported = data?.length ?? 0;
  const duplicatesDb = existingSet.size;
  return NextResponse.json({ imported, duplicates: duplicatesBatch + duplicatesDb });
}
